/**
 * @yeisme/dsh-3d-director root entry.
 *
 * Installable DSH Web bundle for the 3D Director workbench
 * (dsh-3d-director-gltf-workbench-v1).
 *
 * Host face: mounts the SceneGraphGateway (service key `scene3dDirector`) so
 * the 3D viewport client can probe a real (non-fixture) scene projection
 * through `remote.scene3dDirector`, and registers the matching typert
 * contribution when the host registry is available. The gateway owns no
 * domain state and fails closed until a deployment/session-binding integration
 * provides `scene3dDirectorExpectedContext` (tenant/workspace/project) — this
 * bundle deliberately does NOT provide it, and without the context every
 * gateway method reports an honest unavailable/needs_contract degradation
 * instead of deriving context from browser parameters. The browser face stays
 * at `./client`.
 *
 * @module @yeisme/dsh-3d-director
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  SceneGraphGateway,
  SCENE_3D_CONTEXT_SCHEMA,
  SCENE_3D_DIRECTOR_SERVICE_KEY,
  SCENE_3D_EXPECTED_CONTEXT,
  SCENE_3D_EXPORT_BYTE_LIMIT,
  SCENE_3D_GLB_BYTE_SOURCE,
} from '@yeisme/dsh-3d-director-host'

export {
  SceneGraphGateway,
  SCENE_3D_CONTEXT_SCHEMA,
  SCENE_3D_EXPECTED_CONTEXT,
  SCENE_3D_EXPORT_BYTE_LIMIT,
  SCENE_3D_GLB_BYTE_SOURCE,
}
export type {
  Scene3DContextV1,
  Scene3DExportGlbResultV1,
  Scene3DGlbByteSourceV1,
  Scene3DGlbBytesV1,
  Scene3DImportGlbRequestV1,
  Scene3DImportGlbResultV1,
} from '@yeisme/dsh-3d-director-host'

export const name = 'dsh-3d-director'
export const inject: readonly string[] = ['typert']

interface TypertRegistryFace {
  register(contribution: typeof scene3dDirectorTypertContribution): (() => void | Promise<void>) | undefined
}

const scene3dDirectorTypertContribution = {
  package: '@yeisme/dsh-3d-director',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: SCENE_3D_DIRECTOR_SERVICE_KEY,
      exportName: 'SceneGraphGateway',
      summary: 'Safe 3D Director scene graph projection gateway (revisioned scene store, glTF/GLB import/export, generation change sets).',
      tags: [],
      members: [
        { kind: 'method', name: 'sceneRead', signature: 'sceneRead(input: unknown): Promise<SceneGraphReadResult>' },
        { kind: 'method', name: 'saveScene', signature: 'saveScene(input: unknown): Promise<SceneGraphSaveResult>' },
        { kind: 'method', name: 'reconcileScene', signature: 'reconcileScene(input: unknown): Promise<SceneGraphSaveResult>' },
        { kind: 'method', name: 'importGlb', signature: 'importGlb(input: unknown): Promise<Scene3DImportGlbResultV1>' },
        { kind: 'method', name: 'exportGlb', signature: 'exportGlb(input: unknown): Promise<Scene3DExportGlbResultV1>' },
        { kind: 'method', name: 'listChangeSets', signature: 'listChangeSets(input: unknown): Promise<Scene3DChangeSetListResult>' },
      ],
      types: [],
    }],
    events: [],
    objects: [],
  },
  invocations: [
    'sceneRead',
    'saveScene',
    'reconcileScene',
    'importGlb',
    'exportGlb',
    'listChangeSets',
  ].map(method => ({
    id: `@yeisme/dsh-3d-director#scene3dDirector/${method}`,
    service: SCENE_3D_DIRECTOR_SERVICE_KEY,
    namespace: SCENE_3D_DIRECTOR_SERVICE_KEY,
    method,
    invocation: { kind: 'direct' },
    parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
    result: { mode: 'src-json' },
  })),
}

/**
 * Mounts the scene graph gateway once per root context. The gateway is a
 * cordis child plugin of this bundle and unloads with it; the typert
 * contribution is best-effort and unregisters on dispose. No storage adapter,
 * byte source, or context is fabricated here — deployments provide
 * `storageDomain` / `scene3dDirectorGlbByteSource` /
 * `scene3dDirectorExpectedContext` separately.
 */
export async function apply(ctx: Context): Promise<void> {
  if (ctx.get(SCENE_3D_DIRECTOR_SERVICE_KEY as never) !== undefined) return
  await ctx.plugin(SceneGraphGateway)
  const registry = ctx.get('typert' as never) as TypertRegistryFace | undefined
  const unregister = registry?.register(scene3dDirectorTypertContribution)
  if (unregister !== undefined) ctx.effect(() => unregister, 'scene3dDirector.typert')
}

const Dsh3DDirectorPlugin = { name, inject, apply }

export default Dsh3DDirectorPlugin
