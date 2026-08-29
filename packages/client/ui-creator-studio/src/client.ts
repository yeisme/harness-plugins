import type { Context } from '@deepseek-ai/cordis'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-slots'
import { Button, IconSparkle16 } from '@deepseek-ai/dsh-client-ui-primitives'
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
import {
  defaultCreatorStudioTranslator,
  en,
  NS,
  pseudoLong,
  pseudoRtl,
  zh,
  type CreatorStudioKey,
  type CreatorStudioTranslator,
} from './locales.ts'
import { resolveCreatorStudioRemote } from './remote.ts'
import {
  CREATOR_STUDIO_RUNTIME_SERVICE,
  createCreatorStudioRuntime,
} from './runtime.ts'
import { CreatorMediaView, CreatorStudioView, type CreatorPaneFace, type CreatorStudioViewMode } from './views.tsx'

export const inject = ['slots', 'remote', 'locale']

interface CreatorPaneWorkbenchFace extends CreatorPaneFace {
  registerView(input: unknown): () => void
  registerPlugin?(input: PaneRuntimePluginV1): () => void
  registerCommand?(input: unknown): () => void
  registerIntentHandler?(input: PaneIntentHandlerRegistrationV1): () => void
}

interface SlotsFace {
  inject(name: string, setup: () => () => void): () => void
  register(input: unknown, component: (props: { wide?: boolean }) => ReactNode): () => void
}

interface PaneLocalProps {
  readonly view: { readonly id: string; readonly metadata?: Readonly<Record<string, unknown>> }
  readonly projection?: unknown
  readonly retry: () => void
}

const CREATOR_LAUNCHER_STYLES = `
[data-creator-studio-launcher]{display:inline-flex;min-height:0}
[data-creator-studio-launcher] .creator-launcher{display:inline-flex;width:32px;min-width:32px;height:32px;min-height:32px;align-items:center;justify-content:center;padding:0;border-radius:8px}
`

function CreatorLauncher({ wide = true, disabled = false, reason, onOpen, t = defaultCreatorStudioTranslator }: {
  readonly wide?: boolean
  readonly disabled?: boolean
  readonly reason?: string
  readonly onOpen?: () => void
  readonly t?: CreatorStudioTranslator
}): ReactNode {
  return createElement('span', { 'data-creator-studio-launcher': true, 'data-wide': wide },
    createElement('style', { 'data-creator-studio-launcher-styles': true }, CREATOR_LAUNCHER_STYLES),
    createElement(Button, {
      type: 'button', size: 'sm', variant: 'toolbar', className: 'creator-launcher', disabled, onClick: onOpen,
      title: reason ?? t('launcher.title'), 'aria-label': t('launcher.label'),
    }, createElement('span', { 'aria-hidden': true }, createElement(IconSparkle16, { size: 18 }))),
  )
}

