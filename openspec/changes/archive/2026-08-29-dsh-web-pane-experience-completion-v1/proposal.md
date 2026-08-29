## Why

Pane Workbench V4 的 tab/拖拽/designer 与做剧 Director Pack 的 host 合同都已交付，但用户在真实 `dsh web` 上看到的仍是"残废"体验：`workspace.core-pane.v1` seam 未进官方发布版，pane 工作区只能以简化 overlay 抽屉挂载（所有 group 塌缩成一条 tab 条，无完整 chrome）；AI Drama Director 的 client 还是 console.log 级 stub、capability probe 硬编码 `false`，做剧入口整体不可用；各插件独立 probe，用户面对死按钮没有任何"当前处于什么能力等级、缺哪个 seam、如何解锁"的指引。本 change 把体验分级显式化，并在插件侧把不依赖上游 seam 的部分一次做完整。

## What Changes

- 建立 **Experience Tier 模型**（Tier 0 发布版 overlay / Tier 1 Core Pane docking / Tier 2 全 seam），每个 tier 的可用交互、probe 合同与降级文案全部规格化；tier 判定结果成为运行时一等投影。
- 升级 Official Overlay 宿主：从"塌缩抽屉"升级为完整单 region 工作台——复用 V4 已实现的 tab 系统（pinned/preview/overflow/bulk close）、区域内 tab 拖拽重排、锚定 Quick Pick、视图菜单与完整键盘等价路径；明确不实现 split/dock 几何（那是 host 职责，保持 probe + 禁用原因）。
- 完成 AI Drama Director client 真接线：drama 六个视图注册进 Pane Workbench `registerView()` runtime（不依赖官方 pane seam）；/drama 命令面按「command-experience seam → slash 目录 → 禁用+原因」顺序 probe；Director preset 经 workspace preset service 应用并在 Tier 0 塌缩为单 region tab 集；DramaContextV1 真实经 host transport 解析，脱敏证据事件落盘。
- 打通做剧 ↔ Workbench 场景回路：`Open in Workbench` 经 WorkbenchHandoffV1 深链（expiry/nonce 校验、目标端重新拉取 owner 数据）；跨模块 artifact handoff 菜单/拖拽按本仓 `pane-artifact-handoff` 合同实现并对官方 `ArtifactRefV1`/`ArtifactIntentV1` seam 保持 probe；Drama/Code/Review/Media 场景 preset 与 workbench 模块映射规格化。
- 新增 Workspace 能力矩阵投影（`/workspace` doctor 视图与脱敏证据事件）：展示当前 tier、各 seam probe 状态、每个禁用入口的原因与解锁路径，杜绝"死按钮无解释"。
- 所有 seam 缺失路径保持 fail-closed：禁用+原因，不伪造 host 区域、不实现 AppFrame 几何、不做轮询/本地 fake 回退。

## Capabilities

### New Capabilities

- `pane-overlay-workbench-experience`: Tier 0（发布版 DSH、无 workspace seam）下 overlay 宿主的完整单 region 交互合同——tab 系统复用、区域内拖拽重排、Quick Pick、菜单、键盘路径、响应式与 i18n，以及 split/dock 等 host 几何能力的诚实禁用语义。
- `dsh-ai-drama-client-runtime`: AI Drama Director 的 client 运行时接线——视图注册进 Pane Workbench runtime、命令面 probe 链、Director preset 应用与 Tier 0 塌缩、DramaContextV1 消费、证据事件与 dispose 语义。
- `workbench-scenario-handoff`: 做剧与 Workbench 的场景级联动——WorkbenchHandoffV1 深链消费门、基于本仓 artifact handoff 合同的跨模块菜单/拖拽意图（官方 seam probe-gated）、场景 preset 与 workbench 模块映射。
- `workspace-capability-matrix`: Experience Tier 判定、seam probe 状态聚合投影、disabled reason 标准化与解锁指引、脱敏诊断证据事件。

### Modified Capabilities

无。本 change 只新增 capability；Tier 1 的 docking 合同已由 `dsh-pane-workspace-docking`/`pane-workbench-interaction` 覆盖，drama host 端合同已由 `dsh-ai-drama-*` 四个 capability 覆盖，均不修改。

## Impact

- `packages/client/ui-pane-workbench/src/official-host.ts` 及 chrome/tab/drag/quick-pick 组件在 overlay 宿主的复用接线；`packages/bundle/pane-workbench`。
- `packages/client/ui-ai-drama-director`（client 从 stub 转为真实注册与 probe）；复用 `packages/host/dsh-ai-drama-director` 已有 typed 合同，不改 host 语义。
- `packages/bundle/dsh-workbench-compose`、`packages/bundle/dsh-ai-drama-director` 的入口与 profile 声明（保持单行可逆 insert）。
- probe 依赖（只探测、不要求合入）：`upstream-prs/pane-workspace-layout`（Tier 1）、`upstream-prs/command-experience-router`（命令面）、`upstream-prs/preview-resource-v1` 与 TerminalHostV2（Tier 2）。
- 文档：`docs/design/` 新增体验分层设计说明；`docs/design/dsh-workbench-roadmap-goals.md` 增加 Goal 映射；`docs/README.md` 入口索引。
- 相邻 change 的关系：不阻塞也不复制 `dsh-pane-workspace-experience-v3`（preview 平台/renderer/终端 lane 继续独立推进）、`dsh-ai-drama-director-pack-v1`（其 3.5/3.6 metadata CLI 缺口保持原 owner，本 change 只消费其产物合同）；`dsh-core-pane-only-next-rc` 与 `dsh-pane-agents-host-compat-v1` 的归档漂移在本 change 文档任务中登记跟进。
