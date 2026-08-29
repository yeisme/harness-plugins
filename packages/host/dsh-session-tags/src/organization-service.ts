/** Organization sidecar: catalogs, assignments, classifier, rules, and receipt-gated batches. */

import { randomUUID } from 'node:crypto'
import {
  SESSION_ORGANIZATION_BATCH_RETENTION_MS,
  SESSION_ORGANIZATION_SPEC_VERSION,
} from './constants.ts'
import { applyClassificationPolicy, defaultFunctionTypes, TemporaryAdminGate } from './organization.ts'
import { normalizeTags } from './tags.ts'
import type { SessionTagsSidecar } from './service.ts'
import type {
  BatchActionV1,
  BatchItemReceiptV1,
  BatchPlanV1,
  BatchReceiptV1,
  ClassificationCandidateV1,
  FunctionTypeV1,
  OrganizationFailureV1,
  OrganizationRuleV1,
  PutFunctionTypeInputV1,
  PutRuleInputV1,
  PutTagCatalogInputV1,
  SessionOrganizationAssignmentV1,
  SessionOrganizationSnapshotV1,
  SetAssignmentInputV1,
  TagCatalogEntryV1,
} from './organization-wire.ts'

export interface OrganizationTablePort<T> {
  get(key: string): T | undefined
  entries(): IterableIterator<[string, T]>
  put(key: string, value: T): Promise<void>
  delete(key: string): Promise<boolean>
}

export interface SessionOrganizationStorePort {
  readonly functionTypes: OrganizationTablePort<FunctionTypeV1>
  readonly assignments: OrganizationTablePort<SessionOrganizationAssignmentV1>
  readonly tagCatalog: OrganizationTablePort<TagCatalogEntryV1>
  readonly rules: OrganizationTablePort<OrganizationRuleV1>
  readonly batchRuns: OrganizationTablePort<BatchReceiptV1>
}

export interface OrganizationClassifierPort {
  classify(input: {
    readonly title: string
    readonly userMessages: readonly string[]
    readonly functionTypes: readonly FunctionTypeV1[]
    readonly knownTags: readonly string[]
  }): Promise<ClassificationCandidateV1>
}

export interface SessionLifecyclePort {
  mutate(input: {
    readonly sessionId: string
    readonly action: 'archive' | 'restore' | 'purge'
  }): Promise<{ readonly status: 'ok' | 'rejected' | 'not_available'; readonly reason?: string | undefined }>
}

export interface SessionOrganizationSidecarDeps {
  readonly store: SessionOrganizationStorePort
  readonly tags: SessionTagsSidecar
  readonly classifier?: OrganizationClassifierPort | undefined
  readonly lifecycle?: SessionLifecyclePort | undefined
  readonly now?: (() => number) | undefined
  readonly newId?: (() => string) | undefined
}

/** Local-first organization service. Durable rows are always authoritative. */
export class SessionOrganizationSidecar {
  private readonly store: SessionOrganizationStorePort
  private readonly tags: SessionTagsSidecar
  private readonly classifier: OrganizationClassifierPort | undefined
  private readonly lifecycle: SessionLifecyclePort | undefined
  private readonly now: () => number
  private readonly newId: () => string
  private readonly admin = new TemporaryAdminGate()
  private readonly plans = new Map<string, BatchPlanV1>()

  constructor(deps: SessionOrganizationSidecarDeps) {
    this.store = deps.store
    this.tags = deps.tags
    this.classifier = deps.classifier
    this.lifecycle = deps.lifecycle
    this.now = deps.now ?? Date.now
    this.newId = deps.newId ?? randomUUID
  }

  async snapshot(): Promise<SessionOrganizationSnapshotV1> {
    const overrides = new Map(this.store.functionTypes.entries())
    const functions = defaultFunctionTypes().map(item => overrides.get(item.id) ?? item)
    for (const [id, item] of overrides) {
      if (!functions.some(existing => existing.id === id)) functions.push(item)
    }
    const cutoff = this.now() - SESSION_ORGANIZATION_BATCH_RETENTION_MS
    return Object.freeze({
      ok: true,
      specVersion: SESSION_ORGANIZATION_SPEC_VERSION,
      functionTypes: Object.freeze(functions.sort((a, b) => a.order - b.order)),
      assignments: Object.freeze([...this.store.assignments.entries()].map(([, value]) => value)),
      tagCatalog: Object.freeze([...this.store.tagCatalog.entries()].map(([, value]) => value)),
      rules: Object.freeze([...this.store.rules.entries()].map(([, value]) => value).sort((a, b) => a.order - b.order)),
      recentBatches: Object.freeze([...this.store.batchRuns.entries()].map(([, value]) => value).filter(value => value.createdAt >= cutoff).sort((a, b) => b.createdAt - a.createdAt)),
    })
  }

