import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { createElement, type ReactNode } from 'react'
import {
  PANE_PLUGIN_SCHEMA,
  PaneActionReceiptSchema,
  type ArtifactIntentV1,
  type PaneActionDescriptorV1,
  type PaneActionReceiptV1,
  type PaneActionValueV1,
  type PanePluginDefinitionV1,
} from '@yeisme/dsh-pane-protocol'
import type { CreatorStudioOwner } from '@yeisme/dsh-creator-studio-host/contracts'
import type { PaneIntentHandlerRegistrationV1, PaneRuntimePluginV1 } from '@yeisme/dsh-client-ui-pane-workbench'
import { CreatorStudioController, type CreatorStudioRemote } from './controller.ts'
import { CreatorMediaView, CreatorStudioView, type CreatorPaneFace, type CreatorStudioViewMode } from './views.tsx'

export const inject = ['slots', 'remote', 'remote.creatorStudio']

interface CreatorPaneWorkbenchFace extends CreatorPaneFace {
  registerView(input: unknown): () => void
  registerPlugin?(input: PaneRuntimePluginV1): () => void
  registerCommand?(input: unknown): () => void
  registerIntentHandler?(input: PaneIntentHandlerRegistrationV1): () => void
}

interface SlotsFace {
  inject(name: string, setup: () => () => void): () => void
  register(input: unknown, component: () => ReactNode): () => void
}

interface PaneLocalProps {
  readonly view: { readonly id: string; readonly metadata?: Readonly<Record<string, unknown>> }
  readonly projection?: unknown
  readonly retry: () => void
}

const VIEW_CONFIG: Record<CreatorStudioViewMode, { kind: string; label: string; role: 'content' | 'utility'; preferredRegion: 'right' | 'bottom'; retention: 'keep-alive' | 'snapshot'; singleton: boolean; task?: string; owner?: CreatorStudioOwner; order: number }> = {
  home: { kind: 'creator.home', label: 'Creator Studio', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, order: 0 },
  text: { kind: 'creator.text', label: '文字', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'text', owner: 'auctra', order: 10 },
  visual: { kind: 'creator.visual', label: '图像', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, task: 'image', owner: 'eikona', order: 20 },
  audio: { kind: 'creator.audio', label: '音频', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, task: 'audio', owner: 'sonora', order: 30 },
  production: { kind: 'creator.production', label: '视频 / 短剧', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'video', owner: 'scaena', order: 40 },
  context: { kind: 'creator.context', label: '资料', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'context', owner: 'pinax', order: 50 },
  analysis: { kind: 'creator.analysis', label: '分析', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, task: 'analysis', owner: 'anatomia', order: 60 },
  review: { kind: 'creator.review', label: '审阅', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'review', owner: 'scaena', order: 70 },
  jobs: { kind: 'creator.jobs', label: '生成队列', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: true, task: 'operations', order: 80 },
}

const OWNER_MODE: Record<CreatorStudioOwner, CreatorStudioViewMode> = {
  eikona: 'visual',
  scaena: 'production',
  sonora: 'audio',
  auctra: 'text',
  pinax: 'context',
  anatomia: 'analysis',
}

function resolvePane(ctx: ClientContext): CreatorPaneWorkbenchFace | undefined {
  try {
    const pane = ctx.get('paneWorkbench' as never) as CreatorPaneWorkbenchFace | undefined
    if (pane !== undefined && typeof pane.registerView === 'function' && typeof pane.openView === 'function') return pane
  } catch { /* capability probe */ }
  return undefined
}

function resolveRemote(ctx: ClientContext): CreatorStudioRemote | undefined {
  try {
    const remote = ctx.get('remote.creatorStudio' as never) as CreatorStudioRemote | undefined
    if (remote !== undefined && typeof remote.snapshot === 'function' && typeof remote.dispatch === 'function' && typeof remote.resolveArtifact === 'function') return remote
  } catch { /* capability probe */ }
  return undefined
}

function openMode(pane: CreatorPaneWorkbenchFace, mode: CreatorStudioViewMode): void {
  const config = VIEW_CONFIG[mode]
  pane.openView({
    kind: config.kind,
    resourceKey: `creator:${mode}`,
    role: config.role,
    preferredRegion: config.preferredRegion,
    retention: config.retention,
    singleton: config.singleton,
    pinned: true,
    title: config.label,
  })
}

function intentReceipt(intent: ArtifactIntentV1, status: PaneActionReceiptV1['status'], summary: string, reconcileReason?: string): PaneActionReceiptV1 {
  return PaneActionReceiptSchema.parse({
    status,
    receiptRef: `receipt:creator:intent:${intent.idempotencyKey.replace(/[^a-z0-9._:-]/giu, '-').slice(0, 96)}`,
    owner: intent.targetOwner ?? intent.source.owner,
    summary,
    ...(reconcileReason === undefined ? {} : { reconcileReason }),
  })
}

