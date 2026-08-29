# DSH Workbench 后续推进 Goal 与 Spec 任务映射

> 状态：规划（2026-08-20 起 dsh 源码 fork 退役：`client/deepseek-harness` submodule 删除，core seam 一律走 `agent/harness-plugins/upstream-prs/` 上游 PR 通道 + capability probe 降级；上游跟进由 harness-plugins 的 upstream-canary / pr-rebase workflows 自动化）
> 用途：为后续多轮推进提供可执行、可验证的 Goal 目标，并映射到各 OpenSpec tasks。

## Goal 体系

| Goal | 标题 | 范围 | 完成判据 |
| --- | --- | --- | --- |
| G1 | 真实 DSH fs seam 接入 | File/Document 模块接入 `ctx.fs`/owner seam（通道：upstream PR + probe） | FileEntry 来自真实 Host，文件树可展开，预览 URL 由 Host 授权 |
| G2 | 真实 DSH media seam 接入 | Rich Media 接入 `ctx.attachments`/media owner（通道：upstream PR + probe） | 媒体列表来自真实投影，图片/音视频可预览 |
| G3 | 真实 DSH terminal seam 接入 | Terminal 模块接入 PTY owner（`TerminalInteractiveCapabilityV1` 走 upstream-prs） | TerminalPanel 显示真实 PTY 流，支持 detach/reconnect |
| G4 | 官方宿主注册 | 官方 Workbench/Pane slot 可用后完成正式注册 | `registerComposedWorkbenchHost` 在真实 slot 上生效 |
| G5 | 模块生态扩展 | 增加 Git/Browser/Jobs/Plan/Skills 等模块 | 至少再新增 2 个模块并通过 conformance |
| G6 | 组合体验完善 | Demo 丰富、命令面板增强、拖拽 handoff | 可运行 demo 覆盖多模块组合与跨模块意图 |
| G7 | 发布与文档 | 包发布、README、OpenSpec 全绿 | 所有包 typecheck/test/build 通过，OpenSpec valid |
| G8 | Workbench 按需激活与文件树 | Pane Workbench 默认休眠，`openView`/Show/文件树入口自动加载启用；文件树从 Host 按需加载 | `dsh-pane-workbench-auto-activation-v1` OpenSpec 全绿，相关 package tests 通过 |
| G9 | dsh fork 退役 | `client/deepseek-harness` submodule 删除；seam 开发固化为 `upstream-prs/` patch 系列；上游跟进自动化 | root 仓无 dsh submodule；`upstream-prs/` 四系列可干净 apply（pr-rebase 绿）；upstream-canary 对最新发布 dsh 绿 |
| G10 | 产物合同与 CI 落地 | 全部 bundle client 产物满足 ModuleLoader 单文件契约；CI 首跑绿 | `dsh-bundle-artifact-contract-v1` 全绿；`pnpm check:bundles` 14/14；ci.yml 首次 run 绿 |
| G11 | upstream seam 推进 program | Wave A（4 个完整 patch 系列）推上游 PR；合入后插件侧解锁 | `dsh-upstream-seam-push-program-v1` tasks 按波次勾选；PR 链接登记进各系列 README |
| G12 | Pane 体验完成度（做剧 × Workbench） | Experience Tier 模型落地：Tier 0 overlay 完整单 region 交互、drama client 真接线、场景 handoff 双轨、能力矩阵投影 | `dsh-web-pane-experience-completion-v1` OpenSpec 全绿；Tier 0 交互测试矩阵与 handoff 集成证据落盘 |
| G13 | DSH → Workbench AI 做剧 Bridge V2 | 收敛两套不兼容 handoff，接入 `/agent` Spatial lenses，建立 approved launcher、双栈迁移和跨仓 conformance | `dsh-workbench-ai-drama-bridge-v2` 已归档；provider/consumer 使用同版本 fixture，canary 与回滚门保持显式 |
| G14 | Director Pack 发布闭环 | 将 manifest/profile/compatibility metadata 迁移到 repository application service，并证明 install/uninstall/reinstall 与 dispose 完整幂等 | 已完成并归档到 `archive/2026-08-29-dsh-ai-drama-director-pack-v1`；metadata drift、ModuleLoader lifecycle、pack conformance 与脱敏证据全绿 |
| G15 | Director Operational Panes | 发布共享 Creator runtime，并把 Context/Story/Visual/Audio/Run/Review 六个 Pane 接入真实安全投影 | `dsh-ai-drama-operational-panes-v1`：共享 store、显式 refresh、legacy 只读回退、状态重置和六 Pane 测试全绿 |
| G16 | Show Control Room | 提供单 Show 绑定的 Episode Board、Review Inbox、Asset Wall、Delivery 与 owner batch action | `dsh-ai-drama-show-control-room-v1`：四 Pane、四命令、`show-control` preset、100 项边界与 owner adapter conformance 全绿 |
| G17 | Review & Delivery Depth | 补齐富媒体时间轴、selection-owner 批注、跨集/版本比较和交付审计深度 | `dsh-ai-drama-review-delivery-depth-v1`：媒体生命周期、版本围栏、批注 repair handoff、rights/evidence/receipt history 全绿 |

