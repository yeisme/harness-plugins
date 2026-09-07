import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { Button, CodeBlock, MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ArtifactRefV1, PaneActionReceiptV1 } from '@yeisme/dsh-pane-protocol'
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
  MediaCompareRenderer,
  MediaImageRenderer,
  MediaPlaybackRenderer,
  parseDelimitedTable,
  type MediaImageSelectionV1,
  type MediaRefV1,
  type MediaTimeSelectionV1,
} from '@yeisme/dsh-rich-media/client'
import type { CreatorStudioViewState } from './controller.ts'
import type { CreatorStudioRuntimeV1 } from './runtime.ts'
import { CreatorActionComposer } from './projection-components.tsx'
import { defaultCreatorStudioTranslator, type CreatorStudioKey, type CreatorStudioTranslator } from './locales.ts'

type ArtifactView = 'preview' | 'source' | 'compare'
type LifecycleAction = 'saveDraft' | 'createCandidate' | 'compare' | 'adopt' | 'writeback' | 'attachContext' | 'openEnvironment'
type MediaSelection = { readonly kind: 'image'; readonly region: MediaImageSelectionV1 } | { readonly kind: 'time'; readonly range: MediaTimeSelectionV1 } | { readonly kind: 'unavailable' }
type BodyState = { readonly status: 'loading' | 'ready' | 'error' | 'unavailable'; readonly content?: string; readonly contentRevision?: string }
type PersistedSubmission = { readonly key: string; readonly artifact: ArtifactRefV1; readonly body: string; readonly contentRevision: string }
type LifecyclePending = { readonly descriptorRef: string; readonly action: LifecycleAction; readonly submission?: PersistedSubmission; readonly promise: Promise<PaneActionReceiptV1>; handled: boolean }
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

function TextComparison({ item, candidate, t }: { readonly item: CreatorArtifactWorkspaceItemV1; readonly candidate: CreatorArtifactCandidateV1; readonly t: CreatorStudioTranslator }) {
  const current = item.textPreview?.after ?? item.textPreview?.before
  const next = candidate.textPreview?.after ?? candidate.textPreview?.before
  if (current === undefined || next === undefined) return <SurfaceState phase="disabled" title={t('workspace.compareTextUnavailable')} description={t('workspace.compareTextUnavailable.description')} />
  return <div className="cs-diff" data-creator-artifact-text-compare><pre data-side="before">{current}</pre><pre data-side="after">{next}</pre></div>
}

function ImageComparison({ current, candidate, runtime, t }: { readonly current: ArtifactRefV1; readonly candidate: ArtifactRefV1; readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact'>; readonly t: CreatorStudioTranslator }) {
  const [urls, setUrls] = useState<readonly [string, string]>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    let resolved: readonly (string | undefined)[] = []
    setUrls(undefined); setError(undefined)
    void Promise.all([runtime.resolveArtifact(current), runtime.resolveArtifact(candidate)]).then(next => {
      resolved = next
      if (!live) return
      if (next[0] === undefined || next[1] === undefined) setError(t('workspace.compareMediaUnavailable'))
      else setUrls([next[0], next[1]])
    }).catch(() => { if (live) setError(t('workspace.compareMediaError')) })
    return () => { live = false; for (const url of resolved) if (url?.startsWith('blob:') === true) URL.revokeObjectURL(url) }
  }, [candidate, current, runtime, t])
  if (error !== undefined) return <SurfaceState phase="disabled" title={error} />
  if (urls === undefined) return <SurfaceState phase="loading" title={t('workspace.compareMediaLoading')} />
  return <MediaCompareRenderer left={{ url: urls[0], label: current.title, version: current.version }} right={{ url: urls[1], label: candidate.title, version: candidate.version }} />
}