  async setAssignment(input: SetAssignmentInputV1): Promise<{ readonly ok: true; readonly assignment: SessionOrganizationAssignmentV1 } | OrganizationFailureV1> {
    if (input.sessionId === '' || input.workspaceRef === '') return failure('invalid-input', 'sessionId and workspaceRef are required')
    const current = this.store.assignments.get(input.sessionId)
    if (!versionMatches(current?.version, input.ifVersion)) return failure('version-conflict', 'assignment version changed')
    if (input.functionTypeId !== null && !(await this.hasFunctionType(input.functionTypeId, input.workspaceRef))) {
      return failure('not-found', 'function type is not available in this workspace')
    }
    const assignment: SessionOrganizationAssignmentV1 = Object.freeze({
      sessionId: input.sessionId,
      workspaceRef: input.workspaceRef,
      functionTypeId: input.functionTypeId,
      functionSource: 'manual',
      functionLocked: input.functionLocked,
      tagsLocked: input.tagsLocked,
      classificationStatus: input.functionTypeId === null ? 'unclassified' : 'classified',
      confidence: null,
      version: this.newId(),
      updatedAt: this.now(),
    })
    await this.store.assignments.put(input.sessionId, assignment)
    return { ok: true, assignment }
  }

  async putFunctionType(input: PutFunctionTypeInputV1): Promise<{ readonly ok: true; readonly value: FunctionTypeV1 } | OrganizationFailureV1> {
    const current = this.store.functionTypes.get(input.value.id)
    if (!versionMatches(current?.version, input.ifVersion)) return failure('version-conflict', 'function type version changed')
    if (input.value.id === '' || input.value.name.trim() === '') return failure('invalid-input', 'function id and name are required')
    const value: FunctionTypeV1 = Object.freeze({ ...input.value, name: input.value.name.trim(), version: this.newId(), updatedAt: this.now() })
    await this.store.functionTypes.put(value.id, value)
    return { ok: true, value }
  }

  async putTagCatalog(input: PutTagCatalogInputV1): Promise<{ readonly ok: true; readonly value: TagCatalogEntryV1 } | OrganizationFailureV1> {
    const normalized = normalizeTags([input.value.name])
    if (!normalized.ok) return failure('invalid-input', normalized.reasons.join(','))
    const name = normalized.tags[0]
    if (name === undefined) return failure('invalid-input', 'tag name is required')
    const key = catalogKey(input.value.scope, name)
    const current = this.store.tagCatalog.get(key)
    if (!versionMatches(current?.version, input.ifVersion)) return failure('version-conflict', 'tag catalog version changed')
    const value: TagCatalogEntryV1 = Object.freeze({ ...input.value, name, version: this.newId(), updatedAt: this.now() })
    await this.store.tagCatalog.put(key, value)
    return { ok: true, value }
  }

  async putRule(input: PutRuleInputV1): Promise<{ readonly ok: true; readonly value: OrganizationRuleV1 } | OrganizationFailureV1> {
    const current = this.store.rules.get(input.value.id)
    if (!versionMatches(current?.version, input.ifVersion)) return failure('version-conflict', 'rule version changed')
    if (input.value.id === '' || input.value.name.trim() === '') return failure('invalid-input', 'rule id and name are required')
    const value: OrganizationRuleV1 = Object.freeze({ ...input.value, name: input.value.name.trim(), version: this.newId(), updatedAt: this.now() })
    await this.store.rules.put(value.id, value)
    return { ok: true, value }
  }

