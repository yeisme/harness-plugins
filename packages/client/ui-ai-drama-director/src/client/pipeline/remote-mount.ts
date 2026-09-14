/**
 * Client-side Remote mount for the pipeline workbench's two host gateways
 * (dsh-screenplay-production-continuity-v1 task 3.2 staging composition).
 *
 * The DSH client `remote` service exposes typed namespaces only after a
 * Client contribution explicitly `$mount`s them — nothing is auto-mounted.
 * The Creator Studio client already mounts its own `creatorStudio` namespace
 * this way; this module is the same seam for:
 * - `creativePipeline` (CreativePipelineGateway: snapshot / canvasRead);
 * - `scene3dDirector` (SceneGraphGateway: the scene workbench Remote methods
 *   the embedded Shot-anchored viewport drives, including the negotiated
 *   persistence + change-set controls).
 *
 * Every codec is `strict` (the gateway rejects non-strict contributions):
 * inputs are validated against the frozen pane-protocol zod schemas here;
 * outputs pass through a structural strict codec because the CONSUMERS own
 * fail-closed decoding (the workbench controller re-validates every
 * projection; Scene3DController re-validates every scene payload) — no trust
 * is added or removed by this transport layer. A second mount while mounted
 * is rejected by the gateway itself; this helper then returns undefined
 * without touching the existing namespaces.
 */

import {
  SceneGraphReadRequestSchema,
  SceneGraphSaveRequestSchema,
  SceneWorkbenchSaveRequestSchema,
  ProjectCanvasReadRequestSchema,
} from '@yeisme/dsh-pane-protocol'

/** Minimal `remote` service face: `$mount` returns a per-namespace disposer. */
interface ClientRemoteMountFace {
  $mount(contribution: unknown): Promise<(() => void) | void> | (() => void)
}

/** Structural reader for the client runtime `remote` service. */
export interface PipelineRemoteMountContext {
  get(name: never): unknown
}

interface StrictCodecSchema {
  parse(value: unknown): unknown
}

const strict = (typeSymbol: string, schema: StrictCodecSchema) => ({ mode: 'strict' as const, typeSymbol, schema })

/**
 * Structural strict passthrough for owner projections: the consumer-side
 * fail-closed decoders (workbench controller / Scene3DController) remain the
 * single validation point for results.
 */
const passthrough = (typeSymbol: string): ReturnType<typeof strict> =>
  strict(typeSymbol, { parse: value => value })

const creativePipelineRemoteContribution = {
  package: '@yeisme/dsh-ai-drama-director',
  descriptors: [
    {
      id: '@yeisme/dsh-ai-drama-director/creativePipeline.snapshot@1',
      service: 'creativePipeline', namespace: 'creativePipeline', method: 'snapshot', invocation: { kind: 'direct' },
      parameters: [],
      result: passthrough('CreativePipelineSnapshotResultV1'),
    },
    {
      id: '@yeisme/dsh-ai-drama-director/creativePipeline.canvasRead@1',
      service: 'creativePipeline', namespace: 'creativePipeline', method: 'canvasRead', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: strict('ProjectCanvasReadRequestV1', ProjectCanvasReadRequestSchema) }],
      result: passthrough('ProjectCanvasReadResultV1'),
    },
  ],
} as const

const scene3dReadCodec = strict('SceneGraphReadRequestV1', SceneGraphReadRequestSchema)
const scene3dSaveCodec = strict('SceneGraphSaveRequestV1', SceneGraphSaveRequestSchema)
const scene3dWorkbenchSaveCodec = strict('SceneWorkbenchSaveRequestV1', SceneWorkbenchSaveRequestSchema)

const scene3dDirectorRemoteContribution = {
  package: '@yeisme/dsh-3d-director-host',
  descriptors: [
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.sceneRead@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'sceneRead', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dReadCodec }], result: passthrough('SceneGraphReadResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.sceneWorkbenchRead@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'sceneWorkbenchRead', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dReadCodec }], result: passthrough('SceneWorkbenchReadResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.saveScene@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'saveScene', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dSaveCodec }], result: passthrough('SceneGraphSaveResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.saveSceneWorkbench@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'saveSceneWorkbench', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dWorkbenchSaveCodec }], result: passthrough('SceneGraphSaveResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.reconcileScene@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'reconcileScene', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dReadCodec }], result: passthrough('SceneGraphSaveResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.importGlb@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'importGlb', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: passthrough('Scene3DImportGlbRequestV1') }], result: passthrough('Scene3DImportGlbResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.exportGlb@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'exportGlb', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dReadCodec }], result: passthrough('Scene3DExportGlbResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.listChangeSets@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'listChangeSets', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: scene3dReadCodec }], result: passthrough('Scene3DChangeSetListResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.previewChangeSet@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'previewChangeSet', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: passthrough('Scene3DChangeSetControlRequestV1') }], result: passthrough('Scene3DChangeSetPreviewResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.acceptChangeSet@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'acceptChangeSet', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: passthrough('Scene3DChangeSetAcceptRequestV1') }], result: passthrough('Scene3DChangeSetTransitionResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.rejectChangeSet@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'rejectChangeSet', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: passthrough('Scene3DChangeSetControlRequestV1') }], result: passthrough('Scene3DChangeSetTransitionResultV1') },
    { id: '@yeisme/dsh-3d-director-host/scene3dDirector.rollbackChangeSet@1', service: 'scene3dDirector', namespace: 'scene3dDirector', method: 'rollbackChangeSet', invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: passthrough('Scene3DChangeSetRollbackRequestV1') }], result: passthrough('Scene3DChangeSetRollbackResultV1') },
  ],
} as const

export interface PipelineRemoteMountResultV1 {
  /** Disposes both namespace mounts; idempotent. */
  readonly dispose: () => void
}

/**
 * Mounts the two Remote namespaces the pipeline workbench consumes. Returns
 * undefined when the `remote` service (or its `$mount` face) is absent or the
 * gateway rejects the contribution — the workbench then renders its honest
 * probe-only disables. Never throws.
 */
export async function mountPipelineRemotes(ctx: PipelineRemoteMountContext): Promise<PipelineRemoteMountResultV1 | undefined> {
  let remote: Record<string, unknown> | undefined
  try {
    const service = ctx.get('remote' as never)
    remote = typeof service === 'object' && service !== null ? service as Record<string, unknown> : undefined
  } catch {
    remote = undefined
  }
  const mount = remote?.$mount
  if (typeof mount !== 'function') return undefined
  const disposers: Array<() => void> = []
  try {
    for (const contribution of [creativePipelineRemoteContribution, scene3dDirectorRemoteContribution]) {
      // `$mount` returns a disposer, possibly promise-wrapped; the mounted
      // namespace object itself lands on `remote.<namespace>`.
      const mounted = await (mount as ClientRemoteMountFace['$mount']).call(remote, contribution)
      if (typeof mounted === 'function') disposers.push(() => { try { mounted() } catch { /* best-effort */ } })
    }
  } catch {
    for (const dispose of disposers.splice(0).reverse()) dispose()
    return undefined
  }
  let disposed = false
  return {
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const dispose of disposers.splice(0).reverse()) dispose()
    },
  }
}
