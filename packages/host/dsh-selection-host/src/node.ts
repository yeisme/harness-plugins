/**
 * @yeisme/dsh-selection-host node reference implementation.
 *
 * An in-memory `SelectionAnnotationServiceV1` plus a version-fenced file
 * store. Real persistence stays with the owner service; this implementation
 * freezes the contract, powers tests and demonstrates the apply loop
 * (dependency closure -> version fence -> splice -> receipt).
 *
 * @module @yeisme/dsh-selection-host/node
 */

import {
  parseSelectionAnchor,
  planPartialApply,
  groupHunksByArtifact,
  SELECTION_PROTOCOL_LIMITS,
  assertHunkTransition,
  canTransitionHunk,
  type AnchorDraft,
  type AnnotationBatchV1,
  type AgentBatchRequestV1,
  type ApplyReceiptV1,
  type CreateProposalInputV1,
  type HunkDecision,
  type HunkStatus,
  type PatchRangeV1,
  type PatchRegistrationV1,
  type ProposalHunkV1,
  type ProposalV1,
  type SelectionAnchorV1,
  type SelectionAnnotationServiceV1,
  type VersionedFileStoreV1,
} from './index.ts'

export type InMemoryPatch = {
  readonly patchRef: string
  readonly artifactRef: string
  readonly baseVersion: string
  readonly ranges: readonly PatchRangeV1[]
}

let idCounter = 0