  async classify(input: {
    readonly sessionId: string
    readonly workspaceRef: string
    readonly title: string
    readonly userMessages: readonly string[]
    readonly force?: boolean | undefined
  }): Promise<{ readonly ok: true; readonly assignment: SessionOrganizationAssignmentV1; readonly tags: readonly string[] } | OrganizationFailureV1> {
    if (this.classifier === undefined) return failure('not-available', 'organization classifier is not configured')
    const current = this.store.assignments.get(input.sessionId)
    if (current !== undefined && current.classificationStatus !== 'unclassified' && input.force !== true) {
      const tagRows = await this.tags.list()
      return { ok: true, assignment: current, tags: tagRows.ok ? (tagRows.entries.find(item => item.sessionId === input.sessionId)?.row.tags ?? []) : [] }
    }
    const snapshot = await this.snapshot()
    const tagRows = await this.tags.list()
    if (!tagRows.ok) return failure('storage-unavailable', tagRows.message)
    const existing = tagRows.entries.find(item => item.sessionId === input.sessionId)
    const knownTags = new Set(snapshot.tagCatalog.filter(item => item.active && item.aliasTo === undefined).map(item => item.name))
    for (const row of tagRows.entries) for (const tag of row.row.tags) knownTags.add(tag)
    const candidate = await this.classifier.classify({
      title: input.title,
      userMessages: input.userMessages,
      functionTypes: snapshot.functionTypes.filter(item => item.active && (item.scope.kind === 'global' || item.scope.workspaceRef === input.workspaceRef)),
      knownTags: [...knownTags],
    })
    const policy = applyClassificationPolicy({
      sessionId: input.sessionId,
      assignment: current,
      workspaceRef: input.workspaceRef,
      candidate,
      knownFunctionTypeIds: new Set(snapshot.functionTypes
        .filter(item => item.active && (item.scope.kind === 'global' || item.scope.workspaceRef === input.workspaceRef))
        .map(item => item.id)),
      knownTags,
      now: this.now(),
      newVersion: this.newId,
    })
    if (!policy.ok) return failure('invalid-input', policy.message)
    await this.store.assignments.put(input.sessionId, policy.assignment)
    let tags = existing?.row.tags ?? []
    if (!policy.assignment.tagsLocked && policy.assignment.classificationStatus === 'classified') {
      const set = await this.tags.set({ sessionId: input.sessionId, tags: policy.acceptedTags, ifVersion: existing?.row.version ?? null })
      if (!set.ok) return failure(set.code === 'version-conflict' ? 'version-conflict' : 'storage-unavailable', set.message)
      tags = set.tags
      for (const name of policy.createdTags) {
        const key = catalogKey({ kind: 'workspace', workspaceRef: input.workspaceRef }, name)
        if (this.store.tagCatalog.get(key) === undefined) {
          await this.store.tagCatalog.put(key, Object.freeze({
            name,
            color: 'muted',
            scope: Object.freeze({ kind: 'workspace', workspaceRef: input.workspaceRef }),
            active: true,
            version: this.newId(),
            updatedAt: this.now(),
          }))
        }
      }
    }
    return { ok: true, assignment: policy.assignment, tags }
  }

  async planBatch(input: { readonly targets: readonly { readonly sessionId: string; readonly workspaceRef: string }[]; readonly action: BatchActionV1 }): Promise<{ readonly ok: true; readonly plan: BatchPlanV1 } | OrganizationFailureV1> {
    const deduped = new Map(input.targets.filter(target => target.sessionId !== '' && target.workspaceRef !== '').map(target => [target.sessionId, target]))
    const targets = [...deduped.values()]
    if (targets.length === 0) return failure('invalid-input', 'batch needs at least one session')
    if ('tags' in input.action && !normalizeTags(input.action.tags).ok) return failure('invalid-input', 'batch tags are invalid')
    const tagRows = await this.tags.list()
    if (!tagRows.ok) return failure('storage-unavailable', tagRows.message)
    const tagsBySession = new Map(tagRows.entries.map(item => [item.sessionId, item.row]))
    const now = this.now()
    const plan: BatchPlanV1 = Object.freeze({
      id: this.newId(),
      decisionRef: this.newId(),
      action: input.action,
      targets: Object.freeze(targets.map(target => Object.freeze({
        sessionId: target.sessionId,
        workspaceRef: target.workspaceRef,
        assignmentVersion: this.store.assignments.get(target.sessionId)?.version ?? null,
        tagsVersion: tagsBySession.get(target.sessionId)?.version ?? null,
      }))),
      createdAt: now,
      expiresAt: now + 10 * 60 * 1000,
      ...(input.action.type === 'purge' ? { confirmationText: `DELETE ${targets.length}` } : {}),
    })
    this.plans.set(plan.id, plan)
    return { ok: true, plan }
  }

