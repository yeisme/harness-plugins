import { AuctraRecoveryLoader } from './auctra-recovery-loader.tsx'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { CandidateHistory } from './candidate-history.tsx'
import { OperationRecoveryNotice } from './operation-recovery-notice.tsx'
import { Button, CodeBlock, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ArtifactRefV1, PaneActionReceiptV1, PaneActionDescriptorV1, PaneActionValueV1 } from '@yeisme/dsh-pane-protocol'
import type {
  CreatorArtifactActionBindingV1,
  CreatorArtifactCandidateV1,
  CreatorArtifactReferenceProofV1,
  CreatorArtifactWorkspaceItemV1,
  CreatorOwnerProjectionV1,
  CreatorStudioSnapshotV1,
} from '@yeisme/dsh-creator-studio-host/contracts'
import {
  type ComposerReferenceAddToMainDetailV1,
  type ComposerReferenceAddToMainResultV1,
  type ComposerReferenceBridgeV1,
  type ComposerReferenceTargetV2,
  type ComposerReferenceV2,
} from '@yeisme/dsh-client-ui-pane-workbench'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import {
  LocalTableGrid,
  LOCAL_TABLE_BUDGET,
  columnsFromHeaderRow,
  MediaCompareRenderer,
  MediaImageRenderer,
  MediaPlaybackRenderer,
  StaticHtmlPreview,
  parseDelimitedTable,
  type MediaImageSelectionV1,
  type MediaRefV1,
  type MediaTimeSelectionV1,
} from '@yeisme/dsh-rich-media/client'
import type { CreatorStudioViewState } from './controller.ts'
import type { CreatorStudioRuntimeV1 } from './runtime.ts'
import { CreatorArtifactAutoSave } from './artifact-auto-save.tsx'
import { useArtifactReadingPosition } from './artifact-reading-position.ts'
import { CreatorActionComposer } from './projection-components.tsx'
import { defaultCreatorStudioTranslator, type CreatorStudioKey, type CreatorStudioTranslator } from './locales.ts'

const ARTIFACT_VIEWS = ['preview', 'source', 'compare'] as const
type ArtifactView = typeof ARTIFACT_VIEWS[number]
type LifecycleAction = 'saveDraft' | 'createCandidate' | 'compare' | 'adopt' | 'writeback' | 'attachContext' | 'openEnvironment'
type MediaSelection = { readonly kind: 'image'; readonly region: MediaImageSelectionV1 } | { readonly kind: 'time'; readonly range: MediaTimeSelectionV1 } | { readonly kind: 'unavailable' }
type BodyState = { readonly status: 'loading' | 'ready' | 'error' | 'unavailable'; readonly content?: string; readonly contentRevision?: string }
type PersistedSubmission = { readonly key: string; readonly artifact: ArtifactRefV1; readonly body: string; readonly contentRevision: string }
type LifecyclePending = { readonly origin: { readonly artifact: ArtifactRefV1; readonly candidateRef?: string; readonly candidateVersion?: string; readonly contextEpoch: string }; readonly descriptorRef: string; readonly action: LifecycleAction; readonly submission?: PersistedSubmission; readonly promise: Promise<PaneActionReceiptV1>; handled: boolean }
export type CreatorComposerBridge = Pick<ComposerReferenceBridgeV1, 'snapshot'> & {
  readonly insertReference?: (detail: ComposerReferenceAddToMainDetailV1, signal?: AbortSignal) => Promise<ComposerReferenceAddToMainResultV1>
  readonly referenceInsertion?: (input: { readonly requestId: string; readonly target: Pick<ComposerReferenceTargetV2, 'workspaceId' | 'conversationId'> }) =>
    | { readonly status: 'unknown' | 'pending' }
    | { readonly status: 'settled'; readonly receipt: ComposerReferenceAddToMainResultV1 }
}
export const CREATOR_COMPOSER_INSERT_TIMEOUT_MS = 10_000
const PANE_ACTION_STRING_LIMIT = 16_384

const ACTION_KEYS: Record<LifecycleAction, CreatorStudioKey> = {
  saveDraft: 'workspace.action.saveDraft', createCandidate: 'workspace.action.createCandidate', compare: 'workspace.action.compare',
  adopt: 'workspace.action.adopt', writeback: 'workspace.action.writeback', attachContext: 'workspace.action.attachContext',
  openEnvironment: 'workspace.action.openEnvironment',
}

function mediaKind(artifact: ArtifactRefV1): MediaRefV1['kind'] {
  if (artifact.mediaType.startsWith('image/')) return 'image'
  if (artifact.mediaType.startsWith('audio/')) return 'audio'
  if (artifact.mediaType.startsWith('video/')) return 'video'
  if (artifact.mediaType === 'application/pdf') return 'pdf'
  if (artifact.mediaType.startsWith('text/')) return 'text'
  return 'file'
}

function mediaOf(artifact: ArtifactRefV1, item?: CreatorArtifactWorkspaceItemV1): MediaRefV1 {
  return {
    owner: artifact.owner, ref: artifact.ref, version: artifact.version, mediaType: artifact.mediaType, title: artifact.title, kind: mediaKind(artifact),
    ...(item?.media?.width === undefined ? {} : { width: item.media.width }), ...(item?.media?.height === undefined ? {} : { height: item.media.height }),
    ...(item?.media?.durationMs === undefined ? {} : { duration: item.media.durationMs }),
    capabilities: artifact.capabilities.filter((capability): capability is MediaRefV1['capabilities'][number] => ['open', 'preview', 'play', 'download', 'extract_text'].includes(capability)),
  }
}

function selectedAction(item: CreatorArtifactWorkspaceItemV1, action: LifecycleAction): CreatorArtifactActionBindingV1 | undefined { return item.actions?.[action] }
function artifactKey(artifact: ArtifactRefV1, contextEpoch: string): string { return JSON.stringify([contextEpoch, artifact.owner, artifact.ref, artifact.version]) }
const restoredDrafts = new Map<string, string>()
function draftRecord(draftKey: string): readonly [string, string, string, string] | undefined {
  try {
    const parsed = JSON.parse(draftKey)
    return Array.isArray(parsed) && parsed.length === 4 && parsed.every(item => typeof item === 'string') ? parsed as [string, string, string, string] : undefined
  } catch { return undefined }
}
function persistableDraft(draftKey: string, contextEpoch: string): boolean {
  const parsed = draftRecord(draftKey)
  return parsed !== undefined && parsed[0] === contextEpoch && parsed[1] === 'auctra'
}
function bodyContextEpoch(owner: CreatorOwnerProjectionV1, snapshot: CreatorStudioSnapshotV1): string {
  const context = snapshot.context ?? owner.context
  return JSON.stringify(context === undefined ? { missing: true, studioSnapshotRef: snapshot.snapshotRef, ownerSnapshotRef: owner.snapshotRef } : {
    tenantRef: context.tenantRef,
    workspaceRef: context.workspaceRef,
    projectRef: context.projectRef,
    sessionRef: context.sessionRef,
    principalRef: context.principalRef,
    revision: context.revision,
    membershipRevision: context.membershipRevision,
    installationRef: context.installationRef,
    pluginDigest: context.pluginDigest,
    policyRevision: context.policyRevision,
    runtimeGeneration: context.runtimeGeneration,
  })
}
function targetMatches(left: ComposerReferenceTargetV2, right: ComposerReferenceTargetV2): boolean { return left.workspaceId === right.workspaceId && left.conversationId === right.conversationId && left.draftRevision === right.draftRevision }
function fallbackWorkspaceItems(owner: CreatorOwnerProjectionV1): readonly CreatorArtifactWorkspaceItemV1[] { return owner.resources.flatMap(resource => resource.artifact === undefined ? [] : [{ artifact: resource.artifact, acceptedVersion: resource.artifact.version, ...(resource.textPreview === undefined ? {} : { textPreview: resource.textPreview }), candidates: [] }]) }

