/**
 * Screenplay continuity persistence integration
 * (dsh-screenplay-production-continuity-v1 task 4.1 — 原生宿主恢复 leg).
 *
 * Two evidence tiers over the REAL DSH staging storage modules
 * (temp/dsh-unified-host-source packages/storage/{storage,storage-json,
 * storage-domain} — the same JSON backend the DSH preview runs):
 *
 * 1. Cordis remount: the real SceneGraphGateway + the real client
 *    Scene3DController persist a scene draft with shots/keyframes, the root
 *    fiber is disposed, and a fresh root + fresh controller over the same
 *    directory restore the negotiated workbench state through
 *    sceneWorkbenchRead while legacy sceneRead stays strict.
 * 2. Real child-process close-reopen: process A mounts the BUILT host lib
 *    (lib/index.js) over the staging storage, saves shots+keyframes through
 *    the negotiated saveSceneWorkbench Remote, and EXITS; process B starts
 *    cold on the same directory and restores through sceneWorkbenchRead.
 *
 * Nothing here mocks the gateway/store contract; the only synthetic parts are
 * the fixture scene/shot payloads and the temp storage directory.
 */

import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import { expect, it } from 'vitest'
import { SCENE_3D_SCHEMA, type SceneDocumentV1, type ShotV1 } from '@yeisme/dsh-pane-protocol'
import {
  SCENE_3D_CONTEXT_SCHEMA,
  SCENE_3D_DIRECTOR_SERVICE_KEY,
  SCENE_3D_EXPECTED_CONTEXT,
  SceneGraphGateway,
  type Scene3DContextV1,
} from '../src/gateway.ts'
import { Scene3DController } from '../../../client/ui-3d-director/src/scene3d-controller.js'

const STAGING = resolve(import.meta.dirname, '../../../../temp/dsh-unified-host-source')
const PACKAGE_ROOT = resolve(import.meta.dirname, '..')
const PROJECT_ROOT = resolve(PACKAGE_ROOT, '../..')
const SCOPE = { workspaceRef: 'workspace:fixture', projectRef: 'project:fixture' } as const
const TARGET = { scope: SCOPE, documentId: 'scene:main' } as const
const KEYFRAME_FRAME = 12

function context(): Scene3DContextV1 {
  return { schema: SCENE_3D_CONTEXT_SCHEMA, tenantRef: 'tenant:fixture', ...SCOPE }
}

