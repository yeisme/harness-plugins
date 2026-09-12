# Tasks

## Group 1: Contracts and documentation

- [x] 1.1 Add typed scene graph, Shot, canvas binding, capability report, generation change set, and conflict contracts.（2026-09-11 合同冻结落点：`packages/host/pane-protocol/src/index.ts` 新增 `SCENE_3D_SCHEMA`/`SceneDocumentV1`/`ShotV1`/`CanvasBindingV1`/`GenerationChangeSetV1` 与 `SceneGraphSaveResult` conflict+draft 族；测试 `packages/host/pane-protocol/tests/scene-3d.spec.ts`）
- [x] 1.2 Define glTF/GLB import/export capability matrix and opaque extension preservation rules.（2026-09-11 合同冻结落点：`GltfCapabilityReportV1` + `GLTF_2_0_OFFICIAL_EXTENSIONS` 注册表；readable/editable/exportable/opaque-preserved 级别、无法保真导出必须 block+capability gap 的不变量已在 schema superRefine 与 scene-3d.spec.ts 固化；导入/导出器实现仍在 Group 2）
- [ ] 1.3 Add 3D Director pane design using the unified visual system UI Contract.
- [ ] 1.4 Link this change from project canvas, creative workflow, creative program, and docs index.
- [ ] 1.5 Add the 3D Director skill and sync project skill references.

## Group 2: Host projection and persistence

- [ ] 2.1 Implement safe host projection and revision validation.
- [ ] 2.2 Implement versioned scene graph storage and snapshot export seam.
- [ ] 2.3 Implement generation change-set preview/accept/reject/rollback descriptors.
- [ ] 2.4 Implement conflict freeze and owner reconcile handoff.

## Group 3: Client workbench

- [ ] 3.1 Implement Shot navigation, canvas/viewport selection convergence, and inspector states.
- [ ] 3.2 Implement camera, timeline, transform, visibility, and keyframe editing.
- [ ] 3.3 Implement glTF/GLB capability display and export blockers.
- [ ] 3.4 Implement generation preview and auditable change-set controls.

## Group 4: Verification

- [ ] 4.1 Add typed contract tests for core glTF/GLB and opaque extensions.
- [ ] 4.2 Add three reproducible Shot integration scenarios: import/edit, generation/revert, conflict freeze/export.
- [ ] 4.3 Run `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `pnpm run check:bundles`, `pnpm run check:surfaces`, `pnpm run test:visual`, and `pnpm run check:plugins`.
- [ ] 4.4 Run strict OpenSpec validation and record redacted evidence under `temp/integration-test-runs/<run-id>/`.