function TextComparison({ item, candidate, t, currentBody, candidateBody }: { readonly currentBody?: BodyState | undefined; readonly candidateBody?: BodyState | undefined; readonly item: CreatorArtifactWorkspaceItemV1; readonly candidate: CreatorArtifactCandidateV1; readonly t: CreatorStudioTranslator }) {
  const explicit = candidate.artifact !== undefined
  const current = explicit ? currentBody?.status === 'ready' ? currentBody.content : undefined : item.textPreview?.after ?? item.textPreview?.before
  const next = explicit ? candidateBody?.status === 'ready' ? candidateBody.content : undefined : candidate.textPreview?.after ?? candidate.textPreview?.before
  if (current === undefined || next === undefined) return <SurfaceState phase="disabled" title={t('workspace.compareTextUnavailable')} description={t('workspace.compareTextUnavailable.description')} />
  return <div className="cs-diff" data-creator-artifact-text-compare><pre data-side="before">{current}</pre><pre data-side="after">{next}</pre></div>
}

/** Own only temporary URLs returned for this preview, including late resolutions. */
function previewUrlLease() {
  const urls = new Set<string>()
  let closed = false
  return {
    retain(url: string | undefined) {
      if (url?.startsWith('blob:') !== true || urls.has(url)) return
      urls.add(url)
      if (closed) URL.revokeObjectURL(url)
    },
    dispose() {
      if (closed) return
      closed = true
      for (const url of urls) URL.revokeObjectURL(url)
    },
  }
}

function ImageComparison({ current, candidate, runtime, t }: { readonly current: ArtifactRefV1; readonly candidate: ArtifactRefV1; readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact'>; readonly t: CreatorStudioTranslator }) {
  const [urls, setUrls] = useState<readonly [string, string]>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    const lease = previewUrlLease()
    setUrls(undefined); setError(undefined)
    void Promise.all([current, candidate].map(artifact => runtime.resolveArtifact(artifact).then(url => { lease.retain(url); return url }))).then(next => {
      if (!live) return
      if (next[0] === undefined || next[1] === undefined) { lease.dispose(); setError(t('workspace.compareMediaUnavailable')) }
      else setUrls([next[0], next[1]])
    }).catch(() => { lease.dispose(); if (live) setError(t('workspace.compareMediaError')) })
    return () => { live = false; lease.dispose() }
  }, [candidate, current, runtime, t])
  if (error !== undefined) return <SurfaceState phase="disabled" title={error} />
  if (urls === undefined) return <SurfaceState phase="loading" title={t('workspace.compareMediaLoading')} />
  return <MediaCompareRenderer left={{ url: urls[0], label: current.title, version: current.version }} right={{ url: urls[1], label: candidate.title, version: candidate.version }} />
}

function CandidateComparison({ item, candidate, runtime, t, currentBody, candidateBody }: { readonly currentBody?: BodyState | undefined; readonly candidateBody?: BodyState | undefined; readonly item: CreatorArtifactWorkspaceItemV1; readonly candidate: CreatorArtifactCandidateV1; readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact'>; readonly t: CreatorStudioTranslator }) {
  if (item.artifact.mediaType.startsWith('image/') && candidate.artifact?.mediaType.startsWith('image/')) return <ImageComparison current={item.artifact} candidate={candidate.artifact} runtime={runtime} t={t} />
  return <TextComparison item={item} candidate={candidate} t={t} currentBody={currentBody} candidateBody={candidateBody} />
}

function TextDraftPreview({ artifact, body, t }: { readonly artifact: ArtifactRefV1; readonly body: string; readonly t: CreatorStudioTranslator }) {
  const type = artifact.mediaType.toLowerCase()
  const codeLabels = { copyLabel: t('workspace.code.copy'), copiedLabel: t('workspace.code.copied') }
  const markdownProps = { labels: { code: codeLabels, footnotes: t('workspace.code.footnotes') } }
  if (type === 'text/html' || type === 'application/xhtml+xml') return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="static-html"><StaticHtmlPreview source={body} labels={{ title: t('workspace.html.title'), notice: t('workspace.html.notice'), loading: t('workspace.html.loading'), empty: t('workspace.html.empty'), unavailable: t('workspace.html.unavailable'), tooLarge: t('workspace.html.tooLarge') }} /></div>
  if (type === 'text/markdown' || type === 'text/x-markdown') return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="markdown"><MarkdownText text={body} {...markdownProps} /></div>
  if (type === 'text/csv' || type === 'text/tab-separated-values') {
    const parsed = parseDelimitedTable(body, type === 'text/tab-separated-values' ? '\t' : ',')
    const diagnostic = parsed.diagnostic
    const bounded = parsed.truncated || parsed.rows.length > LOCAL_TABLE_BUDGET.rows || parsed.rows.some(row => row.some(cell => cell.length > LOCAL_TABLE_BUDGET.cell))
    return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="table">
      {diagnostic !== undefined ? <SurfaceState phase="error" title={t('workspace.table.invalid', { position: diagnostic.offset + 1 })} description={t('workspace.table.recover')} /> : <>
        {bounded && <SurfaceState phase="partial" title={t('workspace.table.bounded')} description={t('workspace.table.recover')} />}
        <LocalTableGrid media={mediaOf(artifact)} rows={parsed.rows.slice(1)} columns={columnsFromHeaderRow(parsed.rows[0])} />
      </>}
    </div>
  }
  if (type.includes('mermaid') || artifact.kind === 'diagram') return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="mermaid"><MarkdownText text={`\`\`\`mermaid\n${body}\n\`\`\``} {...markdownProps} /></div>
  const lang = type.includes('javascript') ? 'javascript' : type.includes('typescript') ? 'typescript' : undefined
  return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="code"><CodeBlock code={body} {...codeLabels} {...(lang === undefined ? {} : { lang })} /></div>
}

function ResolvedMediaPreview({ artifact, item, runtime, selection, onSelectionChange, t }: { readonly artifact: ArtifactRefV1; readonly item: CreatorArtifactWorkspaceItemV1; readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact'>; readonly selection: MediaSelection; readonly onSelectionChange: (selection: MediaSelection) => void; readonly t: CreatorStudioTranslator }) {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    const lease = previewUrlLease()
    setUrl(undefined); setError(undefined)
    void runtime.resolveArtifact(artifact).then(next => { lease.retain(next); if (!live) return; if (next === undefined) setError(t('media.unauthorized')); else setUrl(next) }).catch(() => { if (live) setError(t('media.unauthorized')) })
    return () => { live = false; lease.dispose() }
  }, [artifact, runtime, t])
  if (error !== undefined) return <SurfaceState phase="disabled" title={error} />
  if (url === undefined) return <SurfaceState phase="loading" title={t('workspace.loadingBody')} />
  const media = mediaOf(artifact, item)
  if (media.kind === 'image') return <MediaImageRenderer media={media} url={url} selection={selection.kind === 'image' ? selection.region : undefined} onSelectionChange={region => onSelectionChange({ kind: 'image', region })} labels={{ selection: t('workspace.imageSelection'), cropPreview: t('workspace.cropPreview'), inspectMode: t('workspace.image.inspect'), selectMode: t('workspace.image.select'), interactionMode: t('workspace.image.interaction'), selectionHint: t('workspace.image.selectionHint'), fit: t('workspace.image.fit'), fill: t('workspace.image.fill'), actual: t('workspace.image.actual'), zoomIn: t('workspace.image.zoomIn'), zoomOut: t('workspace.image.zoomOut'), rotate: t('workspace.image.rotate'), tooLarge: t('workspace.image.tooLarge'), playAnimation: t('workspace.image.playAnimation'), noDescription: t('workspace.image.noDescription'), background: t('workspace.image.background'), metadata: t('workspace.image.metadata'), panLeft: t('workspace.image.panLeft'), panRight: t('workspace.image.panRight'), backgroundDark: t('workspace.image.dark'), backgroundLight: t('workspace.image.light'), backgroundChecker: t('workspace.image.checker'), zoom: t('workspace.image.zoom') }} />
  if (media.kind === 'audio' || media.kind === 'video') return <MediaPlaybackRenderer media={media} url={url} allowBlobUrl={url.startsWith('blob:')} selection={selection.kind === 'time' ? selection.range : undefined} labels={{ playSelection: t('workspace.playSelection') }} />
  return <SurfaceState phase="disabled" title={t('media.unauthorized')} />
}

