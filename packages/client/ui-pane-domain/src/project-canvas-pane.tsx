import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { ArtifactRefSchema, PaneActionDescriptorSchema, ProjectCanvasScopeSchema, type ArtifactRefV1, type PaneActionDescriptorV1 } from '@yeisme/dsh-pane-protocol'
import { Surface, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { ProjectCanvasController, type ProjectCanvasRemote } from './project-canvas-controller.js'
import { ProjectCanvasView, canvasZh, canvasEn, type CanvasTranslator } from './project-canvas-view.js'

export const PROJECT_CANVAS_PANE_KIND = 'creator.canvas'
interface Pane { registerView(input: unknown): () => void; openView?(input: unknown): void }
interface ContextFace { get(key: string): unknown }
function record(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value) }
const ownerKinds: Record<string, string> = { eikona: 'creator.visual', scaena: 'creator.production', anatomia: 'creator.analysis', auctra: 'creator.text', sonora: 'creator.audio', pinax: 'creator.context' }

/** Optional canvas consumption through the existing Creator Studio Host, with symmetric lifetime. */
export function registerProjectCanvasPane(ctx: ContextFace, pane: Pane): () => void {
  const controllers = new Map<string, ProjectCanvasController>()
  let active = true
  const locale = ctx.get('locale') as {
    register?(ns: string, dictionaries: unknown): (() => void) | void
    bind?(ns: string): (key: string) => string
    /** Real Host locale face: notified on locale switches so mounted views re-render. */
    getSnapshot?(): unknown
    subscribe?(listener: () => void): () => void
  } | undefined
  const unregisterLocale = locale?.register?.('yeisme.project-canvas', { zh: canvasZh, en: canvasEn })
  const translate = locale?.bind?.('yeisme.project-canvas')
  const t: CanvasTranslator = key => translate?.(key) ?? canvasZh[key]
  function BoundCanvas(): ReactNode {
    const [binding, setBinding] = useState<{ controller: ProjectCanvasController; artifacts: ArtifactRefV1[]; actions: PaneActionDescriptorV1[]; service: Record<string, unknown> }>()
    const [failed, setFailed] = useState(false)
    // The bound translator is live at call time; the locale store only exists to re-render on switches.
    const reactive = locale !== undefined && typeof locale.subscribe === 'function' && typeof locale.getSnapshot === 'function' ? locale : undefined
    useSyncExternalStore(
      listener => (reactive !== undefined ? reactive.subscribe!(listener) : () => {}),
      () => reactive?.getSnapshot?.() ?? null,
    )
    useEffect(() => {
      let mounted = true
      const root = ctx.get('remote')
      const service = record(root) && record(root.creatorStudio) ? root.creatorStudio : undefined
      if (service === undefined || typeof service.snapshot !== 'function' || typeof service.canvasRead !== 'function'
        || typeof service.canvasSave !== 'function' || typeof service.canvasReconcile !== 'function') { setFailed(true); return }
      void Promise.resolve(service.snapshot()).then(async raw => {
        if (!mounted || !active) return
        if (!record(raw) || !record(raw.context)) { setFailed(true); return }
        const scope = ProjectCanvasScopeSchema.safeParse({ workspaceRef: raw.context.workspaceRef, projectRef: raw.context.projectRef })
        if (!scope.success) { setFailed(true); return }
        const key = JSON.stringify([raw.context.tenantRef, raw.context.principalRef, raw.context.membershipRevision, raw.context.runtimeGeneration, scope.data])
        let controller = controllers.get(key)
        if (controller === undefined) {
          const remote: ProjectCanvasRemote = {
            canvasRead: input => (service.canvasRead as ProjectCanvasRemote['canvasRead']).call(service, input),
            canvasSave: input => (service.canvasSave as ProjectCanvasRemote['canvasSave']).call(service, input),
            canvasReconcile: input => (service.canvasReconcile as ProjectCanvasRemote['canvasReconcile']).call(service, input),
          }
          controller = new ProjectCanvasController(remote, { scope: scope.data, documentId: 'main' })
          controllers.set(key, controller)
        }
        const artifacts: ArtifactRefV1[] = []
        const actions: PaneActionDescriptorV1[] = []
        for (const owner of Array.isArray(raw.owners) ? raw.owners : []) {
          if (!record(owner)) continue
          for (const resource of Array.isArray(owner.resources) ? owner.resources : []) {
            const parsed = ArtifactRefSchema.safeParse(record(resource) ? resource.artifact : undefined)
            if (parsed.success && !artifacts.some(item => item.owner === parsed.data.owner && item.ref === parsed.data.ref && item.version === parsed.data.version)) artifacts.push(parsed.data)
          }
          for (const action of Array.isArray(owner.actions) ? owner.actions : []) {
            const parsed = PaneActionDescriptorSchema.safeParse(action)
            if (parsed.success && owner.status === 'ready' && owner.freshness === 'fresh') actions.push(parsed.data)
          }
        }
        setBinding({ controller, artifacts, actions, service })
        await controller.load()
      }).catch(() => { if (mounted && active) setFailed(true) })
      return () => { mounted = false }
    }, [])
    if (binding === undefined) return <Surface kind="workspace" data-project-canvas="unavailable"><SurfaceState phase={failed ? 'disabled' : 'loading'} title={t(failed ? 'unavailable' : 'loading')} /></Surface>
    return <ProjectCanvasView controller={binding.controller} artifacts={binding.artifacts} actions={binding.actions} t={t}
      resolveMedia={async artifact => {
        if (typeof binding.service.resolveArtifact !== 'function') return undefined
        const value: unknown = await binding.service.resolveArtifact(artifact)
        return record(value) && typeof value.url === 'string' && typeof value.expiresAt === 'string' ? { url: value.url, expiresAt: value.expiresAt } : undefined
      }}
      openProfessional={(owner, artifact) => {
        const kind = ownerKinds[owner]
        if (kind !== undefined) pane.openView?.({ kind, resourceKey: `creator:${kind.split('.')[1]}`, role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true,
          ...(artifact === undefined ? {} : { metadata: { artifact } }) })
      }} />
  }
  const unregister = pane.registerView({ descriptor: { kind: PROJECT_CANVAS_PANE_KIND, label: t('title'), componentKey: 'project-canvas', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true }, component: BoundCanvas })
  return () => {
    active = false
    unregister()
    for (const controller of controllers.values()) controller.dispose()
    controllers.clear()
    unregisterLocale?.()
  }
}