function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${idCounter.toString(36).padStart(6, '0')}`
}

/** Whole-second ISO timestamps so schema regexes accept them. */
function iso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

export interface InMemoryFileEntry {
  readonly artifactRef: string
  version: string
  lines: string[]
}

export interface InMemoryVersionedFileStore {
  readonly store: VersionedFileStoreV1
  /** Simulates an external writer for drift tests; bumps the version. */
  mutateExternally(artifactRef: string, lines: readonly string[]): string
}

export function createInMemoryVersionedFileStore(
  files: Readonly<Record<string, string>>,
): InMemoryVersionedFileStore {
  const entries = new Map<string, InMemoryFileEntry>()
  let versionCounter = 0
  for (const [artifactRef, content] of Object.entries(files)) {
    versionCounter += 1
    entries.set(artifactRef, { artifactRef, version: `v${versionCounter}`, lines: content.split('\n') })
  }
  const store: VersionedFileStoreV1 = {
    currentVersion(artifactRef) {
      return entries.get(artifactRef)?.version
    },
    readLines(artifactRef) {
      return entries.get(artifactRef)?.lines
    },
    writeLines(artifactRef, lines, expectedVersion) {
      const entry = entries.get(artifactRef)
      if (entry === undefined) return { status: 'conflict' }
      if (entry.version !== expectedVersion) return { status: 'conflict' }
      versionCounter += 1
      const version = `v${versionCounter}`
      entries.set(artifactRef, { artifactRef, version, lines: [...lines] })
      return { status: 'ok', version }
    },
  }
  return {
    store,
    mutateExternally(artifactRef, lines) {
      const entry = entries.get(artifactRef)
      if (entry === undefined) throw new Error(`unknown artifact ${artifactRef}`)
      versionCounter += 1
      const version = `v${versionCounter}`
      entries.set(artifactRef, { artifactRef, version, lines: [...lines] })
      return version
    },
  }
}

export interface CreateSelectionAnnotationServiceOptions {
  readonly fileStore: VersionedFileStoreV1
}

/**
 * Build the in-memory reference service. The returned object is the only
 * mutation surface; the file store is referenced, not copied.
 */
export function createSelectionAnnotationService(
  options: CreateSelectionAnnotationServiceOptions,
): SelectionAnnotationServiceV1 & { readonly patches: ReadonlyMap<string, InMemoryPatch> } {
  const anchors = new Map<string, SelectionAnchorV1>()
  const batches = new Map<string, AnnotationBatchV1>()
  const proposals = new Map<string, ProposalV1>()
  const patches = new Map<string, InMemoryPatch>()
  const receiptsByProposal = new Map<string, ApplyReceiptV1[]>()
  const hunkStatuses = new Map<string, HunkStatus>()
  const markerByAnchor = new Map<string, number>()
  const artifactRefByAnchor = new Map<string, string>()

  const receipt = (
    proposalId: string,
    hunk: ProposalHunkV1,
    action: ApplyReceiptV1['action'],
    status: ApplyReceiptV1['status'],
    extra: Partial<ApplyReceiptV1> = {},
  ): ApplyReceiptV1 => {
    const record: ApplyReceiptV1 = {
      receiptId: nextId('rcpt'),
      proposalId,
      hunkId: hunk.hunkId,
      anchorId: hunk.anchorId,
      action,
      status,
      decidedAt: iso(),
      ...extra,
    }
    const list = receiptsByProposal.get(proposalId) ?? []
    list.push(record)
    receiptsByProposal.set(proposalId, list)
    return record
  }

  const requireProposal = (proposalId: string): ProposalV1 => {
    const proposal = proposals.get(proposalId)
    if (proposal === undefined) throw new Error(`unknown proposal ${proposalId}`)
    return proposal
  }

  const requireHunk = (proposal: ProposalV1, hunkId: string): ProposalHunkV1 => {
    const hunk = proposal.hunks.find(candidate => candidate.hunkId === hunkId)
    if (hunk === undefined) throw new Error(`unknown hunk ${hunkId}`)
    return hunk
  }

  const patchArtifactFor = (hunk: ProposalHunkV1): string | undefined =>
    patches.get(hunk.patchRef)?.artifactRef

  const withStatus = (proposal: ProposalV1): ProposalV1 => ({
    ...proposal,
    hunks: proposal.hunks.map(hunk => ({ ...hunk, decision: hunkStatuses.get(hunk.hunkId) ?? hunk.decision })),
  })

  const service: SelectionAnnotationServiceV1 = {
    version: '0.1.0-rc.1',
    capability: 'selection-annotation',

    publishAnchor(draft: AnchorDraft): SelectionAnchorV1 {
      const anchorId = nextId('anc')
      const anchor = parseSelectionAnchor({
        ...draft,
        anchorId,
        createdAt: draft.createdAt ?? iso(),
        freshness: draft.freshness ?? 'fresh',
      })
      anchors.set(anchorId, anchor)
      artifactRefByAnchor.set(anchorId, anchor.artifactRef)
      return anchor
    },

    getAnchor(anchorId) {
      return anchors.get(anchorId)
    },

    createBatch(input) {
      if (input.anchorIds.length === 0) throw new Error('batch requires at least one anchor')
      const resolved = input.anchorIds.map(anchorId => {
        const anchor = anchors.get(anchorId)
        if (anchor === undefined) throw new Error(`unknown anchor ${anchorId}`)
        return anchor
      })
      const batch: AnnotationBatchV1 = {
        batchId: nextId('batch'),
        title: input.title.slice(0, SELECTION_PROTOCOL_LIMITS.batchTitleChars),
        anchors: resolved,
        ...(input.conversationRef === undefined ? {} : { conversationRef: input.conversationRef }),
        status: 'draft',
        createdAt: iso(),
      }
      batches.set(batch.batchId, batch)
      return batch
    },

    submitBatch(batchId) {
      const batch = batches.get(batchId)
      if (batch === undefined) throw new Error(`unknown batch ${batchId}`)
      if (batch.status !== 'draft') throw new Error(`batch ${batchId} is already ${batch.status}`)
      const markerLimit = SELECTION_PROTOCOL_LIMITS.markerMaxPerScreenshot
      const numberedAnchors = batch.anchors.map((anchor, index) => {
        const marker = index + 1
        if (marker > markerLimit) throw new Error(`batch exceeds marker limit ${markerLimit}`)
        markerByAnchor.set(anchor.anchorId, marker)
        const numbered: SelectionAnchorV1 = { ...anchor, marker }
        anchors.set(anchor.anchorId, numbered)
        return numbered
      })
      const submitted: AnnotationBatchV1 = { ...batch, anchors: numberedAnchors, status: 'submitted', submittedAt: iso() }
      batches.set(batchId, submitted)
      return submitted
    },

    resolveBatch(batchId) {
      const batch = batches.get(batchId)
      if (batch === undefined) throw new Error(`unknown batch ${batchId}`)
      if (batch.status !== 'submitted') throw new Error(`batch ${batchId} is ${batch.status}, expected submitted`)
      const resolved: AnnotationBatchV1 = { ...batch, status: 'resolved' }
      batches.set(batchId, resolved)
      return resolved
    },

    buildAgentRequest(batchId): AgentBatchRequestV1 {
      const batch = batches.get(batchId)
      if (batch === undefined) throw new Error(`unknown batch ${batchId}`)
      if (batch.status !== 'submitted') throw new Error(`batch ${batchId} must be submitted before agent handoff`)
      return {
        batchId,
        title: batch.title,
        markers: batch.anchors.map((anchor, index) => ({
          marker: anchor.marker ?? index + 1,
          label: `#${anchor.marker ?? index + 1}`,
          kind: anchor.kind,
          quotePreview: anchor.quotePreview,
          freshness: anchor.freshness,
        })),
        untrustedContext: true,
        replyContract: 'reply-must-reference-markers',
      }
    },

    registerPatch(registration: PatchRegistrationV1): string {
      if (registration.ranges.length === 0) throw new Error('patch requires at least one range')
      for (const range of registration.ranges) {
        if (range.endLine < range.startLine) throw new Error('range endLine must be >= startLine')
        if (range.startLine < 1) throw new Error('range startLine must be >= 1')
      }
      const patchRef = nextId('patch')
      patches.set(patchRef, { ...registration, patchRef })
      return patchRef
    },

    createProposal(input: CreateProposalInputV1): ProposalV1 {
      if (input.hunks.length === 0) throw new Error('proposal requires at least one hunk')
      const aliasToIndex = new Map<string, number>()
      const hunkIds: string[] = []
      const drafts = input.hunks.map((hunk, index) => {
        if (!anchors.has(hunk.anchorId)) throw new Error(`unknown anchor ${hunk.anchorId}`)
        if (!patches.has(hunk.patchRef)) throw new Error(`unknown patchRef ${hunk.patchRef}; patches are registered host-side only`)
        const hunkId = nextId('hunk')
        hunkIds.push(hunkId)
        if (hunk.key !== undefined) {
          if (aliasToIndex.has(hunk.key)) throw new Error(`duplicate hunk key ${hunk.key}`)
          aliasToIndex.set(hunk.key, index)
        }
        if (!aliasToIndex.has(hunk.anchorId)) aliasToIndex.set(hunk.anchorId, index)
        return {
          hunkId,
          anchorId: hunk.anchorId,
          owner: hunk.owner,
          baseVersion: hunk.baseVersion,
          safeSummary: hunk.safeSummary,
          patchRef: hunk.patchRef,
          dependencies: [] as string[],
          decision: 'pending' as const,
        }
      })
      input.hunks.forEach((hunk, index) => {
        for (const dep of hunk.dependencies ?? []) {
          const depIndex = aliasToIndex.get(dep)
          if (depIndex === undefined) throw new Error(`dependency ${dep} is not part of this proposal`)
          if (depIndex === index) throw new Error('hunk cannot depend on itself')
          const depHunkId = hunkIds[depIndex]
          const draft = drafts[index]
          if (depHunkId === undefined || draft === undefined) throw new Error('dependency resolution failed')
          draft.dependencies.push(depHunkId)
        }
      })
      const hunks: ProposalHunkV1[] = drafts.map(draft => ({ ...draft, dependencies: [...draft.dependencies] }))
      const proposal: ProposalV1 = {
        proposalId: nextId('prop'),
        ...(input.batchId === undefined ? {} : { batchId: input.batchId }),
        title: input.title,
        hunks,
        createdAt: iso(),
      }
      proposals.set(proposal.proposalId, proposal)
      return proposal
    },

    getProposal(proposalId) {
      const proposal = proposals.get(proposalId)
      return proposal === undefined ? undefined : withStatus(proposal)
    },

    decide(proposalId, hunkId, decision) {
      const proposal = requireProposal(proposalId)
      const hunk = requireHunk(proposal, hunkId)
      const from = hunkStatuses.get(hunkId) ?? hunk.decision
      const to: HunkStatus = decision
      assertHunkTransition(from, to)
      hunkStatuses.set(hunkId, to)
      const actionFor: Record<Exclude<HunkDecision, 'pending'>, ApplyReceiptV1['action']> = {
        approved: 'approve',
        rejected: 'reject',
        revision_requested: 'revision',
        deferred: 'defer',
      }
      const artifactRef = patchArtifactFor(hunk)
      return receipt(proposalId, hunk, actionFor[decision], 'ok', {
        baseVersion: hunk.baseVersion,
        ...(artifactRef === undefined ? {} : { artifactRef }),
      })
    },

    applyApproved(proposalId) {
      const proposal = requireProposal(proposalId)
      const current = withStatus(proposal)
      const versions = new Map<string, string>()
      for (const hunk of current.hunks) {
        const artifactRef = patchArtifactFor(hunk)
        if (artifactRef !== undefined && !versions.has(artifactRef)) {
          const version = options.fileStore.currentVersion(artifactRef)
          if (version !== undefined) versions.set(artifactRef, version)
        }
      }
      const plan = planPartialApply(current, versions, patchArtifactFor)
      const results: ApplyReceiptV1[] = []

      // Blocked dependents never partially apply; the dependency is spelled out.
      for (const blocker of plan.blocked) {
        const hunk = requireHunk(current, blocker.hunkId)
        results.push(receipt(proposalId, hunk, 'apply', 'blocked', {
          reason: `hunk depends on ${blocker.dependsOn} (${blocker.reason})`,
        }))
      }

      // Version drift fails closed into reconcile_required; no silent overwrite.
      for (const conflict of plan.conflicts) {
        const hunk = requireHunk(current, conflict.hunkId)
        const status = hunkStatuses.get(hunk.hunkId) ?? hunk.decision
        if (status === 'approved') {
          // Spec two-hop: approved -> applying -> reconcile_required.
          hunkStatuses.set(hunk.hunkId, 'applying')
          hunkStatuses.set(hunk.hunkId, 'reconcile_required')
        } else if (canTransitionHunk(status, 'reconcile_required')) {
          hunkStatuses.set(hunk.hunkId, 'reconcile_required')
        } else if (canTransitionHunk(status, 'stale')) {
          hunkStatuses.set(hunk.hunkId, 'stale')
        }
        results.push(receipt(proposalId, hunk, 'reconcile', 'conflict', {
          artifactRef: conflict.artifactRef,
          baseVersion: conflict.expected,
          reason: `artifact version drifted: expected ${conflict.expected}, actual ${conflict.actual}`,
        }))
      }

      if (plan.appliable.length === 0) return results

      const { groups, conflicts: groupConflicts } = groupHunksByArtifact(current, plan.appliable, patchArtifactFor)
      for (const conflict of groupConflicts) {
        const hunk = requireHunk(current, conflict.hunkId)
        hunkStatuses.set(hunk.hunkId, 'stale')
        results.push(receipt(proposalId, hunk, 'reconcile', 'conflict', {
          reason: `inconsistent baseVersion on ${conflict.artifactRef}`,
        }))
      }

      for (const [artifactRef, hunks] of groups) {
        const lines = options.fileStore.readLines(artifactRef)
        if (lines === undefined) {
          for (const hunk of hunks) {
            hunkStatuses.set(hunk.hunkId, 'failed')
            results.push(receipt(proposalId, hunk, 'apply', 'failed', { reason: `artifact ${artifactRef} unreadable` }))
          }
          continue
        }
        for (const hunk of hunks) {
          if (canTransitionHunk(hunkStatuses.get(hunk.hunkId) ?? hunk.decision, 'applying')) {
            hunkStatuses.set(hunk.hunkId, 'applying')
          }
        }
        const merged = [...lines]
        const allRanges = hunks.flatMap(hunk => (patches.get(hunk.patchRef)?.ranges ?? []).map(range => ({ hunk, range })))
        allRanges.sort((left, right) => right.range.startLine - left.range.startLine)
        let spliceFailed: string | undefined
        for (const { hunk, range } of allRanges) {
          if (range.endLine > merged.length || range.startLine < 1) {
            spliceFailed = `range ${range.startLine}-${range.endLine} outside artifact ${artifactRef} (${merged.length} lines)`
            hunkStatuses.set(hunk.hunkId, 'failed')
            continue
          }
          merged.splice(range.startLine - 1, range.endLine - range.startLine + 1, ...range.replacement)
        }
        if (spliceFailed !== undefined) {
          for (const hunk of hunks) {
            if (hunkStatuses.get(hunk.hunkId) === 'failed') {
              results.push(receipt(proposalId, hunk, 'apply', 'failed', { reason: spliceFailed }))
            }
          }
          continue
        }
        const firstHunk = hunks[0]
        if (firstHunk === undefined) continue
        const write = options.fileStore.writeLines(artifactRef, merged, firstHunk.baseVersion)
        if (write.status === 'conflict') {
          for (const hunk of hunks) {
            hunkStatuses.set(hunk.hunkId, 'reconcile_required')
            results.push(receipt(proposalId, hunk, 'reconcile', 'conflict', {
              artifactRef,
              baseVersion: hunk.baseVersion,
              reason: 'file changed while proposal was open',
            }))
          }
          continue
        }
        for (const hunk of hunks) {
          hunkStatuses.set(hunk.hunkId, 'applied')
          results.push(receipt(proposalId, hunk, 'apply', 'ok', {
            artifactRef,
            baseVersion: hunk.baseVersion,
            resultingVersion: write.version,
          }))
        }
      }
      return results
    },

    refreshStaleness(proposalId) {
      const proposal = requireProposal(proposalId)
      const results: ApplyReceiptV1[] = []
      for (const hunk of proposal.hunks) {
        const artifactRef = patchArtifactFor(hunk)
        if (artifactRef === undefined) continue
        const current = options.fileStore.currentVersion(artifactRef)
        const status = hunkStatuses.get(hunk.hunkId) ?? hunk.decision
        if (current !== undefined && current !== hunk.baseVersion && canTransitionHunk(status, 'stale')) {
          hunkStatuses.set(hunk.hunkId, 'stale')
          results.push(receipt(proposalId, hunk, 'stale', 'conflict', {
            artifactRef,
            baseVersion: hunk.baseVersion,
            reason: `artifact version drifted to ${current}`,
          }))
        }
      }
      return results
    },

    receipts(proposalId) {
      return [...(receiptsByProposal.get(proposalId) ?? [])]
    },
  }

  return { ...service, patches }
}
