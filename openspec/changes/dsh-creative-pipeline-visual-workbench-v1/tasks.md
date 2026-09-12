# Tasks

## Group 1: Contract and documentation

- [x] 1.1 Create proposal, design, spec and dependency links for the Agent-background pipeline surface.
- [x] 1.2 Update `docs/design/dsh-project-canvas.md` with the five node types, reference/execution edges, background Agent and inspector relationship.
- [x] 1.3 Update `docs/design/dsh-creative-workflow.md` with execution-edge inspection, pause/resume, confirmation fences and preserved blocked states.
- [x] 1.4 Update the creative program/document index to link this change and distinguish protocol, fixture, real-owner and production evidence.
- [x] 1.5 Run strict OpenSpec validation and link checks; record evidence before code work.

## Group 2: Eikona UI reference canary

- [x] 2.1 Prepare three redacted prompts for overview, running inspector and blocked Agent drawer; pin viewport and aspect ratio.
- [x] 2.2 Run Eikona local/fixture canary for the three prompts without invoking a paid provider.
- [x] 2.3 Record run/artifact lineage, prompt digest/summary, dimensions, channel, fixture status and evidence path under `temp/integration-test-runs/<run-id>/`.
- [x] 2.4 Copy only reviewed reference images to `docs/design/references/dsh-creative-pipeline/` and add a README explaining provenance and non-evidence status.
- [x] 2.5 Review all three images against the unified visual system for hierarchy, density, edge semantics and Agent background treatment.

## Group 3: Pre-implementation gate

- [x] 3.1 Mark which visual conclusions become UI Contract and which remain exploratory.
- [x] 3.2 Confirm the first implementation slice: default workbench, execution-edge selection, inspector empty/blocked states and Agent drawer.
- [x] 3.3 Keep 3D workbench, real provider canary, production delivery and billing acceptance out of this local documentation gate.
- [x] 3.4 Do not begin UI implementation until Groups 1 and 2 have review evidence.（证据：`docs/design/references/dsh-creative-pipeline/README.md` 的 2026-09-11 评审结论已记录 overview/running-inspector/blocked-agent-drawer 三图的信息架构评审结果）

## Verification

- [x] `openspec validate dsh-creative-pipeline-visual-workbench-v1 --strict --no-interactive`（2026-09-11 通过：`Change 'dsh-creative-pipeline-visual-workbench-v1' is valid`）
- [x] Documentation link/path check（2026-09-11：design.md 引用的 `docs/design/dsh-unified-panel-visual-system.md`、`packages/client/ui-surface`、`packages/client/ui-pane-domain/src/project-canvas-view.tsx`、`docs/design/references/dsh-creative-pipeline/` 三图及 `temp/integration-test-runs/creative-pipeline-eikona-20260911/manifest.json` 均存在）
- [x] Eikona lineage and redaction check（2026-09-11：manifest 含 run/artifact lineage、prompt SHA-256、尺寸、渠道与评审结论，无 raw prompt/凭据/provider payload/绝对路径；`overview.prompt` 为空文件。注意：Eikona 工具原生 run 目录含绝对路径输出，位于 gitignored `temp/` 内，不入库）
- [x] Visual review record for overview, running and blocked states（2026-09-11：`docs/design/references/dsh-creative-pipeline/README.md` §评审结论记录三图逐张评审结果与未冻结范围）

## Group 5: ComfyUI 工作台与工作面胶囊

- [x] 5.1 冻结顶部 Agent/工作台 胶囊的尺寸、状态点、运行进度、待审阅标记和展开菜单合同。（D2 `pipeline/capsule.tsx` + D6 接线 `pipeline/workbench-controller.ts`：切换只改本地工作面，不重置 projectRef/选区/运行；`tests/pipeline-integration.spec.tsx` 覆盖）
- [x] 5.2 实现项目下拉、Workflow/Models/Assets/Render/Gallery 工作面导航，并保持项目、选区、运行和权限不变。（D2 `pipeline/workbench-nav.tsx`；D6 pane `pipeline/workbench-pane.tsx` 注册 `creator.pipeline`/`drama.pipeline.workbench`，probe-first 降级）
- [x] 5.3 实现左侧图标资产导航、Productions 卡片、中部节点画布、右侧 Inspector/Versions/Comments 与底部只读运行区。（D2 `pipeline/workbench-shell.tsx`；D6 接入 ui-pane-domain ProjectCanvas 画布宿主与 inspector 边选中接线）
- [x] 5.4 实现图片/视频安全引用、缩略图、播放预览、loading/error/unavailable 与拖入画布 handoff。（D3 `pipeline/media*.ts*`；D6 画布区域 onDrop 接 `handlePipelineMediaDrop`，onReject 原因显示到画布可见区域，asset 节点创建意图落到本地画布草案）
- [x] 5.5 覆盖桌面、窄屏、loading、running、blocked、stale、unknown、needs_contract 与胶囊切换视觉证据。（2026-09-11：`tests/ui-visual/visual-pipeline-workbench.spec.ts` 9 个场景全绿（`node scripts/run-ui-visual-tests.mjs visual-pipeline-workbench.spec.ts`，exit 0），12 张截图与 manifest 落盘 `temp/integration-test-runs/pipeline-workbench-visual-20260911/`；真实 drama-director client bundle + fixture owner 投影，覆盖桌面三栏 1152、窄屏 400 对象列表+详情 Modal、loading、running、blocked、stale、unknown、needs_contract、胶囊 agent⇄workbench 切换与展开菜单。评审修复后于 2026-09-11 重建 `lib/client.js` 并重跑 9/9 通过、刷新截图（source run `ui-visual-2026-09-11T20-23-33-282Z-3895994`）；修复内容：tablist aria-label 去重为 "Pipeline detail tabs"、envelope schema 中性化为 `dsh.creative-pipeline-workbench-snapshot.v1alpha1`、runAction dispatch 前复查禁用矩阵）
- [x] 5.6 复核附件 ComfyUI 参考图只影响空间关系和密度，不把截图文字、私有实现或 provider 行为写入协议。（2026-09-11：对照 `docs/design/references/dsh-creative-pipeline/revision-20260912/comfyui-overview.png` 与 5.5 截图逐区确认——左图标导航/中画布/右 Inspector·Versions·Comments/底部 Log·Validation·Render Queue/顶部工作面导航+Agent 胶囊的空间对应成立；协议（creative-pipeline decoder 与 PipelineRunProjectionSchema）只含 opaque ref、有界摘要、状态枚举与 server-authored action，无参考图文案（Reelfolio、Shot 020、Cosmos Video 等）、私有实现或 provider 字段；结论同录于上述 manifest `reference_review_5_6`。评审修复补齐：`docs/design/references/dsh-creative-pipeline/README.md` 新增「评审记录（revision-20260912）」节，记录三张图的本地 codex:imagegen canary 来源与非证据地位、2026-09-11 复核结论及协议侧证据，并注明 `temp/integration-test-runs/creative-pipeline-eikona-20260912-comfyui/` 缺 manifest 属已知 lineage 缺口（不改写工具原生输出））
