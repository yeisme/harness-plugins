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

## 推进节奏建议

1. 每轮聚焦一个 Goal，避免同时改太多包。
2. 每个 Goal 必须有可运行验证命令。
3. 官方宿主 slot 出现前，G4 保持“gate 已就绪，等待外部”。
4. 真实 DSH seam 接入前，先用 `createStaticHostProjection` / `createDshHostProjection` 保证组合层可独立测试。
5. fork 退役后：需要 core 改动的 seam 一律登记 `upstream-prs/`（含 patch 与测试），插件侧 probe+降级；不做本地源码 fork，日常上游跟进交给 canary/pr-rebase 自动化，人只在红灯 issue 时介入。