const VIEW_CONFIG: Record<CreatorStudioViewMode, { kind: string; labelKey: CreatorStudioKey; role: 'content' | 'utility'; preferredRegion: 'right' | 'bottom'; retention: 'keep-alive' | 'snapshot'; singleton: boolean; task?: string; owner?: CreatorStudioOwner; order: number; launcher?: boolean; legacy?: boolean }> = {
  home: { kind: 'creator.home', labelKey: 'mode.home', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, order: 0 },
  text: { kind: 'creator.text', labelKey: 'mode.text', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'text', owner: 'auctra', order: 10 },
  visual: { kind: 'creator.visual', labelKey: 'mode.visual', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, task: 'image', owner: 'eikona', order: 20 },
  audio: { kind: 'creator.audio', labelKey: 'mode.audio', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, task: 'audio', owner: 'sonora', order: 30 },
  production: { kind: 'creator.production', labelKey: 'mode.production', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'video', owner: 'scaena', order: 40 },
  context: { kind: 'creator.context', labelKey: 'mode.context', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'context', owner: 'pinax', order: 50 },
  assets: { kind: 'creator.assets', labelKey: 'mode.assets', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'assets', order: 60 },
  analysis: { kind: 'creator.analysis', labelKey: 'mode.analysis', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: true, task: 'analysis', owner: 'anatomia', order: 70 },
  generation: { kind: 'creator.generation', labelKey: 'mode.generation', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: true, task: 'generation', order: 80 },
  approvals: { kind: 'creator.approvals', labelKey: 'mode.approvals', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'approval', order: 90 },
  review: { kind: 'creator.review', labelKey: 'mode.reviewLegacy', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, task: 'review', order: 100, launcher: false, legacy: true },
  jobs: { kind: 'creator.jobs', labelKey: 'mode.jobsLegacy', role: 'utility', preferredRegion: 'bottom', retention: 'keep-alive', singleton: true, task: 'operations', order: 110, launcher: false, legacy: true },
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

function openMode(pane: CreatorPaneWorkbenchFace, mode: CreatorStudioViewMode, t: CreatorStudioTranslator = defaultCreatorStudioTranslator): void {
  const config = VIEW_CONFIG[mode]
  pane.openView({
    kind: config.kind,
    resourceKey: `creator:${mode}`,
    role: config.role,
    preferredRegion: config.preferredRegion,
    retention: config.retention,
    singleton: config.singleton,
    pinned: true,
    title: t(config.labelKey),
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

function createIntentHandler(controller: CreatorStudioController, pane: CreatorPaneWorkbenchFace, t: CreatorStudioTranslator): PaneIntentHandlerRegistrationV1 {
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
      if (targetOwner !== undefined) openMode(pane, OWNER_MODE[targetOwner], t)
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

function pluginDefinition(t: CreatorStudioTranslator): PanePluginDefinitionV1 {
  const views = Object.entries(VIEW_CONFIG).map(([mode, config]) => ({
    kind: config.kind,
    label: t(config.labelKey),
    componentKey: `creator-${mode}`,
    role: config.role,
    preferredRegion: config.preferredRegion,
    retention: config.retention,
    singleton: config.singleton,
    presentation: {
      icon: mode === 'generation' || mode === 'jobs' ? 'terminal' : mode === 'approvals' || mode === 'review' ? 'check' : mode === 'assets' ? 'folder' : 'sparkles',
      group: mode === 'context' || mode === 'assets' ? 'creator.management' : mode === 'analysis' || mode === 'generation' || mode === 'approvals' || config.legacy === true ? 'creator.operations' : 'creator.tasks',
      ...(config.task === undefined ? {} : { task: config.task }),
      ...(config.owner === undefined ? {} : { owner: config.owner }),
      order: config.order,
      launcher: config.launcher ?? config.legacy !== true,
    },
  }))
  views.push({
    kind: 'creator.media', label: t('mode.media'), componentKey: 'creator-media', role: 'content', preferredRegion: 'right', retention: 'snapshot', singleton: false,
    presentation: { icon: 'media', group: 'creator.resources', task: 'review', order: 90, launcher: false },
  })
  return {
    schema: PANE_PLUGIN_SCHEMA,
    id: 'yeisme.creator-studio',
    version: '0.1.0-rc.1',
    owner: { id: 'yeisme', label: 'Yeisme Creator Studio' },
    faces: {
      host: { provided: true, capabilities: ['creator.snapshot', 'creator.action', 'creator.media-access', 'creator.assets', 'creator.approvals'] },
      client: { provided: true, capabilities: ['pane.view', 'creator.task-navigation', 'creator.asset-library', 'creator.operations-navigation'] },
      composition: { provided: true, capabilities: ['artifact.intent'] },
      observation: { provided: true, capabilities: ['creator.snapshot.poll'] },
    },
    capabilities: { required: ['pane.workbench.v1'], optional: ['pane.intent.v1', 'pane.action.v1'] },
    permissions: [],
    views,
    commands: [
      { id: 'creator.open', label: t('launcher.title'), presentation: { group: 'creator.tasks', order: 0, launcher: true }, slash: { name: 'creator', category: 'pane' } },
      ...(['text', 'visual', 'audio', 'production', 'context', 'assets', 'analysis', 'generation', 'approvals'] as const).map((mode, index) => ({ id: `creator.open.${mode}`, label: `${t('action.open')} ${t(VIEW_CONFIG[mode].labelKey)}`, presentation: { group: mode === 'context' || mode === 'assets' ? 'creator.management' : mode === 'analysis' || mode === 'generation' || mode === 'approvals' ? 'creator.operations' : 'creator.tasks', task: VIEW_CONFIG[mode].task, owner: VIEW_CONFIG[mode].owner, order: (index + 1) * 10, launcher: true } })),
      { id: 'creator.open.review', label: `${t('action.open')} ${t('mode.reviewLegacy')}`, presentation: { group: 'creator.operations', order: 100, launcher: false } },
      { id: 'creator.open.jobs', label: `${t('action.open')} ${t('mode.jobsLegacy')}`, presentation: { group: 'creator.operations', order: 110, launcher: false } },
    ],
    artifactKinds: ['image', 'audio', 'video', 'text', 'script', 'shot', 'analysis', 'note'],
    compatibility: { dshApiRange: '*', experimental: true },
  }
}

function registerViews(ctx: ClientContext, controller: CreatorStudioController, pane: CreatorPaneWorkbenchFace, t: CreatorStudioTranslator): () => void {
  const definition = pluginDefinition(t)
  const onOpenMode = (mode: CreatorStudioViewMode): void => openMode(pane, mode, t)
  const resolveDirector = (): { readonly applyPreset?: () => unknown; readonly applyShowControlPreset?: () => unknown; readonly probe?: { readonly showControl?: { readonly available?: boolean } } } | undefined => {
    try { return ctx.get('dramaDirector' as never) as { readonly applyPreset?: () => unknown; readonly applyShowControlPreset?: () => unknown; readonly probe?: { readonly showControl?: { readonly available?: boolean } } } | undefined } catch { return undefined }
  }
  const onOpenDrama = (): void => {
    const director = resolveDirector()
    if (director !== undefined && typeof director.applyPreset === 'function') director.applyPreset()
    else openMode(pane, 'production', t)
  }
  const viewFactories = Object.fromEntries(Object.keys(VIEW_CONFIG).map(mode => [`creator-${mode}`, (input?: unknown) => {
    const props = input as PaneLocalProps | undefined
    const director = resolveDirector()
    const onOpenShowControl = director?.probe?.showControl?.available === true && typeof director.applyShowControlPreset === 'function'
      ? () => director.applyShowControlPreset?.()
      : undefined
    return createElement(CreatorStudioView, {
      mode: mode as CreatorStudioViewMode,
      controller,
      pane,
      onOpenMode,
      onOpenDrama,
      ...(onOpenShowControl === undefined ? {} : { onOpenShowControl }),
      t,
      onDirty: dirty => {
        if (props?.view.id !== undefined) pane.controller?.dispatch({ type: 'set_view_dirty', viewId: props.view.id, dirty })
      },
    })
  }]))
  Object.assign(viewFactories, {
    'creator-media': (input?: unknown) => {
      const props = input as PaneLocalProps | undefined
      const projection = props?.projection as { artifact?: unknown } | undefined
      return createElement(CreatorMediaView, { artifact: projection?.artifact as never, controller, t })
    },
  })
  const commandHandlers = {
    'creator.open': () => openMode(pane, 'home', t),
    'creator.open.text': () => openMode(pane, 'text', t),
    'creator.open.visual': () => openMode(pane, 'visual', t),
    'creator.open.audio': () => openMode(pane, 'audio', t),
    'creator.open.production': () => openMode(pane, 'production', t),
    'creator.open.context': () => openMode(pane, 'context', t),
    'creator.open.assets': () => openMode(pane, 'assets', t),
    'creator.open.analysis': () => openMode(pane, 'analysis', t),
    'creator.open.generation': () => openMode(pane, 'generation', t),
    'creator.open.approvals': () => openMode(pane, 'approvals', t),
    'creator.open.review': () => openMode(pane, 'review', t),
    'creator.open.jobs': () => openMode(pane, 'jobs', t),
  }
  const intentHandler = createIntentHandler(controller, pane, t)
  if (pane.registerPlugin !== undefined) return pane.registerPlugin({ definition, viewFactories, commandHandlers, intentHandlers: [intentHandler] })
  const disposers = definition.views.map(descriptor => pane.registerView({ descriptor, component: viewFactories[descriptor.componentKey] }))
  if (pane.registerCommand !== undefined) {
    for (const descriptor of definition.commands) disposers.push(pane.registerCommand({ descriptor, execute: commandHandlers[descriptor.id as keyof typeof commandHandlers] }))
  }
  if (pane.registerIntentHandler !== undefined) disposers.push(pane.registerIntentHandler(intentHandler))
  return () => { for (const dispose of disposers.reverse()) dispose() }
}

function installUnavailableLauncher(slots: SlotsFace, reason: string, t: CreatorStudioTranslator): () => void {
  return slots.inject('sidebar.footer.action', () => slots.register({ name: 'sidebar.footer.action', id: 'creator-studio-unavailable', order: 39 }, () => createElement(CreatorLauncher, {
    wide: false, disabled: true, reason, t,
  })))
}

function installAvailable(ctx: ClientContext, slots: SlotsFace, pane: CreatorPaneWorkbenchFace, remote: CreatorStudioRemote, t: CreatorStudioTranslator): () => void {
  const controller = new CreatorStudioController(remote)
  const runtime = createCreatorStudioRuntime(controller)
  const disposers: Array<() => void> = [
    provide(ctx, CREATOR_STUDIO_RUNTIME_SERVICE, runtime),
    registerViews(ctx, controller, pane, t),
  ]
  const openCreator = (): void => openMode(pane, 'home', t)
  const launcher = () => createElement(CreatorLauncher, {
    wide: false, onOpen: openCreator, t,
  })
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

interface LocaleFace {
  register?(namespace: string, tables: unknown): () => void
  bind?(namespace: string): ((key: CreatorStudioKey, params?: Readonly<Record<string, string | number>>) => string) | string
  bind?(namespace: string, key: CreatorStudioKey): string
}

function resolveLocale(ctx: ClientContext): { readonly t: CreatorStudioTranslator; readonly dispose: () => void } {
  let locale: LocaleFace | undefined
  try {
    locale = (ctx as ClientContext & { readonly locale?: LocaleFace }).locale
      ?? ctx.get('locale' as never) as LocaleFace | undefined
  } catch { /* optional test/runtime capability */ }
  const dispose = locale?.register?.(NS, { zh, en, 'pseudo-long': pseudoLong, 'pseudo-rtl': pseudoRtl }) ?? (() => {})
  if (locale?.bind === undefined) return { t: defaultCreatorStudioTranslator, dispose }
  const bound = locale.bind(NS)
  if (typeof bound === 'function') {
    return {
      t: (key, params) => {
        const translated = bound(key, params)
        return translated === key ? defaultCreatorStudioTranslator(key, params) : translated
      },
      dispose,
    }
  }
  return {
    t: (key, params) => {
      const translated = locale?.bind?.(NS, key)
      return typeof translated === 'string' && translated !== key ? translated : defaultCreatorStudioTranslator(key, params)
    },
    dispose,
  }
}

export function apply(ctx: ClientContext): () => void {
  const slots = ctx.get('slots') as unknown as SlotsFace
  const locale = resolveLocale(ctx)
  const pane = resolvePane(ctx)
  if (pane === undefined) {
    const disposeLauncher = installUnavailableLauncher(slots, locale.t('client.paneUnavailable'), locale.t)
    return () => { disposeLauncher(); locale.dispose() }
  }
  let disposed = false
  let disposeMounted: (() => void) | undefined
  void resolveCreatorStudioRemote(ctx).then(remote => {
    if (disposed) return
    disposeMounted = remote === undefined
      ? installUnavailableLauncher(slots, locale.t('client.remoteUnavailable'), locale.t)
      : installAvailable(ctx, slots, pane, remote, locale.t)
  })
  return () => {
    disposed = true
    disposeMounted?.()
    locale.dispose()
  }
}

function provide(ctx: ClientContext, serviceName: string, value: unknown): () => void {
  try {
    return ctx.provide(serviceName as never, value) as () => void
  } catch {
    return () => {}
  }
}

export const CreatorStudioClientPlugin = { inject, apply: (ctx: Context): (() => void) => apply(ctx as ClientContext) }
export default CreatorStudioClientPlugin
