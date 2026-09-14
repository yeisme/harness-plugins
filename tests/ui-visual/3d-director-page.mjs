/**
 * 3D Director visual fixture page (dsh-3d-director-gltf-workbench-v1, task 4.3).
 *
 * Mounts the REAL built `@yeisme/dsh-client-ui-3d-director` ESM bundle with a
 * fixture `scene3dDirector` remote (in-memory committed document; no host, no
 * storage, no GLB bytes). Only host-side seams are fixture stubs: the remote
 * object and the primitives Button. The viewport is pinned to the scene-tree
 * fallback (`forceViewportFallback`) so the evidence is deterministic in the
 * headless shell — the WebGL path is covered by package tests.
 *
 * Scenarios (query param `case`) mutate only the fixture remote/document:
 * - desktop (default): two shots + canvas binding, ready export capability;
 * - narrow: same fixture at <=420 width (container-query padding contract);
 * - conflict: the first save answers a revision conflict → read-only freeze bar;
 * - export-blocked: draco capability report blocks export; the spec surfaces
 *   the gap list by invoking the real controller export path;
 * - rollback (dsh-screenplay-production-continuity-v1 task 4.1): the remote
 *   ports the negotiated workbench contract (sceneWorkbenchRead/
 *   saveSceneWorkbench with CAS receipts and a history ring that retains
 *   {document, shots} payloads, plus the change-set accept/rollback controls).
 *   The page drives the REAL controller: edit shots+keyframes → save → accept
 *   a previewed change set → edit further → save → roll back, then records the
 *   restored previz state on `window.__rollbackEvidence` (host truth for the
 *   ring semantics is covered by the host package integration specs).
 */
const IDENTITY = { translate: [0, 0, 0], rotate: [0, 0, 0, 1], scale: [1, 1, 1] }

function sceneDocument(overrides = {}) {
  return {
    schema: 'dsh.scene-3d.v1alpha1',
    scope: { workspaceRef: 'workspace:fixture', projectRef: 'project:fixture' },
    id: 'main',
    version: 3,
    scenes: [{ id: 'main', label: 'Main scene', rootNodeIds: ['root'], default: true }],
    nodes: [
      { id: 'root', label: 'Root', kind: 'group', transform: IDENTITY, visible: true },
      { id: 'hero', label: 'Hero', kind: 'mesh', parentId: 'root', transform: { ...IDENTITY, translate: [1, 0, 0] }, visible: true, resourceRef: 'asset:hero' },
      { id: 'key-light', label: 'Key light', kind: 'light', parentId: 'root', transform: IDENTITY, visible: false },
      { id: 'camera-main', label: 'Main camera', kind: 'camera', parentId: 'root', transform: { ...IDENTITY, translate: [0, 2, 6] }, visible: true, resourceRef: 'camera:main' },
    ],
    resources: [],
    extensions: { used: [], required: [] },
    capabilityReport: { gltfVersion: '2.0', extensions: [], export: { ready: true, gaps: [] } },
    ...overrides,
  }
}

function blockedDocument() {
  return sceneDocument({
    extensions: { used: ['KHR_draco_mesh_compression'], required: [] },
    capabilityReport: {
      gltfVersion: '2.0',
      extensions: [{ name: 'KHR_draco_mesh_compression', readable: true, editable: false, exportable: false, opaquePreserved: false }],
      export: { ready: false, gaps: [{ extension: 'KHR_draco_mesh_compression', reason: 'Draco-compressed meshes cannot be re-encoded for export.' }] },
    },
  })
}