function defaultSelection(item: CreatorArtifactWorkspaceItemV1): MediaSelection { return item.artifact.mediaType.startsWith('image/') ? { kind: 'image', region: { x: 0, y: 0, width: 1, height: 1 } } : item.media?.durationMs === undefined ? { kind: 'unavailable' } : { kind: 'time', range: { startMs: 0, endMs: item.media.durationMs } } }
function rangeValue(selection: MediaSelection): string | undefined { return selection.kind === 'image' ? JSON.stringify({ kind: 'image', ...selection.region }) : selection.kind === 'time' ? JSON.stringify({ kind: 'time', ...selection.range }) : undefined }

function buildComposerReference(input: { readonly artifact: ArtifactRefV1; readonly proof: CreatorArtifactReferenceProofV1; readonly selection: MediaSelection }): ComposerReferenceV2 | undefined {
  if (input.selection.kind === 'image') {
    const region = input.selection.region
    if (input.proof.scope !== 'artifact/media' || !['image', 'image-region'].includes(input.proof.kind)) return undefined
    if (input.proof.kind === 'image' && (region.x !== 0 || region.y !== 0 || region.width !== 1 || region.height !== 1)) return undefined
  }
  return {
    id: input.proof.id, kind: input.proof.kind, intent: input.proof.intent, owner: input.artifact.owner, ref: input.artifact.ref, version: input.artifact.version,
    label: input.artifact.title, scope: input.proof.scope, digest: input.proof.digest, freshness: input.proof.freshness,
    ...(input.proof.unavailableReason === undefined ? {} : { unavailableReason: input.proof.unavailableReason }),
    ...(input.selection.kind === 'image' && input.proof.kind === 'image-region' ? { region: input.selection.region } : input.selection.kind === 'time' ? { window: { start: input.selection.range.startMs, end: input.selection.range.endMs } } : {}),
  }
}