  unlockAdmin(): { readonly ok: true; readonly token: string; readonly expiresAt: number } {
    return { ok: true, ...this.admin.unlock(this.now()) }
  }

  async executeBatch(input: {
    readonly planId: string
    readonly decisionRef: string
    readonly confirmationText?: string | undefined
    readonly adminToken?: string | undefined
  }): Promise<{ readonly ok: true; readonly receipt: BatchReceiptV1 } | OrganizationFailureV1> {
    const plan = this.plans.get(input.planId)
    if (plan === undefined || plan.decisionRef !== input.decisionRef || plan.expiresAt <= this.now()) return failure('stale-decision', 'batch plan is missing or expired')
    if (plan.action.type === 'purge') {
      if (!this.admin.verify(input.adminToken, this.now())) return failure('admin-required', 'temporary administrator unlock is required')
      if (input.confirmationText !== plan.confirmationText) return failure('invalid-input', 'purge confirmation text does not match')
    }
    const items: BatchItemReceiptV1[] = []
    for (const target of plan.targets) items.push(await this.executeBatchItem(plan.action, target))
    const okCount = items.filter(item => item.status === 'ok').length
    const receipt: BatchReceiptV1 = Object.freeze({
      id: this.newId(),
      planId: plan.id,
      action: plan.action,
      status: okCount === items.length ? 'ok' : okCount === 0 ? 'rejected' : 'partial',
      items: Object.freeze(items),
      createdAt: this.now(),
      undoExpiresAt: plan.action.type === 'purge' ? null : this.now() + SESSION_ORGANIZATION_BATCH_RETENTION_MS,
    })
    await this.store.batchRuns.put(receipt.id, receipt)
    this.plans.delete(plan.id)
    return { ok: true, receipt }
  }

  async undoBatch(input: { readonly receiptId: string }): Promise<{ readonly ok: true; readonly receipt: BatchReceiptV1 } | OrganizationFailureV1> {
    const original = this.store.batchRuns.get(input.receiptId)
    if (original === undefined) return failure('not-found', 'batch receipt not found')
    if (original.undoExpiresAt === null || original.undoExpiresAt <= this.now()) return failure('stale-decision', 'batch is not undoable')
    const items: BatchItemReceiptV1[] = []
    for (const item of original.items) items.push(await this.undoBatchItem(original.action, item))
    const okCount = items.filter(item => item.status === 'ok').length
    const receipt: BatchReceiptV1 = Object.freeze({
      id: this.newId(),
      planId: `undo:${original.id}`,
      action: original.action,
      status: okCount === items.length ? 'ok' : okCount === 0 ? 'rejected' : 'partial',
      items: Object.freeze(items),
      createdAt: this.now(),
      undoExpiresAt: null,
    })
    await this.store.batchRuns.put(receipt.id, receipt)
    return { ok: true, receipt }
  }

  private async executeBatchItem(action: BatchActionV1, target: BatchPlanV1['targets'][number]): Promise<BatchItemReceiptV1> {
    const currentAssignment = this.store.assignments.get(target.sessionId)
    if ((currentAssignment?.version ?? null) !== target.assignmentVersion) return { sessionId: target.sessionId, status: 'stale', reason: 'assignment changed after preview' }
    const tagRows = await this.tags.list()
    if (!tagRows.ok) return { sessionId: target.sessionId, status: 'not_available', reason: tagRows.message }
    const currentTags = tagRows.entries.find(item => item.sessionId === target.sessionId)?.row
    if ((currentTags?.version ?? null) !== target.tagsVersion) return { sessionId: target.sessionId, status: 'stale', reason: 'tags changed after preview' }
    if (action.type === 'set-function') {
      const result = await this.setAssignment({
        sessionId: target.sessionId,
        workspaceRef: currentAssignment?.workspaceRef ?? target.workspaceRef,
        functionTypeId: action.functionTypeId,
        functionLocked: true,
        tagsLocked: currentAssignment?.tagsLocked ?? false,
        ifVersion: target.assignmentVersion,
      })
      return result.ok
        ? { sessionId: target.sessionId, status: 'ok', beforeAssignment: currentAssignment ?? null, afterAssignment: result.assignment }
        : { sessionId: target.sessionId, status: 'rejected', reason: result.message }
    }
    if (action.type === 'add-tags' || action.type === 'remove-tags') {
      const source = currentTags?.tags ?? []
      const remove = new Set(action.type === 'remove-tags' ? action.tags : [])
      const targetTags = source.filter(tag => !remove.has(tag))
      if (action.type === 'add-tags') for (const tag of action.tags) if (!targetTags.includes(tag)) targetTags.push(tag)
      const result = await this.tags.set({ sessionId: target.sessionId, tags: targetTags, ifVersion: currentTags?.version ?? null })
      return result.ok
        ? { sessionId: target.sessionId, status: 'ok', beforeTags: source, afterTags: result.tags }
        : { sessionId: target.sessionId, status: result.code === 'version-conflict' ? 'conflict' : 'rejected', reason: result.message }
    }
    if (this.lifecycle === undefined) return { sessionId: target.sessionId, status: 'not_available', reason: 'DSH lifecycle owner is not configured' }
    const result = await this.lifecycle.mutate({ sessionId: target.sessionId, action: action.type })
    return { sessionId: target.sessionId, status: result.status === 'ok' ? 'ok' : result.status, ...(result.reason === undefined ? {} : { reason: result.reason }) }
  }