## Goal → Spec 任务映射

| Goal | 主要 OpenSpec tasks |
| --- | --- |
| G1 | `dsh-file-document-v1/tasks.md` 5.1–5.3 |
| G2 | `dsh-rich-media-plugin-v1/tasks.md` 4.1–4.6、5.x 后续 |
| G3 | `dsh-terminal-v1/tasks.md` 新增 3.x |
| G4 | `dsh-workbench-compose-v1/tasks.md` 5.3–5.10 后续 |
| G5 | `dsh-workbench-core-v1/tasks.md` 新增 7.x |
| G6 | `dsh-workbench-compose-v1/tasks.md` 新增 6.x |
| G7 | 各包 README + OpenSpec 校验 |
| G8 | `agent/harness-plugins/openspec/changes/dsh-pane-workbench-auto-activation-v1/` |
| G9 | `agent/harness-plugins/upstream-prs/`（四系列 + backlog）、`.github/workflows/{upstream-canary,pr-rebase}.yml` |
| G10 | `openspec/changes/dsh-bundle-artifact-contract-v1/`、`scripts/check-bundle-contracts.mjs`、`.github/workflows/ci.yml` |
| G11 | `openspec/changes/dsh-upstream-seam-push-program-v1/`、`upstream-prs/*/README.md` |
| G12 | `openspec/changes/dsh-web-pane-experience-completion-v1/tasks.md` 1.x–6.x |
| G13 | `openspec/changes/archive/2026-08-29-dsh-workbench-ai-drama-bridge-v2/tasks.md` 1.x–7.x、`docs/design/dsh-workbench-ai-drama-bridge-v2.md` |
| G14 | `openspec/changes/archive/2026-08-29-dsh-ai-drama-director-pack-v1/tasks.md`、`packages/bundle/dsh-ai-drama-director/scripts/` |
| G15 | `openspec/changes/dsh-ai-drama-operational-panes-v1/tasks.md` |
| G16 | `openspec/changes/dsh-ai-drama-show-control-room-v1/tasks.md` |
| G17 | `openspec/changes/dsh-ai-drama-review-delivery-depth-v1/tasks.md` |

## 推进节奏建议

1. 每轮聚焦一个 Goal，避免同时改太多包。
2. 每个 Goal 必须有可运行验证命令。
3. 官方宿主 slot 出现前，G4 保持“gate 已就绪，等待外部”。
4. 真实 DSH seam 接入前，先用 `createStaticHostProjection` / `createDshHostProjection` 保证组合层可独立测试。
5. fork 退役后：需要 core 改动的 seam 一律登记 `upstream-prs/`（含 patch 与测试），插件侧 probe+降级；不做本地源码 fork，日常上游跟进交给 canary/pr-rebase 自动化，人只在红灯 issue 时介入。
6. G13 先完成合同冻结和跨仓 fixture，再分别推进 DSH provider 与 Workbench consumer；不得用单仓测试替代 rollout-ready 结论。
7. G14 已归档；真实 `dsh plugin add` 与 Web boot 仍是可选 host integration，不作为插件完成阻塞。
8. G15 → G16 → G17 顺序推进：先稳定当前集运行时，再开放全剧聚合，最后叠加专业审片深度；任何阶段都不得把 owner ledger 下沉到浏览器。