function handoffValues(descriptor: PaneActionDescriptorV1, intent: ArtifactIntentV1): Readonly<Record<string, PaneActionValueV1>> | undefined {
  const values: Record<string, PaneActionValueV1> = {}
  for (const field of descriptor.fields) {
    if (field.kind === 'artifact_ref') values[field.key] = intent.source
    else if (field.kind === 'select' && intent.targetOwner !== undefined && field.options?.some(option => option.value === intent.targetOwner)) values[field.key] = intent.targetOwner
    else if ((field.key === 'target_owner' || field.key === 'targetOwner') && intent.targetOwner !== undefined) values[field.key] = intent.targetOwner
    else if (field.required) return undefined
  }
  return values
}

function createIntentHandler(controller: CreatorStudioController, pane: CreatorPaneWorkbenchFace): PaneIntentHandlerRegistrationV1 {
  return {
    id: 'creator-studio.artifact-intents',
    intents: ['open', 'compare', 'attach_context', 'transform', 'handoff', 'link'],
    priority: 50,
    handle: async intent => {
      if (intent.intent === 'open' || intent.intent === 'compare') {
        pane.openView({
          kind: 'creator.media',
          resourceKey: `creator:media:${intent.source.owner}:${intent.source.ref}:${intent.source.version}`,
          role: 'content',
          preferredRegion: 'right',
          retention: 'snapshot',
          singleton: false,
          preview: intent.intent === 'open',
          pinned: intent.intent === 'compare',
          title: intent.source.title,
          metadata: { artifact: intent.source },
        })
        return intentReceipt(intent, 'completed', `${intent.source.title} opened in the shared media preview.`)
      }
      const targetOwner = intent.targetOwner as CreatorStudioOwner | undefined
      const snapshot = controller.store.getSnapshot().snapshot
      const owner = targetOwner === undefined ? undefined : snapshot?.owners.find(item => item.owner === targetOwner)
      if (targetOwner !== undefined) openMode(pane, OWNER_MODE[targetOwner])
      if (owner === undefined || owner.status !== 'ready' || owner.freshness !== 'fresh') {
        return intentReceipt(intent, 'reconcile_required', 'The target owner is not ready for artifact handoff.', 'target_owner_not_ready')
      }
      const actionId = intent.intent === 'attach_context' ? 'context.attach' : 'artifact.handoff'
      const descriptor = owner.actions.find(action => action.actionId === actionId)
      if (descriptor === undefined) return intentReceipt(intent, 'reconcile_required', 'The target owner did not publish a matching handoff action.', 'handoff_descriptor_unavailable')
      if (descriptor.risk !== 'low' || descriptor.confirmation !== 'none') {
        return intentReceipt(intent, 'approval_required', `Open ${targetOwner} to review the owner-authored handoff preview.`)
      }
      const values = handoffValues(descriptor, intent)
      if (values === undefined) return intentReceipt(intent, 'reconcile_required', 'The handoff requires additional owner fields.', 'handoff_fields_required')
      return controller.dispatchAction(descriptor, values)
    },
  }
}

function pluginDefinition(): PanePluginDefinitionV1 {
  const views = Object.entries(VIEW_CONFIG).map(([mode, config]) => ({
    kind: config.kind,
    label: config.label,
    componentKey: `creator-${mode}`,
    role: config.role,
    preferredRegion: config.preferredRegion,
    retention: config.retention,
    singleton: config.singleton,
    presentation: {
      icon: mode === 'jobs' ? 'terminal' : mode === 'review' ? 'check' : 'sparkles',
      group: mode === 'context' || mode === 'analysis' ? 'creator.owner-lenses' : mode === 'jobs' ? 'creator.operations' : 'creator.tasks',
      ...(config.task === undefined ? {} : { task: config.task }),
      ...(config.owner === undefined ? {} : { owner: config.owner }),
      order: config.order,
      launcher: mode !== 'jobs',
    },
  }))
  views.push({
    kind: 'creator.media', label: '创作产物', componentKey: 'creator-media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false,
    presentation: { icon: 'media', group: 'creator.resources', task: 'review', order: 90, launcher: false },
  })
  return {
    schema: PANE_PLUGIN_SCHEMA,
    id: 'yeisme.creator-studio',
    version: '0.1.0-rc.1',
    owner: { id: 'yeisme', label: 'Yeisme Creator Studio' },
    faces: {
      host: { provided: true, capabilities: ['creator.snapshot', 'creator.action', 'creator.media-access'] },
      client: { provided: true, capabilities: ['pane.view', 'creator.task-navigation'] },
      composition: { provided: true, capabilities: ['artifact.intent'] },
      observation: { provided: true, capabilities: ['creator.snapshot.poll'] },
    },
    capabilities: { required: ['pane.workbench.v1'], optional: ['pane.intent.v1', 'pane.action.v1'] },
    permissions: [],
    views,
    commands: [
      { id: 'creator.open', label: '打开 Creator Studio', presentation: { group: 'creator.tasks', order: 0, launcher: true } },
      ...(['text', 'visual', 'audio', 'production', 'review'] as const).map((mode, index) => ({ id: `creator.open.${mode}`, label: `打开${VIEW_CONFIG[mode].label}`, presentation: { group: 'creator.tasks', task: VIEW_CONFIG[mode].task, owner: VIEW_CONFIG[mode].owner, order: (index + 1) * 10, launcher: true } })),
    ],
    artifactKinds: ['image', 'audio', 'video', 'text', 'script', 'shot', 'analysis', 'note'],
    compatibility: { dshApiRange: '*', experimental: true },
  }
}