const SHOTS = [
  {
    shotRef: 'shot:opening',
    sceneRef: 'scene:main',
    version: 'v1',
    cameraRef: 'camera:main',
    frameRange: { start: 0, end: 48, fps: 24 },
    keyframes: [
      { id: 'kf-1', frame: 0, objectRef: 'asset:hero', property: 'translate', value: [0, 0, 0] },
      { id: 'kf-2', frame: 24, objectRef: 'asset:hero', property: 'visibility', value: true },
    ],
    objectRefs: ['asset:hero'],
    visibility: [{ objectRef: 'asset:hero', visible: true }],
    generationRefs: [],
    deliveryProjection: { status: 'pending' },
  },
  {
    shotRef: 'shot:rooftop',
    sceneRef: 'scene:main',
    version: 'v1',
    cameraRef: 'camera:main',
    frameRange: { start: 48, end: 96, fps: 24 },
    keyframes: [
      { id: 'kf-3', frame: 60, objectRef: 'asset:hero', property: 'translate', value: [2, 0, 0] },
    ],
    objectRefs: ['asset:hero'],
    visibility: [{ objectRef: 'asset:hero', visible: true }],
    generationRefs: [],
    deliveryProjection: { status: 'ready', summary: 'Owner preview ready' },
  },
]

const BINDINGS = [
  { nodeRef: 'canvas:node-1', shotRef: 'shot:opening', sceneObjectRef: 'asset:hero', edgeKind: 'reference', layout: { position: { x: 0, y: 0 } } },
]

const CHANGE_SETS = [
  {
    changeSetRef: 'changeset:fixture-one',
    sceneRef: 'scene:main',
    baseVersion: 2,
    inputRefs: ['asset:hero'],
    operationSummary: 'Regenerate hero transforms',
    patchDigest: 'sha256:0123456789abcdef',
    status: 'pending',
  },
]

/**
 * Rollback-scenario change set: previewed with its artifact ref, based on the
 * revision the page's first save commits (the fixture document starts at
 * version 3; the edit wave saves version 4).
 */
const ROLLBACK_CHANGE_SETS = [
  {
    changeSetRef: 'changeset:browser-rollback',
    sceneRef: 'scene:main',
    baseVersion: 4,
    inputRefs: ['asset:hero'],
    operationSummary: 'Regenerate hero motion',
    patchDigest: 'sha256:0123456789abcdef',
    status: 'preview',
    previewRef: 'preview:browser-rollback',
    artifactRef: {
      schema: 'pane.artifact.v1alpha1',
      owner: 'eikona',
      kind: 'image',
      ref: 'artifact:browser-rollback',
      version: '1',
      mediaType: 'image/png',
      title: 'Generated hero motion',
      evidenceRefs: [],
      capabilities: ['preview'],
    },
  },
]

