# Verification

状态（2026-09-12）：protocol 与 fixture/local 两层已证；real-owner 与 production 两层明确未宣称、未启动。

## 已证（protocol 层）

- 合同冻结：`packages/host/pane-protocol/src/index.ts` `SceneDocumentV1`/`ShotV1`/`CanvasBindingV1`/`GenerationChangeSetV1`/`GltfCapabilityReportV1` 与 conflict+draft 保存结果族；`packages/host/pane-protocol/tests/scene-3d.spec.ts`。
- Host Remote：`packages/host/dsh-3d-director/` `SceneGraphGateway`（`sceneRead`/`saveScene`/`reconcileScene`/`importGlb`/`exportGlb`/`listChangeSets` + 2026-09-12 评审 F4 新增 `previewChangeSet`/`acceptChangeSet`/`rejectChangeSet`/`rollbackChangeSet`），上下文 server 注入 + await 后重读 fence，出站重过 schema（携带 changeSet 的结果违例整体降级），GLB 字节永不进投影；`SceneGraphStore` revision 化 storageDomain 持久化 + journal 冲突/unknown 语义；`GenerationChangeSetLog` append-only + accept/rollback 经 conflict-fenced save。证据：包测试 58/58（gateway 25 + gltf-engine 17 + scene-store 13 + shot-scenarios 3），typecheck 绿。
- glTF/GLB 引擎：官方 2.0 扩展注册表全覆盖、required 扩展 fail-closed、opaque 保留、无法保真导出 block+具体 gap。证据：`tests/gltf-engine.spec.ts` 17 例。

## 已证（fixture/local 层）

- 客户端工作台：`packages/client/ui-3d-director/` 96/96 测试绿——probe 降级、controller（transform/visibility/keyframe draft、冲突冻结 Reapply/Discard、导出本地门控与 host gap 透传、change-set preview/accept/reject/rollback 全 fail-closed）、视口 WebGL 缺失降级为同等可选中场景树、ShotTimeline/ShotNavigator/previz step 采样（display-only 不回写）、冲突只读冻结 UI、导出 blocker gap 列表、`NodeTransformEditor` 输入校验/禁用矩阵（7 例）、`ChangeSetPanel` 状态矩阵与动作路由（12 例）。
- 做剧工作台嵌入：`packages/client/ui-ai-drama-director/` envelope `scene3d` 节（fail-closed）+ `remote.scene3dDirector` probe-first 入口 + 停靠视口 + CanvasBinding 双向选区 + 嵌入区节点编辑与 Save 控件 + fixture scene3d remote。证据（评审 F2 去重后）：`tests/pipeline-scene3d.spec.tsx` 15 例（controller 层）+ `tests/pipeline-scene3d-pane.spec.tsx` 6 例（pane 渲染层，含嵌入编辑/Save 两例），包测试 305/305 绿。
- Bundle：`packages/bundle/dsh-3d-director/` build + `smoke-bundle` PASS（gateway 诚实降级：无上下文读报 unavailable）；`pnpm run check:bundles` 28/28 PASS；`pnpm run check:surfaces` PASS；`pnpm run check:plugins` PASS。
- OpenSpec：`openspec validate dsh-3d-director-gltf-workbench-v1 --strict --no-interactive` 通过（2026-09-12）。

## 未宣称

- Real owner：未接真实 DCC/生成 owner；Shot/关键帧 draft 持久化 seam 未开（`scene3d-controller.ts` 注明 "Shots persist through a later seam"）。
- Production：无 provider、计费、交付、回滚与生产消费者证据。

2026-09-12 闭环追记：change-set accept/reject/rollback/preview Remote 面已开（见上）；三个可复现 Shot 集成场景（`tests/shot-scenarios.integration.spec.ts` 3/3，runner `scripts/run-3d-director-integration.mjs`）、脱敏运行证据 `temp/integration-test-runs/3d-director-20260912-131018-2734151/` 与视觉证据 `tests/ui-visual/visual-3d-director.spec.ts`（4 例，证据 `temp/integration-test-runs/ui-visual-2026-09-12T13-08-48-437Z-2709860/`）均已落盘。

完成门（不变）：OpenSpec strict validation、typed contract tests、三条 Shot 场景集成证据、glTF/GLB round-trip 与 opaque extension 保留证据、冲突冻结证据，以及仓库既有 typecheck/test/build/bundle/surface/visual/plugin 检查。截图不能代替运行证据。