/** Conversation-adjacent artifact editor. Durable facts remain owner-backed. */
export function CreatorArtifactWorkspace({ owner, snapshot, state, runtime, composerBridge, t = defaultCreatorStudioTranslator, onDirty }: {
  readonly owner: CreatorOwnerProjectionV1
  readonly snapshot: CreatorStudioSnapshotV1
  readonly state: CreatorStudioViewState
  readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact' | 'readArtifactContent' | 'readCandidatePage' | 'dispatchAction' | 'reconcileAction' | 'listOperationRecoveries' | 'reconcileStoredOperation' | 'listAuctraRecoveryDrafts' | 'readAuctraRecoveryDraft' | 'saveAuctraRecoveryDraft'>
  readonly composerBridge?: CreatorComposerBridge
  readonly t?: CreatorStudioTranslator
  readonly onDirty?: (dirty: boolean) => void
}): ReactNode {
  const workspace = owner.artifactWorkspace
  const contextEpoch = bodyContextEpoch(owner, snapshot)
  const contextVisit = useMemo(() => Symbol('creator-context-visit'), [contextEpoch])
  const currentContextVisit = useRef(contextVisit)
  const sourceItems: readonly CreatorArtifactWorkspaceItemV1[] = workspace?.artifacts ?? fallbackWorkspaceItems(owner)
  const [savedViews, setSavedViews] = useState<Readonly<Record<string, ArtifactRefV1>>>({})
  const [historyPage, setHistoryPage] = useState<{ key: string; candidates: readonly CreatorArtifactCandidateV1[] }>()
  const viewKey = (artifact: ArtifactRefV1) => JSON.stringify([contextEpoch, artifact.owner, artifact.ref])
  const items = sourceItems.map(item => {
    const saved = savedViews[viewKey(item.artifact)]
    if (saved === undefined || saved.version === item.artifact.version) return item
    // A confirmed local save advances this editor view, not owner adoption or Canon.
    // Old action/provenance bindings cannot be applied to the newly saved version.
    const { actions: _actions, referenceProof: _proof, textPreview: _preview, ...rest } = item
    return { ...rest, artifact: saved, acceptedVersion: saved.version }
  })
  const [selectedRef, setSelectedRef] = useState(items[0]?.artifact.ref)
  const [view, setView] = useState<ArtifactView>('preview')
  const viewId = useId()
  const tabsRef = useRef<HTMLDivElement>(null)
  const [bodies, setBodies] = useState<Readonly<Record<string, BodyState>>>({})
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>(() => {
    const restored: Record<string, string> = {}
    for (const [draftKey, body] of restoredDrafts) {
      if (persistableDraft(draftKey, contextEpoch)) restored[draftKey] = body
    }
    return restored
  })
  const [candidateRef, setCandidateRef] = useState<string>()
  const [action, setAction] = useState<LifecycleAction>()
  const [selections, setSelections] = useState<Readonly<Record<string, MediaSelection>>>({})
  const [annotations, setAnnotations] = useState<Readonly<Record<string, string>>>({})
  const [composerMessage, setComposerMessage] = useState<string>()
  const [lifecyclePendingDescriptor, setLifecyclePendingDescriptor] = useState<string>()
  const [composing, setComposing] = useState(false)
  const [recoveryEpoch, setRecoveryEpoch] = useState(0)
  const bodyRequests = useRef(new Map<string, Promise<void>>())
  const mounted = useRef(true)
  const composerPending = useRef<{ readonly requestId: string; readonly target: ComposerReferenceTargetV2; readonly reference: ComposerReferenceV2; readonly status: 'pending' | 'unknown' } | undefined>(undefined)
  const composerAbort = useRef<AbortController | undefined>(undefined)
  const composerTimer = useRef<number | undefined>(undefined)
  const lifecyclePending = useRef<LifecyclePending | undefined>(undefined)
  const confirmationGeneration = useRef(new Map<string, number>())
  const contextEpochRef = useRef(contextEpoch)
  const selectedSource = items.find(item => item.artifact.ref === selectedRef) ?? items[0]
  const selected = selectedSource && historyPage?.key === artifactKey(selectedSource.artifact, contextEpoch)
    ? { ...selectedSource, candidates: historyPage.candidates } : selectedSource
  const key = selected === undefined ? undefined : artifactKey(selected.artifact, contextEpoch)
  const selectedCandidate = selected?.candidates.find(candidate => candidate.ref === candidateRef) ?? selected?.candidates[0]
  const candidateScopedAction = action === 'compare' || action === 'adopt' || action === 'writeback' || action === 'attachContext'
  const actionArtifact = candidateScopedAction ? selectedCandidate?.artifact ?? selected?.artifact : selected?.artifact
  const actionKey = actionArtifact === undefined ? undefined : artifactKey(actionArtifact, contextEpoch)
  const attachArtifact = selectedCandidate?.artifact ?? selected?.artifact
  const attachKey = attachArtifact === undefined ? undefined : artifactKey(attachArtifact, contextEpoch)

  useEffect(() => { if (selectedRef === undefined || !items.some(item => item.artifact.ref === selectedRef)) setSelectedRef(items[0]?.artifact.ref) }, [items, selectedRef])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; composerAbort.current?.abort(); composerAbort.current = undefined; if (composerTimer.current !== undefined) window.clearTimeout(composerTimer.current); composerTimer.current = undefined } }, [])
  useEffect(() => {
    if (contextEpochRef.current === contextEpoch) return
    contextEpochRef.current = contextEpoch
    currentContextVisit.current = contextVisit
    bodyRequests.current.clear()
    const restored: Record<string, string> = {}
    for (const [draftKey, body] of restoredDrafts) {
      if (persistableDraft(draftKey, contextEpoch)) restored[draftKey] = body
    }
    setBodies({}); setDrafts(restored); setSelections({}); setAnnotations({}); setSavedViews({}); setHistoryPage(undefined)
    // Detach the previous project's UI lock; its owner operation is not cancelled.
    lifecyclePending.current = undefined
    setLifecyclePendingDescriptor(undefined)
    setAction(undefined)
    confirmationGeneration.current.clear()
  }, [contextEpoch, contextVisit])
  useEffect(() => {
    setSavedViews(current => {
      const entries = Object.entries(current).filter(([entry, artifact]) => !sourceItems.some(item => viewKey(item.artifact) === entry && item.artifact.version === artifact.version))
      return entries.length === Object.keys(current).length ? current : Object.fromEntries(entries)
    })
  }, [sourceItems, contextEpoch])
  useEffect(() => {
    const artifacts = [selected?.artifact, selectedCandidate?.artifact].filter((artifact): artifact is ArtifactRefV1 => artifact !== undefined)
    for (const artifact of artifacts) {
      const bodyKey = artifactKey(artifact, contextEpoch)
      if (bodyRequests.current.has(bodyKey) || bodies[bodyKey] !== undefined) continue
      setBodies(current => current[bodyKey] === undefined ? { ...current, [bodyKey]: { status: 'loading' } } : current)
      const request = runtime.readArtifactContent(artifact).then(content => {
        if (mounted.current && currentContextVisit.current === contextVisit && contextEpochRef.current === contextEpoch) setBodies(current => ({ ...current, [bodyKey]: content === undefined ? { status: 'unavailable' } : { status: 'ready', content: content.content, contentRevision: content.contentRevision } }))
      }).catch(() => { if (mounted.current && currentContextVisit.current === contextVisit && contextEpochRef.current === contextEpoch) setBodies(current => ({ ...current, [bodyKey]: { status: 'error' } })) }).finally(() => { if (bodyRequests.current.get(bodyKey) === request) bodyRequests.current.delete(bodyKey) })
      bodyRequests.current.set(bodyKey, request)
    }
  }, [bodies, contextEpoch, contextVisit, runtime, selected?.artifact, selectedCandidate?.artifact])
  const dirty = Object.keys(drafts).length > 0 || Object.values(annotations).some(value => value.trim().length > 0) || Object.keys(selections).length > 0
  useEffect(() => {
    for (const [draftKey, body] of Object.entries(drafts)) {
      if (persistableDraft(draftKey, contextEpoch)) restoredDrafts.set(draftKey, body)
    }
    for (const draftKey of restoredDrafts.keys()) {
      if (drafts[draftKey] === undefined && persistableDraft(draftKey, contextEpoch)) restoredDrafts.delete(draftKey)
    }
  }, [contextEpoch, drafts])
  useEffect(() => { onDirty?.(dirty) }, [dirty, onDirty])
  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return
    const protect = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])
  const bodyState = key === undefined ? undefined : bodies[key]
  const readingPosition = useArtifactReadingPosition(JSON.stringify([key, view, view === 'compare' ? selectedCandidate?.ref : undefined, view === 'compare' ? selectedCandidate?.version : undefined]), contextEpoch, bodyState?.status === 'ready')
  const body = key === undefined ? undefined : drafts[key] ?? bodyState?.content
  const actionBody = actionKey === undefined ? undefined : drafts[actionKey] ?? bodies[actionKey]?.content
  const selection: MediaSelection = selected === undefined ? { kind: 'unavailable' } : key === undefined ? defaultSelection(selected) : selections[key] ?? defaultSelection(selected)
  const annotation = key === undefined ? '' : annotations[key] ?? ''
  const actionBinding = action === undefined || selected === undefined ? undefined : selectedAction(selected, action)
  const initialValues = useMemo(() => {
    if (actionBinding === undefined || selected === undefined) return undefined
    const values: Record<string, string> = {}
    if (actionBinding.contentField !== undefined && actionBody !== undefined) values[actionBinding.contentField] = actionBody
    const contentRevision = actionKey === undefined ? undefined : bodies[actionKey]?.contentRevision
    if (actionBinding.contentRevisionField !== undefined && contentRevision !== undefined) values[actionBinding.contentRevisionField] = contentRevision
    if (selectedCandidate !== undefined) {
      if (actionBinding.candidateRefField !== undefined) values[actionBinding.candidateRefField] = selectedCandidate.ref
      if (actionBinding.candidateVersionField !== undefined) values[actionBinding.candidateVersionField] = selectedCandidate.version
    }
    const sourceVersion = selectedCandidate?.sourceVersion ?? selected.sourceVersion
    if (actionBinding.sourceVersionField !== undefined && sourceVersion !== undefined) values[actionBinding.sourceVersionField] = sourceVersion
    const range = rangeValue(selection)
    if (actionBinding.rangeField !== undefined && range !== undefined) values[actionBinding.rangeField] = range
    if (actionBinding.annotationField !== undefined) values[actionBinding.annotationField] = annotation
    return values
  }, [actionBinding, actionBody, actionKey, annotation, bodies, selected, selectedCandidate, selection])
  const recoveryNotice = <OperationRecoveryNotice key={contextEpoch} owner={owner} runtime={runtime} receiptRevision={JSON.stringify([state.lastReceipt?.receiptRef, state.lastReceipt?.status])} t={t} />
  if (selected === undefined) return <>{recoveryNotice}<SurfaceState phase="empty" title={t('workspace.empty')} description={workspace?.safeMessage ?? t('action.unavailable.description')} data-creator-artifact-workspace /></>
  const contentIssue = (next: LifecycleAction): { readonly min: number; readonly max: number; readonly bytes?: 'utf8' } | undefined => {
    const binding = selectedAction(selected, next)
    if (binding?.contentField === undefined) return undefined
    const descriptor = owner.actions.find(candidate => candidate.descriptorRef === binding.descriptorRef)
    const field = descriptor?.fields.find(candidate => candidate.key === binding.contentField)
    const candidateScoped = next === 'compare' || next === 'adopt' || next === 'writeback' || next === 'attachContext'
    const artifact = candidateScoped ? selectedCandidate?.artifact ?? selected.artifact : selected.artifact
    const bodyKey = artifactKey(artifact, contextEpoch)
    const content = drafts[bodyKey] ?? bodies[bodyKey]?.content
    if (content === undefined) return undefined
    const min = field?.minLength ?? 0
    const max = descriptor?.textBody?.field === binding.contentField ? descriptor.textBody.maxBytes : Math.min(field?.maxLength ?? PANE_ACTION_STRING_LIMIT, PANE_ACTION_STRING_LIMIT)
    if (descriptor?.textBody?.field === binding.contentField && new TextEncoder().encode(content).byteLength > max) return { min, max, bytes: 'utf8' }
    return content.length < min || content.length > max ? { min, max } : undefined
  }
  const selectedContentIssue = action === undefined ? undefined : contentIssue(action)

  const requestComposerInsert = (receipt: PaneActionReceiptV1): void => {
    if (action !== 'attachContext' || (receipt.status !== 'accepted' && receipt.status !== 'completed')) return
    if (composerPending.current !== undefined) { setComposerMessage(t('workspace.composerUnknown')); return }
    const bridge = composerBridge?.snapshot()
    if (bridge?.available !== true || composerBridge?.insertReference === undefined) { setComposerMessage(t('workspace.composerMissing')); return }
    if (bridge.target === undefined) { setComposerMessage(t('workspace.composerTargetMissing')); return }
    const proof = selectedCandidate?.referenceProof ?? selected.referenceProof
    if (proof === undefined || actionArtifact === undefined) { setComposerMessage(t('workspace.referenceProofMissing')); return }
    if (actionKey !== undefined && drafts[actionKey] !== undefined) { setComposerMessage(t('workspace.referenceUnsaved')); return }
    if (proof.freshness === 'stale' || proof.freshness === 'unavailable') { setComposerMessage(t('workspace.referenceStale')); return }
    if (actionArtifact.mediaType.startsWith('text/') && bridge.features?.editablePrompt !== true) { setComposerMessage(t('workspace.composerMissing')); return }
    const requestId = `creator-reference-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    const reference = buildComposerReference({ artifact: actionArtifact, proof, selection })
    if (reference === undefined) { setComposerMessage(t('workspace.referenceRangeUnsupported')); return }
    const abort = new AbortController()
    composerAbort.current = abort
    composerPending.current = { requestId, target: bridge.target, reference, status: 'pending' }
    setComposerMessage(t('workspace.composerAdding'))
    const timer = window.setTimeout(() => {
      if (!mounted.current || composerPending.current?.requestId !== requestId || composerPending.current.status !== 'pending') return
      abort.abort()
      composerPending.current = { ...composerPending.current, status: 'unknown' }
      setComposerMessage(t('workspace.composerUnknown'))
    }, CREATOR_COMPOSER_INSERT_TIMEOUT_MS)
    composerTimer.current = timer
    void composerBridge.insertReference({ version: 1, requestId, target: bridge.target, reference }, abort.signal).then(result => {
      const pending = composerPending.current
      if (!mounted.current || pending?.requestId !== requestId || result.requestId !== requestId || !targetMatches(result.target, pending.target)) return
      window.clearTimeout(timer)
      composerTimer.current = undefined
      composerAbort.current = undefined
      composerPending.current = undefined
      setComposerMessage(result.ok ? t('workspace.composerAdded') : result.reason ?? t('workspace.composerRejected'))
    }).catch(() => {
      if (!mounted.current || composerPending.current?.requestId !== requestId) return
      window.clearTimeout(timer)
      composerTimer.current = undefined
      composerAbort.current = undefined
      composerPending.current = { ...composerPending.current, status: 'unknown' }
      setComposerMessage(t('workspace.composerUnknown'))
    })
  }
  const reconcileComposerInsert = (): void => {
    const pending = composerPending.current
    if (pending === undefined || pending.status !== 'unknown') return
    const settlement = composerBridge?.referenceInsertion?.({ requestId: pending.requestId, target: pending.target })
    if (settlement?.status !== 'settled' || settlement.receipt.requestId !== pending.requestId || !targetMatches(settlement.receipt.target, pending.target)) { setComposerMessage(t('workspace.composerUnknown')); return }
    composerPending.current = undefined
    setComposerMessage(settlement.receipt.ok ? t('workspace.composerAdded') : settlement.receipt.reason ?? t('workspace.composerRejected'))
  }
  const confirmPersistedBody = async (submission: PersistedSubmission, receipt: PaneActionReceiptV1): Promise<boolean> => {
    if (receipt.owner !== submission.artifact.owner) return false
    const outputs = receipt.outputArtifacts ?? []
    const matching = outputs.filter(artifact => artifact.owner === submission.artifact.owner && artifact.ref === submission.artifact.ref
      && artifact.kind === submission.artifact.kind && artifact.mediaType === submission.artifact.mediaType)
    // Legacy mutable references may omit outputs; explicit outputs must be unambiguous.
    if (outputs.length > 0 && matching.length !== 1) return false
    const target = matching[0] ?? submission.artifact
    const confirmation = (confirmationGeneration.current.get(submission.key) ?? 0) + 1
    confirmationGeneration.current.set(submission.key, confirmation)
    const persisted = await runtime.readArtifactContent(target).catch(() => undefined)
    if (confirmationGeneration.current.get(submission.key) !== confirmation || persisted === undefined || persisted.content !== submission.body || persisted.contentRevision === submission.contentRevision || !mounted.current || currentContextVisit.current !== contextVisit || contextEpochRef.current !== contextEpoch) return false
    if (persisted.artifact.owner !== target.owner || persisted.artifact.ref !== target.ref || persisted.artifact.version !== target.version || persisted.artifact.mediaType !== target.mediaType) return false
    const nextKey = artifactKey(target, contextEpoch)
    setBodies(current => ({ ...current, [nextKey]: { status: 'ready', content: persisted.content, contentRevision: persisted.contentRevision } }))
    setDrafts(current => {
      if (nextKey === submission.key) return current[submission.key] !== submission.body ? current : Object.fromEntries(Object.entries(current).filter(([draftKey]) => draftKey !== submission.key))
      const interim = current[submission.key]
      if (interim !== undefined && interim !== submission.body && current[nextKey] !== undefined) return current
      const next = Object.fromEntries(Object.entries(current).filter(([draftKey]) => draftKey !== submission.key))
      return interim !== undefined && interim !== submission.body ? { ...next, [nextKey]: interim } : next
    })
    if (nextKey !== submission.key) setSavedViews(current => ({ ...current, [viewKey(target)]: target }))
    return true
  }
  const dispatchLifecycleAction = async (descriptor: PaneActionDescriptorV1, values: Readonly<Record<string, PaneActionValueV1>>, operation = { kind: action, binding: actionBinding, artifact: actionArtifact, key: actionKey }): Promise<PaneActionReceiptV1> => {
    if (currentContextVisit.current !== contextVisit) throw new Error('Creator context visit changed before dispatch')
    const pending = lifecyclePending.current
    if (pending !== undefined) {
      if (pending.descriptorRef === descriptor.descriptorRef) return pending.promise
      throw new Error('another Creator lifecycle action is awaiting exact settlement')
    }
    let submission: PersistedSubmission | undefined
    if ((operation.kind === 'saveDraft' || operation.kind === 'createCandidate') && operation.binding?.contentField !== undefined && operation.binding.contentRevisionField !== undefined && operation.artifact !== undefined && operation.key !== undefined) {
      const submittedBody = values[operation.binding.contentField]
      const submittedRevision = values[operation.binding.contentRevisionField]
      submission = typeof submittedBody === 'string' && typeof submittedRevision === 'string' ? { key: operation.key, artifact: operation.artifact, body: submittedBody, contentRevision: submittedRevision } : undefined
    }
    const promise = runtime.dispatchAction(descriptor, values)
    lifecyclePending.current = { origin: { artifact: selected.artifact, contextEpoch, ...(selectedCandidate === undefined ? {} : { candidateRef: selectedCandidate.ref, candidateVersion: selectedCandidate.version }) }, descriptorRef: descriptor.descriptorRef, action: operation.kind!, ...(submission === undefined ? {} : { submission }), promise, handled: false }
    setLifecyclePendingDescriptor(descriptor.descriptorRef)
    try { return await promise } catch (error) {
      if (lifecyclePending.current?.promise === promise) { lifecyclePending.current = undefined; setLifecyclePendingDescriptor(undefined) }
      throw error
    }
  }
  const settleLifecycleReceipt = async (receipt: PaneActionReceiptV1, descriptorRef: string): Promise<boolean> => {
      const pending = lifecyclePending.current
      if (pending === undefined || pending.handled || pending.descriptorRef !== descriptorRef
        || currentContextVisit.current !== contextVisit || pending.origin.contextEpoch !== contextEpoch || pending.origin.contextEpoch !== contextEpochRef.current) return false
      const exactTerminal = receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'rejected' || receipt.status === 'approval_required'
      if (exactTerminal || (pending.action === 'attachContext' && receipt.status === 'accepted')) { pending.handled = true; lifecyclePending.current = undefined; setLifecyclePendingDescriptor(undefined) }
      if (pending.action === 'saveDraft' && receipt.status === 'completed' && pending.submission !== undefined) return await confirmPersistedBody(pending.submission, receipt)
      if (pending.action === 'attachContext') requestComposerInsert(receipt)
      return false
  }
  const attachProof = selectedCandidate?.referenceProof ?? selected.referenceProof
  const unsupportedReferenceRange = attachProof !== undefined && buildComposerReference({ artifact: selectedCandidate?.artifact ?? selected.artifact, proof: attachProof, selection }) === undefined
  const actionAvailable = (next: LifecycleAction): boolean => {
    const binding = selectedAction(selected, next)
    return binding !== undefined && lifecyclePendingDescriptor === undefined && contentIssue(next) === undefined && !(binding.rangeField !== undefined && selection.kind === 'unavailable') && !(next === 'attachContext' && (unsupportedReferenceRange || composerPending.current !== undefined || (attachKey !== undefined && drafts[attachKey] !== undefined)))
  }
  const actionUnavailableReason = (next: LifecycleAction): string => next === 'attachContext' && unsupportedReferenceRange ? t('workspace.referenceRangeUnsupported') : lifecyclePendingDescriptor !== undefined ? t('action.disabled.pending') : next === 'attachContext' && attachKey !== undefined && drafts[attachKey] !== undefined ? t('workspace.referenceUnsaved') : contentIssue(next) !== undefined ? t(contentIssue(next)?.bytes ? 'workspace.contentBytesOutOfBounds' : 'workspace.contentOutOfBounds', contentIssue(next)) : t('workspace.actionUnavailable')
  const autoSaveBinding = selected.actions?.saveDraft
  const autoSaveDescriptor = owner.actions.find(descriptor => descriptor.descriptorRef === autoSaveBinding?.descriptorRef)
  const autoSaveValues: Record<string, string> = {}
  if (autoSaveBinding?.contentField !== undefined && body !== undefined) autoSaveValues[autoSaveBinding.contentField] = body
  if (autoSaveBinding?.contentRevisionField !== undefined && bodyState?.contentRevision !== undefined) autoSaveValues[autoSaveBinding.contentRevisionField] = bodyState.contentRevision
  const saveDescriptorAvailable = autoSaveDescriptor !== undefined && autoSaveBinding?.contentField !== undefined && autoSaveBinding.contentRevisionField !== undefined
    && autoSaveBinding.contentField !== autoSaveBinding.contentRevisionField && body !== undefined && bodyState?.contentRevision !== undefined
    && owner.status === 'ready' && owner.freshness === 'fresh' && autoSaveDescriptor.risk === 'low' && autoSaveDescriptor.confirmation === 'none'
    && Date.parse(autoSaveDescriptor.expiresAt) > Date.now()
    && autoSaveDescriptor.fields.some(field => field.key === autoSaveBinding.contentField)
    && autoSaveDescriptor.fields.some(field => field.key === autoSaveBinding.contentRevisionField)
  const autoSaveAvailable = saveDescriptorAvailable
    && autoSaveDescriptor.fields.every(field => {
      const value = autoSaveValues[field.key]
      return value === undefined ? !field.required : (field.kind === 'text' || field.kind === 'textarea')
        && (autoSaveDescriptor.textBody?.field === field.key
          ? new TextEncoder().encode(value).byteLength <= autoSaveDescriptor.textBody.maxBytes
          : value.length <= Math.min(field.maxLength ?? PANE_ACTION_STRING_LIMIT, PANE_ACTION_STRING_LIMIT))
        && value.length >= (field.minLength ?? (field.required ? 1 : 0))
    })
  // Recovery has its own 2 MiB body contract; Pane action field limits do not apply.
  const recoverySaveAvailable = saveDescriptorAvailable && body !== undefined
    && new TextEncoder().encode(body).byteLength <= 2 * 1024 * 1024
  const saveAutomatically = async (): Promise<boolean> => {
    if (!autoSaveAvailable || autoSaveDescriptor === undefined || autoSaveBinding === undefined || key === undefined
      || lifecyclePending.current !== undefined || contextEpochRef.current !== contextEpoch || Date.parse(autoSaveDescriptor.expiresAt) <= Date.now()) return false
    const receipt = await dispatchLifecycleAction(autoSaveDescriptor, autoSaveValues, { kind: 'saveDraft', binding: autoSaveBinding, artifact: selected.artifact, key })
    return settleLifecycleReceipt(receipt, autoSaveDescriptor.descriptorRef)
  }
  const unresolved = lifecyclePending.current
  const resumeItem = unresolved === undefined || unresolved.origin.contextEpoch !== contextEpoch ? undefined : items.find(item =>
    item.artifact.owner === unresolved.origin.artifact.owner && item.artifact.ref === unresolved.origin.artifact.ref && item.artifact.version === unresolved.origin.artifact.version
    && selectedAction(item, unresolved.action)?.descriptorRef === unresolved.descriptorRef
    && (unresolved.origin.candidateRef === undefined || item.candidates.some(candidate => candidate.ref === unresolved.origin.candidateRef && candidate.version === unresolved.origin.candidateVersion)))
  const showResume = unresolved !== undefined && actionBinding?.descriptorRef !== unresolved.descriptorRef
  const resumePending = (): void => {
    if (unresolved === undefined || resumeItem === undefined) return
    setSelectedRef(resumeItem.artifact.ref)
    setCandidateRef(unresolved.origin.candidateRef)
    setAction(unresolved.action)
  }
  const switchItem = (ref: string): void => { setSelectedRef(ref); setCandidateRef(undefined); setAction(undefined); if (composerPending.current === undefined) setComposerMessage(undefined) }
  const updateSelection = (next: MediaSelection): void => { if (key !== undefined) setSelections(current => ({ ...current, [key]: next })) }
  const duration = selected.media?.durationMs
  const retryableBodyKeys = [selected.artifact, actionArtifact]
    .filter((artifact): artifact is ArtifactRefV1 => artifact !== undefined
      && (mediaKind(artifact) === 'text' || artifact.kind === 'code' || artifact.kind === 'diagram'))
    .map(artifact => artifactKey(artifact, contextEpoch))
    .filter(bodyKey => bodies[bodyKey]?.status === 'error' || bodies[bodyKey]?.status === 'unavailable')
  const retryBodyReads = (): void => {
    setBodies(current => {
      const next = { ...current }
      for (const bodyKey of retryableBodyKeys) {
        if (!bodyRequests.current.has(bodyKey) && (next[bodyKey]?.status === 'error' || next[bodyKey]?.status === 'unavailable')) delete next[bodyKey]
      }
      return next
    })
  }

  return <SurfaceSection className="cs-section cs-artifact-workspace" title={t('workspace.title')} description={workspace?.safeMessage ?? t('action.unavailable.description')} data-creator-artifact-workspace data-workspace-status={workspace?.status ?? 'needs_contract'}>
    {recoveryNotice}
    <div className="cs-actions" role="group" aria-label={t('workspace.artifactSelection')}>{items.map(item => <Button key={JSON.stringify([item.artifact.owner, item.artifact.ref, item.artifact.version])} className="cs-button vk-btn" size="sm" data-primary={item.artifact.ref === selected.artifact.ref} variant={item.artifact.ref === selected.artifact.ref ? 'primary' : 'toolbar'} type="button" onClick={() => switchItem(item.artifact.ref)}>{item.artifact.title}</Button>)}</div>
    <div ref={tabsRef} className="cs-actions" role="tablist" aria-label={t('workspace.viewSelection')} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
      const rtl = getComputedStyle(event.currentTarget).direction === 'rtl'
      const delta = event.key === 'ArrowRight' ? (rtl ? -1 : 1) : event.key === 'ArrowLeft' ? (rtl ? 1 : -1) : undefined
      const index = event.key === 'Home' ? 0 : event.key === 'End' ? ARTIFACT_VIEWS.length - 1 : delta === undefined ? undefined : (ARTIFACT_VIEWS.indexOf(view) + delta + ARTIFACT_VIEWS.length) % ARTIFACT_VIEWS.length
      if (index === undefined) return
      event.preventDefault()
      event.stopPropagation()
      const next = ARTIFACT_VIEWS[index]!
      setView(next)
      tabsRef.current?.querySelector<HTMLButtonElement>(`[data-creator-artifact-tab="${next}"]`)?.focus()
    }}>{ARTIFACT_VIEWS.map(next => <Button key={next} id={`${viewId}-${next}`} data-creator-artifact-tab={next} className="cs-button vk-btn" size="sm" data-primary={view === next} variant={view === next ? 'primary' : 'toolbar'} type="button" role="tab" tabIndex={view === next ? 0 : -1} aria-selected={view === next} aria-controls={`${viewId}-panel`} onClick={() => setView(next)}>{t(next === 'preview' ? 'workspace.preview' : next === 'source' ? 'workspace.source' : 'workspace.compare')}</Button>)}</div>
    <div {...readingPosition} className="cs-artifact-panel" id={`${viewId}-panel`} role="tabpanel" aria-labelledby={`${viewId}-${view}`} tabIndex={0}>
    {view === 'compare' && runtime.readCandidatePage && selected.artifact.capabilities.includes('candidate.history.read') && <CandidateHistory key={key} artifact={selected.artifact} read={runtime.readCandidatePage} disabled={lifecyclePendingDescriptor !== undefined} t={t} onPage={page => {
      if (key !== undefined && currentContextVisit.current === contextVisit) {
        setHistoryPage({ key, candidates: page.candidates.map(candidate => ({
          ref: candidate.ref, version: candidate.version, title: candidate.title, status: candidate.status,
          ...(candidate.sourceVersion === undefined ? {} : { sourceVersion: candidate.sourceVersion }),
          ...(candidate.artifact === undefined ? {} : { artifact: candidate.artifact }),
        })) })
        setCandidateRef(undefined)
        setAction(undefined)
      }
    }} />}
    {view === 'preview' && (selected.artifact.mediaType.startsWith('text/') || selected.artifact.kind === 'text' || selected.artifact.kind === 'code' || selected.artifact.kind === 'diagram'
      ? body === undefined ? <SurfaceState phase={bodyState?.status === 'loading' ? 'loading' : 'disabled'} title={bodyState?.status === 'error' ? t('workspace.bodyError') : bodyState?.status === 'unavailable' ? t('workspace.bodyUnavailable') : t('workspace.previewUnavailable')} /> : <TextDraftPreview artifact={selected.artifact} body={body} t={t} />
      : <ResolvedMediaPreview artifact={selected.artifact} item={selected} runtime={runtime} selection={selection} onSelectionChange={updateSelection} t={t} />)}
    {view === 'source' && selected.artifact.owner === 'auctra' && <AuctraRecoveryLoader key={key} artifact={selected.artifact} runtime={runtime} t={t}
      blocked={composing || lifecyclePendingDescriptor !== undefined || key === undefined}
      canSave={recoverySaveAvailable && key !== undefined && drafts[key] !== undefined}
      {...(body === undefined ? {} : { content: body })}
      {...(bodyState?.status !== 'ready' || bodyState.content === undefined || bodyState.contentRevision === undefined ? {} : { base: { artifact: selected.artifact, content: bodyState.content, contentRevision: bodyState.contentRevision } })}
      onRestore={(draft, content) => {
        if (key === undefined || currentContextVisit.current !== contextVisit || drafts[key] !== undefined || lifecyclePendingDescriptor !== undefined) return
        if (draft.baseVersion !== selected.artifact.version) { setComposerMessage(t('auctra.recovery.baseChanged')); return }
        setRecoveryEpoch(value => value + 1)
        setDrafts(current => ({ ...current, [key]: content }))
      }} />}
    {view === 'source' && <label className="cs-field ys-field" data-creator-artifact-editor><span>{t('workspace.sourceLabel')}</span>{bodyState?.status === 'loading' ? <SurfaceState phase="loading" title={t('workspace.loadingBody')} /> : body !== undefined ? <textarea value={body} onCompositionStart={() => setComposing(true)} onCompositionEnd={event => { setComposing(false); const value = event.currentTarget.value; if (key !== undefined) setDrafts(current => ({ ...current, [key]: value })) }} onChange={event => { const value = event.currentTarget.value; if (key !== undefined) setDrafts(current => ({ ...current, [key]: value })) }} /> : <SurfaceState phase="disabled" title={bodyState?.status === 'error' ? t('workspace.bodyError') : t('workspace.bodyUnavailable')} />}<small>{t('workspace.sourceHint')}</small></label>}
    {view === 'compare' && (selected.candidates.length === 0 ? <SurfaceState phase="disabled" title={t('workspace.candidateUnavailable')} description={t('workspace.candidateUnavailable.description')} /> : <><label className="cs-field ys-field"><span>{t('workspace.candidate')}</span><select value={selectedCandidate?.ref ?? ''} onChange={event => setCandidateRef(event.currentTarget.value)}>{selected.candidates.map(candidate => <option value={candidate.ref} key={candidate.ref}>{candidate.title} · {candidate.version} · {candidate.status}</option>)}</select></label>{selectedCandidate !== undefined && <CandidateComparison item={selected} candidate={selectedCandidate} runtime={runtime} t={t} currentBody={bodyState} candidateBody={selectedCandidate.artifact === undefined ? undefined : bodies[artifactKey(selectedCandidate.artifact, contextEpoch)]} />}</>)}
    </div>
    {(mediaKind(selected.artifact) === 'image' || mediaKind(selected.artifact) === 'audio' || mediaKind(selected.artifact) === 'video') && <fieldset className="cs-field ys-field cs-media-selection" data-creator-artifact-range><legend>{t('workspace.range')}</legend>
      {selection.kind === 'time' && duration !== undefined && <div className="cs-media-timeline" data-creator-media-timeline><div aria-hidden="true" data-creator-artifact-range-preview style={{ '--range-start': `${selection.range.startMs / duration * 100}%`, '--range-width': `${(selection.range.endMs - selection.range.startMs) / duration * 100}%` } as CSSProperties} /><label>{t('workspace.rangeStart')}<input aria-label={t('workspace.rangeStart')} type="range" min={0} max={selection.range.endMs} value={selection.range.startMs} onChange={event => updateSelection({ kind: 'time', range: { ...selection.range, startMs: Number(event.currentTarget.value) } })} /></label><label>{t('workspace.rangeEnd')}<input aria-label={t('workspace.rangeEnd')} type="range" min={selection.range.startMs} max={duration} value={selection.range.endMs} onChange={event => updateSelection({ kind: 'time', range: { ...selection.range, endMs: Number(event.currentTarget.value) } })} /></label><output>{selection.range.startMs}–{selection.range.endMs} ms</output></div>}
      {selection.kind === 'unavailable' && <SurfaceState phase="disabled" title={t('workspace.durationUnavailable')} />}
      {selection.kind === 'image' && <output aria-label={t('workspace.imageSelection')}>{Math.round(selection.region.x * 100)}%, {Math.round(selection.region.y * 100)}% · {Math.round(selection.region.width * 100)}% × {Math.round(selection.region.height * 100)}%</output>}
      <label className="cs-field ys-field"><span>{t('workspace.annotation')}</span><textarea value={annotation} placeholder={t('workspace.annotation.placeholder')} onChange={event => { const value = event.currentTarget.value; if (key !== undefined) setAnnotations(current => ({ ...current, [key]: value })) }} /></label><small>{t('workspace.rangeHint')}</small></fieldset>}
    {retryableBodyKeys.length > 0 && <Button className="cs-button vk-btn" size="sm" variant="toolbar" type="button" onClick={retryBodyReads}>{t('workspace.retryBody')}</Button>}
    <CreatorArtifactAutoSave key={`${key}:${recoveryEpoch}`} available={autoSaveAvailable} blocked={lifecyclePendingDescriptor !== undefined} dirty={key !== undefined && drafts[key] !== undefined && !composing} revision={JSON.stringify([bodyState?.contentRevision, body])} save={saveAutomatically} t={t} />
    {dirty && <p className="cs-muted" role="status">{t('workspace.unsaved')}</p>}
    <div className="cs-actions" role="group" aria-label={t('workspace.actions')}>{(Object.keys(ACTION_KEYS) as LifecycleAction[]).map(next => <Button key={next} className="cs-button vk-btn" size="sm" variant={next === 'writeback' ? 'primary' : 'toolbar'} type="button" disabled={!actionAvailable(next)} title={actionAvailable(next) ? undefined : actionUnavailableReason(next)} onClick={() => setAction(next)}>{t(ACTION_KEYS[next])}</Button>)}</div>
    {showResume && <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={resumeItem === undefined} title={resumeItem === undefined ? t('workspace.pendingUnavailable') : undefined} onClick={resumePending}>{t('workspace.resumePending')}</Button>}
    <p className="cs-muted" role="status">{t('workspace.lifecycleNote')} {t('workspace.attachNote')}</p>
    {composerMessage !== undefined && <div className="cs-receipt" data-status={composerPending.current?.status === 'unknown' ? 'unknown' : 'pending'} role="status"><span>{composerMessage}</span>{composerPending.current?.status === 'unknown' && <Button type="button" size="sm" variant="toolbar" onClick={reconcileComposerInsert}>{t('workspace.composerReconcile')}</Button>}</div>}
    {actionBinding === undefined || action === undefined ? null : selectedContentIssue !== undefined && lifecyclePendingDescriptor !== actionBinding.descriptorRef ? <SurfaceState phase="disabled" title={t(selectedContentIssue.bytes ? 'workspace.contentBytesOutOfBounds' : 'workspace.contentOutOfBounds', selectedContentIssue)} /> : <CreatorActionComposer owner={owner} task="assets" snapshot={snapshot} state={state} controller={{ dispatchAction: dispatchLifecycleAction, ...(runtime.reconcileAction === undefined ? {} : { reconcileAction: descriptor => runtime.reconcileAction!(descriptor) }) }} t={t} descriptorRef={actionBinding.descriptorRef} lockedValueKeys={[actionBinding.contentField, actionBinding.contentRevisionField, actionBinding.candidateRefField, actionBinding.candidateVersionField, actionBinding.sourceVersionField, actionBinding.rangeField, actionBinding.annotationField].filter((field): field is string => field !== undefined)} executionBlocked={lifecyclePendingDescriptor === actionBinding.descriptorRef} retainValuesOnPartial retainValuesOnAccepted={action === 'attachContext'} onReceipt={receipt => {
      void settleLifecycleReceipt(receipt, actionBinding.descriptorRef)
    }} {...(initialValues === undefined ? {} : { initialValues })} />}
  </SurfaceSection>
}