function sceneDocument(): SceneDocumentV1 {
  return {
    schema: SCENE_3D_SCHEMA,
    scope: { ...SCOPE },
    id: 'scene:main',
    version: 0,
    scenes: [{ id: 'main', label: 'Main scene', rootNodeIds: ['root'], default: true }],
    nodes: [
      { id: 'root', label: 'Root', kind: 'group', transform: { translate: [0, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true },
      { id: 'hero', label: 'Hero', kind: 'mesh', parentId: 'root', transform: { translate: [1, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }, visible: true, resourceRef: 'asset:hero' },
    ],
    resources: [],
    extensions: { used: [], required: [] },
    capabilityReport: { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } },
  }
}

function shot(): ShotV1 {
  return {
    shotRef: 'shot:opening',
    sceneRef: 'scene:main',
    version: 'v1',
    cameraRef: 'hero',
    frameRange: { start: 0, end: 48, fps: 24 },
    keyframes: [{ id: 'kf-1', frame: 0, objectRef: 'asset:hero', property: 'translate', value: [0, 0, 0] }],
    objectRefs: ['asset:hero'],
    visibility: [{ objectRef: 'asset:hero', visible: true }],
    generationRefs: [],
    deliveryProjection: { status: 'pending' },
  }
}

/** Mounts the real staging storage plugins + the real gateway on a fresh cordis root. */
async function mountGateway(directory: string): Promise<{ gateway: SceneGraphGateway; root: Context }> {
  const load = (path: string) => import(pathToFileURL(join(STAGING, path)).href)
  const storage = await load('packages/storage/storage/lib/index.js')
  const json = await load('packages/storage/storage-json/lib/index.js')
  const domain = await load('packages/storage/storage-domain/lib/index.js')
  const root = new Context()
  root.provide(SCENE_3D_EXPECTED_CONTEXT, context())
  await root.plugin(storage.default)
  await root.plugin({ name: 'scene3d-fixture-json', inject: ['storage'], apply: (ctx: Context) => json.apply(ctx, { root: directory }) })
  await root.plugin({ name: 'scene3d-fixture-domain', inject: ['storage'], apply: (ctx: Context) => domain.apply(ctx, { backend: 'json', routes: {} }) })
  await root.plugin(SceneGraphGateway)
  return { gateway: root.get(SCENE_3D_DIRECTOR_SERVICE_KEY) as SceneGraphGateway, root }
}

it('restores negotiated shots and keyframes after disposing and remounting real staging storage', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'scene3d-continuity-'))
  try {
    // Session 1: seed the owner truth (v1) with the previz shot, then a real
    // controller edits the hero transform and the keyframe and saves (v2).
    const first = await mountGateway(directory)
    const seeded = await first.gateway.saveSceneWorkbench({ requestId: 'seed:one', document: sceneDocument(), shots: [shot()] })
    expect(seeded).toMatchObject({ status: 'saved', version: 1 })
    const controller = new Scene3DController(first.gateway, TARGET, {})
    await controller.load()
    expect(controller.getSnapshot().status).toBe('ready')
    expect(controller.editNodeTransform('hero', { translate: [2, 0, 0] })).toBe(true)
    expect(controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-1', frame: KEYFRAME_FRAME })).toBe(true)
    await controller.save()
    expect(controller.getSnapshot().saveStatus).toBe('clean')
    expect(controller.getSnapshot().document?.version).toBe(2)
    controller.dispose()
    await first.root.fiber.dispose()

    // Session 2 (fresh root + fresh controller, same directory): the negotiated
    // read restores the previz state; the legacy read stays strictly scene-only.
    const second = await mountGateway(directory)
    const reopened = new Scene3DController(second.gateway, TARGET, {})
    await reopened.load()
    expect(reopened.getSnapshot()).toMatchObject({ status: 'ready', saveStatus: 'clean' })
    expect(reopened.getSnapshot().document?.version).toBe(2)
    expect(reopened.getSnapshot().document?.nodes.find(node => node.id === 'hero')?.transform.translate).toEqual([2, 0, 0])
    expect(reopened.getSnapshot().shots[0]?.keyframes[0]?.frame).toBe(KEYFRAME_FRAME)
    const legacy = await second.gateway.sceneRead(TARGET)
    expect(legacy).not.toHaveProperty('shots')
    reopened.dispose()
    await second.root.fiber.dispose()

    const persisted = JSON.parse(await readFile(join(directory, 'yeisme_scene_3d_graph_v1.json'), 'utf8')) as {
      tables?: { documents?: Record<string, { shots?: Array<{ shotRef?: string }> }> }
    }
    expect(Object.values(persisted.tables?.documents ?? {})[0]?.shots?.[0]?.shotRef).toBe('shot:opening')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 60000)

/** Child-process driver: mounts the BUILT host lib over the staging storage and runs one phase. */
const CHILD_DRIVER = `
const [,, phase, directory, stagingArg] = process.argv
const staging = JSON.parse(stagingArg)
const { Context } = await import(staging.cordis)
const host = await import(staging.hostLib)
const storage = await import(staging.storage)
const json = await import(staging.json)
const domain = await import(staging.domain)
const root = new Context()
root.provide(host.SCENE_3D_EXPECTED_CONTEXT, { schema: 'dsh.scene-3d-context.v1alpha1', tenantRef: 'tenant:fixture', workspaceRef: 'workspace:fixture', projectRef: 'project:fixture' })
await root.plugin(storage.default)
await root.plugin({ name: 'scene3d-child-json', inject: ['storage'], apply: ctx => json.apply(ctx, { root: directory }) })
await root.plugin({ name: 'scene3d-child-domain', inject: ['storage'], apply: ctx => domain.apply(ctx, { backend: 'json', routes: {} }) })
await root.plugin(host.SceneGraphGateway)
const gateway = root.get(host.SCENE_3D_DIRECTOR_SERVICE_KEY)
const TARGET = { scope: { workspaceRef: 'workspace:fixture', projectRef: 'project:fixture' }, documentId: 'scene:main' }
const document = ${JSON.stringify(sceneDocument())}
const shots = ${JSON.stringify([shot()])}
if (phase === 'save') {
  const saved = await gateway.saveSceneWorkbench({ requestId: 'child:save-one', document, shots: shots.map(shot => ({ ...shot, keyframes: shot.keyframes.map(kf => ({ ...kf, frame: ${KEYFRAME_FRAME} })) })) })
  console.log(JSON.stringify(saved))
} else {
  const restored = await gateway.sceneWorkbenchRead(TARGET)
  const legacy = await gateway.sceneRead(TARGET)
  console.log(JSON.stringify({
    result: restored.result,
    shots: restored.shots,
    legacyCarriesShots: legacy !== null && typeof legacy === 'object' && 'shots' in legacy,
  }))
}
await root.fiber.dispose()
process.exit(0)
`

it('closes and reopens across real child processes: the saved previz state survives process death', async () => {
  // The child imports the BUILT host artifact (lib/index.js) — rebuild so the
  // child never runs a stale binary against today's source.
  const build = spawnSync('pnpm', ['--filter', '@yeisme/dsh-3d-director-host', 'run', 'build'], { cwd: PROJECT_ROOT, encoding: 'utf8' })
  expect(build.status, build.stderr || build.stdout).toBe(0)

  const require = createRequire(import.meta.url)
  const staging = {
    // Absolute file URLs: the driver lives in a temp directory and cannot
    // resolve bare package specifiers, so every module is pinned explicitly.
    cordis: pathToFileURL(require.resolve('@deepseek-ai/cordis')).href,
    hostLib: pathToFileURL(join(PACKAGE_ROOT, 'lib/index.js')).href,
    storage: pathToFileURL(join(STAGING, 'packages/storage/storage/lib/index.js')).href,
    json: pathToFileURL(join(STAGING, 'packages/storage/storage-json/lib/index.js')).href,
    domain: pathToFileURL(join(STAGING, 'packages/storage/storage-domain/lib/index.js')).href,
  }
  const directory = await mkdtemp(join(tmpdir(), 'scene3d-child-'))
  const driverPath = join(directory, 'driver.mjs')
  try {
    await writeFile(driverPath, CHILD_DRIVER, 'utf8')

    // Process A: mount → negotiate → save → exit.
    const saveChild = spawnSync(process.execPath, [driverPath, 'save', directory, JSON.stringify(staging)], { encoding: 'utf8' })
    expect(saveChild.status, saveChild.stderr).toBe(0)
    expect(JSON.parse((saveChild.stdout.trim().split('\n').at(-1) ?? ''))).toMatchObject({ status: 'saved', version: 1 })
    const persisted = JSON.parse(await readFile(join(directory, 'yeisme_scene_3d_graph_v1.json'), 'utf8')) as {
      tables?: { documents?: Record<string, { shots?: Array<{ shotRef?: string }> }> }
    }
    const row = Object.values(persisted.tables?.documents ?? {})[0]
    expect(row?.shots?.[0]?.shotRef).toBe('shot:opening')

    // Process B (cold start, same workspace directory): restore through the
    // negotiated read; the legacy read stays strictly scene-only.
    const restoreChild = spawnSync(process.execPath, [driverPath, 'restore', directory, JSON.stringify(staging)], { encoding: 'utf8' })
    expect(restoreChild.status, restoreChild.stderr).toBe(0)
    const restored = JSON.parse((restoreChild.stdout.trim().split('\n').at(-1) ?? ''))
    expect(restored.result).toMatchObject({ status: 'ready', document: { version: 1 } })
    expect(restored.result.document.nodes.find((node: { id: string }) => node.id === 'hero')?.transform?.translate).toEqual([1, 0, 0])
    expect(restored.shots?.[0]?.keyframes?.[0]?.frame).toBe(KEYFRAME_FRAME)
    expect(restored.legacyCarriesShots).toBe(false)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}, 120000)