  private async undoBatchItem(action: BatchActionV1, item: BatchItemReceiptV1): Promise<BatchItemReceiptV1> {
    if (item.status !== 'ok') return { sessionId: item.sessionId, status: 'rejected', reason: 'original item did not complete' }
    if (action.type === 'set-function') {
      const current = this.store.assignments.get(item.sessionId)
      if (current?.version !== item.afterAssignment?.version) return { sessionId: item.sessionId, status: 'conflict', reason: 'assignment changed after batch' }
      const before = item.beforeAssignment
      let restored: SessionOrganizationAssignmentV1 | null = null
      if (before === undefined || before === null) {
        await this.store.assignments.delete(item.sessionId)
      } else {
        restored = Object.freeze({ ...before, version: this.newId(), updatedAt: this.now() })
        await this.store.assignments.put(item.sessionId, restored)
      }
      return { sessionId: item.sessionId, status: 'ok', beforeAssignment: current, afterAssignment: restored }
    }
    if (action.type === 'add-tags' || action.type === 'remove-tags') {
      const rows = await this.tags.list()
      if (!rows.ok) return { sessionId: item.sessionId, status: 'not_available', reason: rows.message }
      const current = rows.entries.find(entry => entry.sessionId === item.sessionId)?.row
      if (!sameStrings(current?.tags ?? [], item.afterTags ?? [])) return { sessionId: item.sessionId, status: 'conflict', reason: 'tags changed after batch' }
      const result = await this.tags.set({ sessionId: item.sessionId, tags: item.beforeTags ?? [], ifVersion: current?.version ?? null })
      return result.ok
        ? { sessionId: item.sessionId, status: 'ok', beforeTags: current?.tags ?? [], afterTags: result.tags }
        : { sessionId: item.sessionId, status: 'conflict', reason: result.message }
    }
    if (action.type === 'purge') return { sessionId: item.sessionId, status: 'rejected', reason: 'purge cannot be undone' }
    if (this.lifecycle === undefined) return { sessionId: item.sessionId, status: 'not_available', reason: 'DSH lifecycle owner is not configured' }
    const inverse = action.type === 'archive' ? 'restore' : 'archive'
    const result = await this.lifecycle.mutate({ sessionId: item.sessionId, action: inverse })
    return { sessionId: item.sessionId, status: result.status === 'ok' ? 'ok' : result.status, ...(result.reason === undefined ? {} : { reason: result.reason }) }
  }

  private async hasFunctionType(id: string, workspaceRef: string): Promise<boolean> {
    const snapshot = await this.snapshot()
    return snapshot.functionTypes.some(item => item.id === id && item.active && (item.scope.kind === 'global' || item.scope.workspaceRef === workspaceRef))
  }
}

function versionMatches(current: string | undefined, expected: string | null): boolean {
  return expected === null ? current === undefined : current === expected
}

function catalogKey(scope: TagCatalogEntryV1['scope'], name: string): string {
  return scope.kind === 'global' ? `global:${name}` : `workspace:${scope.workspaceRef}:${name}`
}

function failure(code: OrganizationFailureV1['code'], message: string): OrganizationFailureV1 {
  return { ok: false, code, message }
}

function sameStrings(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}