function registerViews(controller: CreatorStudioController, pane: CreatorPaneWorkbenchFace): () => void {
  const definition = pluginDefinition()
  const onOpenMode = (mode: CreatorStudioViewMode): void => openMode(pane, mode)
  const viewFactories = Object.fromEntries(Object.keys(VIEW_CONFIG).map(mode => [`creator-${mode}`, (input?: unknown) => {
    const props = input as PaneLocalProps | undefined
    return createElement(CreatorStudioView, {
      mode: mode as CreatorStudioViewMode,
      controller,
      pane,
      onOpenMode,
      onDirty: dirty => {
        if (props?.view.id !== undefined) pane.controller?.dispatch({ type: 'set_view_dirty', viewId: props.view.id, dirty })
      },
    })
  }]))
  Object.assign(viewFactories, {
    'creator-media': (input?: unknown) => {
      const props = input as PaneLocalProps | undefined
      const projection = props?.projection as { artifact?: unknown } | undefined
      return createElement(CreatorMediaView, { artifact: projection?.artifact as never, controller })
    },
  })
  const commandHandlers = {
    'creator.open': () => { openMode(pane, 'home'); openMode(pane, 'jobs') },
    'creator.open.text': () => openMode(pane, 'text'),
    'creator.open.visual': () => openMode(pane, 'visual'),
    'creator.open.audio': () => openMode(pane, 'audio'),
    'creator.open.production': () => openMode(pane, 'production'),
    'creator.open.review': () => openMode(pane, 'review'),
  }
  const intentHandler = createIntentHandler(controller, pane)
  if (pane.registerPlugin !== undefined) return pane.registerPlugin({ definition, viewFactories, commandHandlers, intentHandlers: [intentHandler] })
  const disposers = definition.views.map(descriptor => pane.registerView({ descriptor, component: viewFactories[descriptor.componentKey] }))
  if (pane.registerCommand !== undefined) {
    for (const descriptor of definition.commands) disposers.push(pane.registerCommand({ descriptor, execute: commandHandlers[descriptor.id as keyof typeof commandHandlers] }))
  }
  if (pane.registerIntentHandler !== undefined) disposers.push(pane.registerIntentHandler(intentHandler))
  return () => { for (const dispose of disposers.reverse()) dispose() }
}

function installUnavailableLauncher(slots: SlotsFace, reason: string): () => void {
  return slots.inject('conversation.session.header.actions', () => slots.register({ name: 'conversation.session.header.actions', id: 'creator-studio-unavailable', order: 24 }, () => createElement('button', { type: 'button', disabled: true, title: reason }, '创作')))
}

export function apply(ctx: ClientContext): () => void {
  const slots = ctx.get('slots') as unknown as SlotsFace
  const pane = resolvePane(ctx)
  if (pane === undefined) return installUnavailableLauncher(slots, 'Creator Studio requires Pane Workbench V2 and the shell.workspace.right/bottom layout seam.')
  const remote = resolveRemote(ctx)
  if (remote === undefined) return installUnavailableLauncher(slots, 'Creator Studio Host Remote is unavailable.')
  const controller = new CreatorStudioController(remote)
  const disposers: Array<() => void> = [registerViews(controller, pane)]
  const openCreator = (): void => { openMode(pane, 'home'); openMode(pane, 'jobs') }
  const launcher = () => createElement('button', { type: 'button', onClick: openCreator, title: '打开 Creator Studio' }, '创作')
  disposers.push(slots.inject('conversation.session.header.actions', () => slots.register({ name: 'conversation.session.header.actions', id: 'creator-studio-open', order: 24 }, launcher)))
  disposers.push(slots.inject('sidebar.footer.action', () => slots.register({ name: 'sidebar.footer.action', id: 'creator-studio-sidebar', order: 39 }, launcher)))
  const timer = setInterval(() => { void controller.refresh() }, 15_000)
  const offReset = ctx.on('connection/reset', () => { controller.reset(); void controller.refresh() })
  const sessions = ctx.get('sessions' as never) as { list?: { getSnapshot(): { current?: string }; subscribe(listener: () => void): () => void } } | undefined
  let sessionId = sessions?.list?.getSnapshot().current
  const offSession = sessions?.list?.subscribe(() => {
    const next = sessions.list?.getSnapshot().current
    if (next === sessionId) return
    sessionId = next
    controller.reset()
    void controller.refresh()
  }) ?? (() => {})
  void controller.refresh()
  return () => {
    clearInterval(timer)
    offSession()
    offReset()
    for (const dispose of disposers.reverse()) dispose()
    controller.dispose()
  }
}

export const CreatorStudioClientPlugin = { inject, apply: (ctx: Context): (() => void) => apply(ctx as ClientContext) }
export default CreatorStudioClientPlugin