function CandidateComparison({ item, candidate, runtime, t }: { readonly item: CreatorArtifactWorkspaceItemV1; readonly candidate: CreatorArtifactCandidateV1; readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact'>; readonly t: CreatorStudioTranslator }) {
  if (item.artifact.mediaType.startsWith('image/') && candidate.artifact?.mediaType.startsWith('image/')) return <ImageComparison current={item.artifact} candidate={candidate.artifact} runtime={runtime} t={t} />
  return <TextComparison item={item} candidate={candidate} t={t} />
}

function TextDraftPreview({ artifact, body }: { readonly artifact: ArtifactRefV1; readonly body: string }) {
  const type = artifact.mediaType.toLowerCase()
  if (type === 'text/markdown' || type === 'text/x-markdown') return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="markdown"><MarkdownText text={body} /></div>
  if (type === 'text/csv' || type === 'text/tab-separated-values') return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="table"><LocalTableGrid media={mediaOf(artifact)} rows={parseDelimitedTable(body, type === 'text/tab-separated-values' ? '\t' : ',').rows} /></div>
  if (type.includes('mermaid') || artifact.kind === 'diagram') return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind="mermaid"><MarkdownText text={`\`\`\`mermaid\n${body}\n\`\`\``} /></div>
  const lang = type.includes('html') ? 'html' : type.includes('javascript') ? 'javascript' : type.includes('typescript') ? 'typescript' : undefined
  return <div className="cs-artifact-preview" data-creator-artifact-preview data-preview-kind={lang === 'html' ? 'safe-html-source' : 'code'}><CodeBlock code={body} {...(lang === undefined ? {} : { lang })} /></div>
}

function ResolvedMediaPreview({ artifact, item, runtime, selection, onSelectionChange, t }: { readonly artifact: ArtifactRefV1; readonly item: CreatorArtifactWorkspaceItemV1; readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact'>; readonly selection: MediaSelection; readonly onSelectionChange: (selection: MediaSelection) => void; readonly t: CreatorStudioTranslator }) {
  const [url, setUrl] = useState<string>()
  const [error, setError] = useState<string>()
  useEffect(() => {
    let live = true
    let resolved: string | undefined
    setUrl(undefined); setError(undefined)
    void runtime.resolveArtifact(artifact).then(next => { resolved = next; if (!live) return; if (next === undefined) setError(t('media.unauthorized')); else setUrl(next) }).catch(() => { if (live) setError(t('media.unauthorized')) })
    return () => { live = false; if (resolved?.startsWith('blob:') === true) URL.revokeObjectURL(resolved) }
  }, [artifact, runtime, t])
  if (error !== undefined) return <SurfaceState phase="disabled" title={error} />
  if (url === undefined) return <SurfaceState phase="loading" title={t('workspace.loadingBody')} />
  const media = mediaOf(artifact, item)
  if (media.kind === 'image') return <MediaImageRenderer media={media} url={url} selection={selection.kind === 'image' ? selection.region : undefined} onSelectionChange={region => onSelectionChange({ kind: 'image', region })} labels={{ selection: t('workspace.imageSelection'), cropPreview: t('workspace.cropPreview') }} />
  if (media.kind === 'audio' || media.kind === 'video') return <MediaPlaybackRenderer media={media} url={url} allowBlobUrl={url.startsWith('blob:')} selection={selection.kind === 'time' ? selection.range : undefined} labels={{ playSelection: t('workspace.playSelection') }} />
  return <SurfaceState phase="disabled" title={t('media.unauthorized')} />
}

function defaultSelection(item: CreatorArtifactWorkspaceItemV1): MediaSelection { return item.artifact.mediaType.startsWith('image/') ? { kind: 'image', region: { x: 0, y: 0, width: 1, height: 1 } } : item.media?.durationMs === undefined ? { kind: 'unavailable' } : { kind: 'time', range: { startMs: 0, endMs: item.media.durationMs } } }
function rangeValue(selection: MediaSelection): string | undefined { return selection.kind === 'image' ? JSON.stringify({ kind: 'image', ...selection.region }) : selection.kind === 'time' ? JSON.stringify({ kind: 'time', ...selection.range }) : undefined }

function buildComposerReference(input: { readonly artifact: ArtifactRefV1; readonly proof: CreatorArtifactReferenceProofV1; readonly selection: MediaSelection }): ComposerReferenceV2 {
  return {
    id: input.proof.id, kind: input.proof.kind, intent: input.proof.intent, owner: input.artifact.owner, ref: input.artifact.ref, version: input.artifact.version,
    label: input.artifact.title, scope: input.proof.scope, digest: input.proof.digest, freshness: input.proof.freshness,
    ...(input.proof.unavailableReason === undefined ? {} : { unavailableReason: input.proof.unavailableReason }),
    ...(input.selection.kind === 'image' ? { region: input.selection.region } : input.selection.kind === 'time' ? { window: { start: input.selection.range.startMs, end: input.selection.range.endMs } } : {}),
  }
}

/** Conversation-adjacent artifact editor. Durable facts remain owner-backed. */
export function CreatorArtifactWorkspace({ owner, snapshot, state, runtime, composerBridge, t = defaultCreatorStudioTranslator, onDirty }: {
  readonly owner: CreatorOwnerProjectionV1
  readonly snapshot: CreatorStudioSnapshotV1
  readonly state: CreatorStudioViewState
  readonly runtime: Pick<CreatorStudioRuntimeV1, 'resolveArtifact' | 'readArtifactContent' | 'dispatchAction'>
  readonly composerBridge?: CreatorComposerBridge
  readonly t?: CreatorStudioTranslator
  readonly onDirty?: (dirty: boolean) => void
}): ReactNode {
  const workspace = owner.artifactWorkspace
  const items: readonly CreatorArtifactWorkspaceItemV1[] = workspace?.artifacts ?? fallbackWorkspaceItems(owner)
  const [selectedRef, setSelectedRef] = useState(items[0]?.artifact.ref)
  const [view, setView] = useState<ArtifactView>('preview')
  const [bodies, setBodies] = useState<Readonly<Record<string, BodyState>>>({})
  const [drafts, setDrafts] = useState<Readonly<Record<string, string>>>({})
  const [candidateRef, setCandidateRef] = useState<string>()
  const [action, setAction] = useState<LifecycleAction>()
  const [selections, setSelections] = useState<Readonly<Record<string, MediaSelection>>>({})
  const [annotations, setAnnotations] = useState<Readonly<Record<string, string>>>({})
  const [composerMessage, setComposerMessage] = useState<string>()
  const [lifecyclePendingDescriptor, setLifecyclePendingDescriptor] = useState<string>()
  const bodyRequests = useRef(new Map<string, Promise<void>>())
  const mounted = useRef(true)
  const composerPending = useRef<{ readonly requestId: string; readonly target: ComposerReferenceTargetV2; readonly reference: ComposerReferenceV2; readonly status: 'pending' | 'unknown' } | undefined>(undefined)
  const composerAbort = useRef<AbortController | undefined>(undefined)
  const composerTimer = useRef<number | undefined>(undefined)
  const lifecyclePending = useRef<LifecyclePending | undefined>(undefined)
  const confirmationGeneration = useRef(new Map<string, number>())
  const contextEpoch = bodyContextEpoch(owner, snapshot)
  const contextEpochRef = useRef(contextEpoch)
  const selected = items.find(item => item.artifact.ref === selectedRef) ?? items[0]
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
    setBodies({}); setDrafts({}); setSelections({}); setAnnotations({})
    confirmationGeneration.current.clear()
  }, [contextEpoch])
  useEffect(() => {
    const artifacts = [selected?.artifact, selectedCandidate?.artifact].filter((artifact): artifact is ArtifactRefV1 => artifact !== undefined)
    for (const artifact of artifacts) {
      const bodyKey = artifactKey(artifact, contextEpoch)
      if (bodyRequests.current.has(bodyKey) || bodies[bodyKey] !== undefined) continue
      setBodies(current => current[bodyKey] === undefined ? { ...current, [bodyKey]: { status: 'loading' } } : current)
      const request = runtime.readArtifactContent(artifact).then(content => {
        if (mounted.current && contextEpochRef.current === contextEpoch) setBodies(current => ({ ...current, [bodyKey]: content === undefined ? { status: 'unavailable' } : { status: 'ready', content: content.content, contentRevision: content.contentRevision } }))
      }).catch(() => { if (mounted.current && contextEpochRef.current === contextEpoch) setBodies(current => ({ ...current, [bodyKey]: { status: 'error' } })) }).finally(() => { bodyRequests.current.delete(bodyKey) })
      bodyRequests.current.set(bodyKey, request)
    }
  }, [bodies, contextEpoch, runtime, selected?.artifact, selectedCandidate?.artifact])
  const dirty = Object.keys(drafts).length > 0 || Object.values(annotations).some(value => value.trim().length > 0) || Object.keys(selections).length > 0
  useEffect(() => { onDirty?.(dirty) }, [dirty, onDirty])
  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return
    const protect = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [dirty])
  if (selected === undefined) return <SurfaceState phase="empty" title={t('workspace.empty')} description={workspace?.safeMessage ?? t('action.unavailable.description')} data-creator-artifact-workspace />
  const bodyState = key === undefined ? undefined : bodies[key]
  const body = key === undefined ? undefined : drafts[key] ?? bodyState?.content
  const actionBody = actionKey === undefined ? undefined : drafts[actionKey] ?? bodies[actionKey]?.content
  const selection = key === undefined ? defaultSelection(selected) : selections[key] ?? defaultSelection(selected)
  const annotation = key === undefined ? '' : annotations[key] ?? ''
  const actionBinding = action === undefined ? undefined : selectedAction(selected, action)
  const initialValues = useMemo(() => {
    if (actionBinding === undefined) return undefined
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
  }, [actionBinding, actionBody, annotation, selected, selectedCandidate, selection])
  const contentIssue = (next: LifecycleAction): { readonly min: number; readonly max: number } | undefined => {
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
    const max = Math.min(field?.maxLength ?? PANE_ACTION_STRING_LIMIT, PANE_ACTION_STRING_LIMIT)
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
  const confirmPersistedBody = async (submission: PersistedSubmission): Promise<void> => {
    const confirmation = (confirmationGeneration.current.get(submission.key) ?? 0) + 1
    confirmationGeneration.current.set(submission.key, confirmation)
    const persisted = await runtime.readArtifactContent(submission.artifact).catch(() => undefined)
    if (confirmationGeneration.current.get(submission.key) !== confirmation || persisted === undefined || persisted.content !== submission.body || persisted.contentRevision === submission.contentRevision || !mounted.current || contextEpochRef.current !== contextEpoch) return
    setBodies(current => ({ ...current, [submission.key]: { status: 'ready', content: persisted.content, contentRevision: persisted.contentRevision } }))
    setDrafts(current => current[submission.key] !== submission.body ? current : Object.fromEntries(Object.entries(current).filter(([draftKey]) => draftKey !== submission.key)))
  }
  const dispatchLifecycleAction: CreatorStudioRuntimeV1['dispatchAction'] = async (descriptor, values) => {
    const pending = lifecyclePending.current
    if (pending !== undefined) {
      if (pending.descriptorRef === descriptor.descriptorRef) return pending.promise
      throw new Error('another Creator lifecycle action is awaiting exact settlement')
    }
    let submission: PersistedSubmission | undefined
    if ((action === 'saveDraft' || action === 'createCandidate') && actionBinding?.contentField !== undefined && actionBinding.contentRevisionField !== undefined && actionArtifact !== undefined && actionKey !== undefined) {
      const submittedBody = values[actionBinding.contentField]
      const submittedRevision = values[actionBinding.contentRevisionField]
      submission = typeof submittedBody === 'string' && typeof submittedRevision === 'string' ? { key: actionKey, artifact: actionArtifact, body: submittedBody, contentRevision: submittedRevision } : undefined
    }
    const promise = runtime.dispatchAction(descriptor, values)
    lifecyclePending.current = { descriptorRef: descriptor.descriptorRef, action: action!, ...(submission === undefined ? {} : { submission }), promise, handled: false }
    setLifecyclePendingDescriptor(descriptor.descriptorRef)
    try { return await promise } catch (error) {
      if (lifecyclePending.current?.promise === promise) { lifecyclePending.current = undefined; setLifecyclePendingDescriptor(undefined) }
      throw error
    }
  }
  const actionAvailable = (next: LifecycleAction): boolean => {
    const binding = selectedAction(selected, next)
    return binding !== undefined && lifecyclePendingDescriptor === undefined && contentIssue(next) === undefined && !(binding.rangeField !== undefined && selection.kind === 'unavailable') && !(next === 'attachContext' && (composerPending.current !== undefined || (attachKey !== undefined && drafts[attachKey] !== undefined)))
  }
  const actionUnavailableReason = (next: LifecycleAction): string => lifecyclePendingDescriptor !== undefined ? t('action.disabled.pending') : next === 'attachContext' && attachKey !== undefined && drafts[attachKey] !== undefined ? t('workspace.referenceUnsaved') : contentIssue(next) !== undefined ? t('workspace.contentOutOfBounds', contentIssue(next)) : t('workspace.actionUnavailable')
  const switchItem = (ref: string): void => { setSelectedRef(ref); setCandidateRef(undefined); setAction(undefined); if (composerPending.current === undefined) setComposerMessage(undefined) }
  const updateSelection = (next: MediaSelection): void => { if (key !== undefined) setSelections(current => ({ ...current, [key]: next })) }
  const duration = selected.media?.durationMs

  return <SurfaceSection className="cs-section cs-artifact-workspace" title={t('workspace.title')} description={workspace?.safeMessage ?? t('action.unavailable.description')} data-creator-artifact-workspace data-workspace-status={workspace?.status ?? 'needs_contract'}>
    <div className="cs-actions" role="group" aria-label={t('workspace.artifactSelection')}>{items.map(item => <Button key={JSON.stringify([item.artifact.owner, item.artifact.ref, item.artifact.version])} className="cs-button" size="sm" variant={item.artifact.ref === selected.artifact.ref ? 'primary' : 'toolbar'} type="button" onClick={() => switchItem(item.artifact.ref)}>{item.artifact.title}</Button>)}</div>
    <div className="cs-actions" role="tablist" aria-label={t('workspace.viewSelection')}>{(['preview', 'source', 'compare'] as const).map(next => <Button key={next} className="cs-button" size="sm" variant={view === next ? 'primary' : 'toolbar'} type="button" role="tab" aria-selected={view === next} onClick={() => setView(next)}>{t(next === 'preview' ? 'workspace.preview' : next === 'source' ? 'workspace.source' : 'workspace.compare')}</Button>)}</div>
    {view === 'preview' && (selected.artifact.mediaType.startsWith('text/') || selected.artifact.kind === 'text' || selected.artifact.kind === 'code' || selected.artifact.kind === 'diagram'
      ? body === undefined ? <SurfaceState phase={bodyState?.status === 'loading' ? 'loading' : 'disabled'} title={bodyState?.status === 'error' ? t('workspace.bodyError') : bodyState?.status === 'unavailable' ? t('workspace.bodyUnavailable') : t('workspace.previewUnavailable')} /> : <TextDraftPreview artifact={selected.artifact} body={body} />
      : <ResolvedMediaPreview artifact={selected.artifact} item={selected} runtime={runtime} selection={selection} onSelectionChange={updateSelection} t={t} />)}
    {view === 'source' && <label className="cs-field ys-field" data-creator-artifact-editor><span>{t('workspace.sourceLabel')}</span>{bodyState?.status === 'loading' ? <SurfaceState phase="loading" title={t('workspace.loadingBody')} /> : body !== undefined ? <textarea value={body} onChange={event => { const value = event.currentTarget.value; if (key !== undefined) setDrafts(current => ({ ...current, [key]: value })) }} /> : <SurfaceState phase="disabled" title={bodyState?.status === 'error' ? t('workspace.bodyError') : t('workspace.bodyUnavailable')} />}<small>{t('workspace.sourceHint')}</small></label>}
    {view === 'compare' && (selected.candidates.length === 0 ? <SurfaceState phase="disabled" title={t('workspace.candidateUnavailable')} description={t('workspace.candidateUnavailable.description')} /> : <><label className="cs-field ys-field"><span>{t('workspace.candidate')}</span><select value={selectedCandidate?.ref ?? ''} onChange={event => setCandidateRef(event.currentTarget.value)}>{selected.candidates.map(candidate => <option value={candidate.ref} key={candidate.ref}>{candidate.title} · {candidate.version} · {candidate.status}</option>)}</select></label>{selectedCandidate !== undefined && <CandidateComparison item={selected} candidate={selectedCandidate} runtime={runtime} t={t} />}</>)}
    {(mediaKind(selected.artifact) === 'image' || mediaKind(selected.artifact) === 'audio' || mediaKind(selected.artifact) === 'video') && <fieldset className="cs-field ys-field cs-media-selection" data-creator-artifact-range><legend>{t('workspace.range')}</legend>
      {selection.kind === 'time' && duration !== undefined && <div className="cs-media-timeline" data-creator-media-timeline><div aria-hidden="true" data-creator-artifact-range-preview style={{ '--range-start': `${selection.range.startMs / duration * 100}%`, '--range-width': `${(selection.range.endMs - selection.range.startMs) / duration * 100}%` } as CSSProperties} /><label>{t('workspace.rangeStart')}<input aria-label={t('workspace.rangeStart')} type="range" min={0} max={selection.range.endMs} value={selection.range.startMs} onChange={event => updateSelection({ kind: 'time', range: { ...selection.range, startMs: Number(event.currentTarget.value) } })} /></label><label>{t('workspace.rangeEnd')}<input aria-label={t('workspace.rangeEnd')} type="range" min={selection.range.startMs} max={duration} value={selection.range.endMs} onChange={event => updateSelection({ kind: 'time', range: { ...selection.range, endMs: Number(event.currentTarget.value) } })} /></label><output>{selection.range.startMs}–{selection.range.endMs} ms</output></div>}
      {selection.kind === 'unavailable' && <SurfaceState phase="disabled" title={t('workspace.durationUnavailable')} />}
      {selection.kind === 'image' && <output aria-label={t('workspace.imageSelection')}>{Math.round(selection.region.x * 100)}%, {Math.round(selection.region.y * 100)}% · {Math.round(selection.region.width * 100)}% × {Math.round(selection.region.height * 100)}%</output>}
      <label className="cs-field ys-field"><span>{t('workspace.annotation')}</span><textarea value={annotation} placeholder={t('workspace.annotation.placeholder')} onChange={event => { const value = event.currentTarget.value; if (key !== undefined) setAnnotations(current => ({ ...current, [key]: value })) }} /></label><small>{t('workspace.rangeHint')}</small></fieldset>}
    {dirty && <p className="cs-muted" role="status">{t('workspace.unsaved')}</p>}
    <div className="cs-actions" role="group" aria-label={t('workspace.actions')}>{(Object.keys(ACTION_KEYS) as LifecycleAction[]).map(next => <Button key={next} className="cs-button" size="sm" variant={next === 'writeback' ? 'primary' : 'toolbar'} type="button" disabled={!actionAvailable(next)} title={actionAvailable(next) ? undefined : actionUnavailableReason(next)} onClick={() => setAction(next)}>{t(ACTION_KEYS[next])}</Button>)}</div>
    <p className="cs-muted" role="status">{t('workspace.lifecycleNote')} {t('workspace.attachNote')}</p>
    {composerMessage !== undefined && <div className="cs-receipt" data-status={composerPending.current?.status === 'unknown' ? 'unknown' : 'pending'} role="status"><span>{composerMessage}</span>{composerPending.current?.status === 'unknown' && <Button type="button" size="sm" variant="toolbar" onClick={reconcileComposerInsert}>{t('workspace.composerReconcile')}</Button>}</div>}
    {actionBinding === undefined || action === undefined ? null : selectedContentIssue !== undefined ? <SurfaceState phase="disabled" title={t('workspace.contentOutOfBounds', selectedContentIssue)} /> : <CreatorActionComposer owner={owner} task="assets" snapshot={snapshot} state={state} controller={{ dispatchAction: dispatchLifecycleAction }} t={t} descriptorRef={actionBinding.descriptorRef} lockedValueKeys={[actionBinding.contentField, actionBinding.contentRevisionField, actionBinding.candidateRefField, actionBinding.candidateVersionField, actionBinding.sourceVersionField, actionBinding.rangeField, actionBinding.annotationField].filter((field): field is string => field !== undefined)} retainValuesOnPartial retainValuesOnAccepted={action === 'attachContext'} onReceipt={receipt => {
      const pending = lifecyclePending.current
      if (pending === undefined || pending.handled || pending.descriptorRef !== actionBinding.descriptorRef) return
      pending.handled = true
      const exactTerminal = receipt.status === 'completed' || receipt.status === 'failed' || receipt.status === 'rejected' || receipt.status === 'approval_required'
      if (exactTerminal || (pending.action === 'attachContext' && receipt.status === 'accepted')) { lifecyclePending.current = undefined; setLifecyclePendingDescriptor(undefined) }
      if ((pending.action === 'saveDraft' || pending.action === 'createCandidate') && receipt.status === 'completed' && pending.submission !== undefined) void confirmPersistedBody(pending.submission)
      requestComposerInsert(receipt)
    }} {...(initialValues === undefined ? {} : { initialValues })} />}
  </SurfaceSection>
}