export function director3DPage(width, scenario, baseImportMap) {
  const importMap = {
    imports: {
      ...baseImportMap.imports,
      three: '/vendor/three/build/three.module.js',
      'three/examples/jsm/controls/OrbitControls.js': '/vendor/three/examples/jsm/controls/OrbitControls.js',
      zod: '/vendor/zod/index.js',
      '@yeisme/dsh-pane-protocol': '/vendor/dsh-pane-protocol.mjs',
    },
  }
  const fixture = {
    scenario,
    document: scenario === 'export-blocked' ? blockedDocument() : sceneDocument(),
    shots: SHOTS,
    bindings: BINDINGS,
    changeSets: scenario === 'rollback' ? ROLLBACK_CHANGE_SETS : CHANGE_SETS,
  }
  return `<!doctype html><html><head><meta charset="utf-8"><script type="importmap">${JSON.stringify(importMap)}</script>
<style>
:root{--dsw-alias-bg-base:#171719;--dsw-alias-bg-layer-1:#1e1e21;--dsw-alias-bg-layer-2:#242429;--dsw-alias-bg-overlay:#2a2a2f;--dsw-alias-label-primary:#ececf1;--dsw-alias-label-secondary:#c6c6cb;--dsw-alias-label-tertiary:#92929b;--dsw-alias-label-caption:#6f6f78;--dsw-alias-brand-text:#ececf1;--dsw-alias-border-l1:rgba(255,255,255,.06);--dsw-alias-border-l2:rgba(255,255,255,.12);--dsw-alias-state-business-primary:#79b8ff;--dsw-alias-interactive-bg-hover:rgba(255,255,255,.08);--dsw-alias-interactive-bg-hover-accent:rgba(255,255,255,.24);--dsw-alias-interactive-bg-active:rgba(255,255,255,.14);--dsw-alias-state-error-primary:#ee6b72;--dsw-alias-state-success-primary:#51c58b;--dsw-alias-state-warn-primary:#f0b45a}
html,body{margin:0;min-height:100%;background:#111113;color:#ececf1;font-family:Arial,sans-serif}
*{animation:none!important;transition:none!important}
body{display:grid;place-items:start center;padding:8px}
#fixture-frame{width:${width}px;height:860px;border:1px solid rgba(255,255,255,.12);background:#171719;overflow:hidden;display:flex;flex-direction:column}
#fixture-frame>[data-yeisme-surface]{flex:1;min-height:0}
.fx-btn{font:inherit;cursor:pointer;border:1px solid rgba(255,255,255,.14);border-radius:6px;background:#2a2a2f;color:inherit;padding:2px 10px;min-height:28px}
.fx-btn:disabled{opacity:.45;cursor:not-allowed}
</style></head>
<body data-fixture="3d-director" data-scenario="${scenario}">
<p style="margin:4px 8px;font-size:11px;color:#92929b">Fixture: real 3D Director bundle + fixture scene3dDirector remote; synthetic scene, no GLB bytes, no owner execution.</p>
<main id="fixture-frame" data-fixture-width="${width}"><div id="fixture" style="display:flex;flex-direction:column;flex:1;min-height:0"></div></main>
<script src="/vendor/react.global.js"></script>
<script src="/vendor/scheduler.global.js"></script>
<script src="/vendor/react-dom.global.js"></script>
<script src="/vendor/react-jsx-runtime.global.js"></script>
<script type="module">
import { Scene3DController, Director3DSurface } from '/3d-director-client.js';

const fixture = ${JSON.stringify(fixture)};
const target = { scope: { workspaceRef: 'workspace:fixture', projectRef: 'project:fixture' }, documentId: 'main' };
let committed = structuredClone(fixture.document);

// Rollback scenario only: a compact port of the negotiated workbench contract
// (CAS by document.version, idempotent receipts, history ring retaining
// {document, shots} payloads, and the change-set accept/rollback controls).
const workbench = fixture.scenario === 'rollback'
  ? (() => {
      const receipts = [];
      const history = [];
      let changeSets = structuredClone(fixture.changeSets);
      let shots = structuredClone(fixture.shots);
      const save = (request, carriedShots) => {
        const base = committed.version;
        if (request.document.version !== base) return { status: 'conflict', version: base };
        const prior = receipts.find(receipt => receipt.requestId === request.requestId);
        if (prior !== undefined) return { status: 'saved', requestId: prior.requestId, version: prior.version };
        if (base > 0) history.push({ document: committed, shots });
        committed = { ...structuredClone(request.document), version: base + 1 };
        if (carriedShots !== undefined) shots = structuredClone(carriedShots);
        receipts.push({ requestId: request.requestId, version: committed.version });
        return { status: 'saved', requestId: request.requestId, version: committed.version };
      };
      const retainedVersion = ref => {
        const match = /^scene-revision:main@(\\d+)$/.exec(ref ?? '');
        const version = match === null ? 0 : Number(match[1]);
        return version === committed.version
          ? { document: committed, shots }
          : history.find(entry => entry.document.version === version);
      };
      return {
        read: () => ({ schema: 'dsh.scene-workbench.v1', result: { status: 'ready', document: structuredClone(committed) }, shots: structuredClone(shots) }),
        save,
        changeSets: () => changeSets,
        accept: request => {
          const entry = changeSets.find(item => item.changeSetRef === request.changeSetRef);
          if (entry === undefined || entry.status !== 'preview') return { status: 'failed' };
          const saved = save({ requestId: request.requestId, document: request.document });
          if (saved.status !== 'saved') return saved;
          entry.status = 'accepted';
          entry.rollbackRef = 'scene-revision:main@' + (saved.version - 1);
          return { status: 'accepted', changeSet: entry, version: saved.version };
        },
        rollback: request => {
          const entry = changeSets.find(item => item.changeSetRef === request.changeSetRef);
          if (entry === undefined || entry.status !== 'accepted') return { status: 'failed' };
          const retained = retainedVersion(entry.rollbackRef);
          if (retained === undefined) return { status: 'failed' };
          const saved = save({ requestId: request.requestId, document: { ...retained.document, version: committed.version } }, retained.shots);
          if (saved.status !== 'saved') return saved;
          entry.status = 'rolled_back';
          entry.rollbackRef = 'scene-revision:main@' + saved.version;
          return { status: 'rolled_back', changeSet: entry, version: saved.version };
        },
      };
    })()
  : undefined;

const remote = {
  sceneRead: async () => ({ status: 'ready', document: structuredClone(committed) }),
  saveScene: async request => {
    if (fixture.scenario === 'conflict') return { status: 'conflict', version: committed.version + 1 };
    committed = { ...structuredClone(request.document), version: committed.version + 1 };
    return { status: 'saved', requestId: request.requestId, version: committed.version };
  },
  reconcileScene: async () => ({ status: 'unknown' }),
  importGlb: async () => ({ status: 'unavailable', reason: 'fixture_has_no_byte_source' }),
  exportGlb: async () => ({ status: 'exported', bytesBase64: 'RklYVFVSRQ==', size: 8, mediaType: 'model/gltf-binary', report: committed.capabilityReport }),
  listChangeSets: async () => ({ status: 'ready', changeSets: workbench === undefined ? fixture.changeSets : workbench.changeSets() }),
  ...(workbench === undefined ? {} : {
    sceneWorkbenchRead: async () => workbench.read(),
    saveSceneWorkbench: async request => workbench.save(request, request.shots),
    previewChangeSet: async request => ({ status: 'ready', changeSet: workbench.changeSets().find(entry => entry.changeSetRef === request.changeSetRef), currentVersion: committed.version, baseRevisionRetained: true }),
    acceptChangeSet: async request => workbench.accept(request),
    rejectChangeSet: async () => ({ status: 'updated', changeSet: workbench.changeSets()[0] }),
    rollbackChangeSet: async request => workbench.rollback(request),
  }),
};
const controller = new Scene3DController(remote, target, { shots: fixture.shots, bindings: fixture.bindings });
window.__director3d = controller;
window.ReactDOM.createRoot(document.getElementById('fixture')).render(
  window.React.createElement(Director3DSurface, { controller, forceViewportFallback: true, reducedMotion: true })
);
await controller.load();
await controller.refreshChangeSets();
if (fixture.scenario === 'conflict') {
  // Real edit + save path: the owner confirms a newer revision, so the
  // controller freezes writes and keeps the local draft (never auto-retried).
  controller.editNodeTransform('hero', { translate: [2, 0, 0] });
  await controller.save();
}
if (fixture.scenario === 'export-blocked') {
  // Real export path: the authoritative capability report blocks with gaps.
  await controller.exportScene();
}
if (fixture.scenario === 'rollback') {
  // Historical previz rollback through the REAL controller against the ported
  // workbench contract: edit shots+keyframes → save → accept a previewed
  // change set → edit further → save → roll back to the retained payload.
  controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-1', frame: 12 });
  controller.editNodeTransform('hero', { translate: [2, 0, 0] });
  await controller.save();
  const accepted = await controller.acceptChangeSet('changeset:browser-rollback');
  controller.editShotKeyframe('shot:opening', { type: 'move-keyframe', keyframeId: 'kf-1', frame: 24 });
  controller.editNodeTransform('hero', { translate: [5, 0, 0] });
  await controller.save();
  const rolledBack = await controller.rollbackChangeSet('changeset:browser-rollback');
  await controller.refreshChangeSets();
  const snapshot = controller.getSnapshot();
  const legacy = await remote.sceneRead(target);
  window.__rollbackEvidence = {
    acceptedStatus: accepted.status,
    rolledBackStatus: rolledBack.status,
    finalVersion: snapshot.document?.version,
    heroTranslate: snapshot.document?.nodes.find(node => node.id === 'hero')?.transform.translate,
    keyframeFrame: snapshot.shots[0]?.keyframes.find(keyframe => keyframe.id === 'kf-1')?.frame,
    saveStatus: snapshot.saveStatus,
    legacyCarriesShots: legacy !== null && typeof legacy === 'object' && 'shots' in legacy,
  };
}
document.body.dataset.director3dMounted = fixture.scenario;
</script>
</body></html>`
}
