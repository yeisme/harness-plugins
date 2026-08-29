## Context

当前状态（2026-08-27 盘点）：

- **交互实现已在、无处安放**。V4（`archive/2026-08-25-dsh-pane-workspace-interaction-v4`）交付了完整 tab 系统、拖拽动效、Workspace Designer、i18n、Explorer/Git，代码在 `packages/client/ui-pane-workbench/src/`（约 6700 行真实实现）。但 `workspace.core-pane.v1` + `shell.workspace.right/bottom` seam（`upstream-prs/pane-workspace-layout`）未进官方发布版；官方 rc 上 `probePaneWorkbenchHost` 只能走 `OfficialOverlayPaneHost`——一个 `position:fixed` 右侧抽屉，把所有 Pane group 塌缩成一条手写 tab 条（`official-host.ts` 注释自述 "Pre-Core DSH collapses every Pane group into one tabbed right drawer"）。V4 的 chrome 组件（`tabs.tsx`、`drag-coordinator.ts`、Quick Pick、菜单）在 overlay 路径完全没有被挂载。
- **做剧 client 是 stub**。`packages/client/ui-ai-drama-director/src/client/index.ts` 里命令/pane/preset 注册全是 `console.log`，注释写着 "would go here when DSH command registry is available"，`probeDramaCapability()` 硬编码 `return false`。这个假设已过期：Pane Workbench 的 `registerView()`/`openView()` runtime 是本仓插件自有面，今天就能注册；命令面有 `dsh-command-experience-session-keymap-v1` 与 `dsh-slash-directory-hotplug-v1` 两条本仓通道加 `upstream-prs/command-experience-router` seam 可 probe。host 端（`packages/host/dsh-ai-drama-director`）的 DramaContextV1、handoff signer、证据合同已完整，两端成熟度严重不对称。
- **能力状态不可见**。每个插件各自 probe、各自禁用，用户只看到按钮死掉或入口消失，没有任何"当前 tier、缺哪个 seam、装什么能解锁"的统一投影。
- **协议约束**（`docs/plugin-host-protocol.md`）：插件禁止实现 AppFrame 几何/Details 优先级/PTY duplex；host 改动唯一通道是 `upstream-prs/`；官方合入、`dsh web` 实测都不是插件完成门；新 capability 只写 ADDED。

利益相关方：做剧用户（Director Pack）、Workbench 组合用户（compose/desktop）、上游 seam 维护（`yeisme/deepseek-harness` pr 分支 + canary 自动化）。

## Goals / Non-Goals

**Goals:**

- 用 Experience Tier 模型把"残废 vs 完整"从隐式二元状态变成显式、可诊断、可引导升级的运行时合同。
- Tier 0（今天所有发布版用户）拿到完整单 region 工作台交互：真 tab 系统、区域内拖拽重排、Quick Pick、菜单、键盘路径、响应式与 i18n。
- 做剧在 Tier 0 即可用：/drama 命令可达、Director preset 落地、Context/Review/Run 三 pane 真实渲染（内容经 host transport + creator-studio projection probe）、handoff 可发起。
- Workbench 场景回路闭合：drama → Workbench 深链可消费门校验；跨模块 artifact handoff 按本仓合同先行，官方 seam 到位后无缝升级。
- 每个禁用入口都有原因与解锁路径（capability matrix 投影 + 标准化 reason 文案）。

**Non-Goals:**

- 不实现 AppFrame 几何（四列两行/split/dock 的 host 侧实现），不把 overlay 伪装成 dock 区域。
- 不实现 PTY duplex、不做 xterm 真终端（Tier 2，归 `dsh-pane-workspace-experience-v3` §6 与 TerminalHostV2 seam）。
- 不重建 Creator Studio、不扩展 Scaena、不做第二 scheduler/gateway（沿用 drama pack 既有非目标）。
- 不修改 `dsh-ai-drama-*`、`pane-workbench-interaction`、`dsh-pane-workspace-docking` 等已有主 spec 的任何 requirement。
- 不以官方 PR 合入、官方 `dsh web` 实测、真实 profile Playwright 作为任何任务的完成条件。
- 不解决 drama pack 3.5/3.6 的 metadata CLI（那是 `dsh-ai-drama-director-pack-v1` 自己的缺口，本 change 只消费其产物合同）。

## Decisions

### D1：Experience Tier 作为运行时一等投影，而不是文档分类

定义 `WorkspaceExperienceTierV1`：`{ tier: 0 | 1 | 2, probes: Record<string, ProbeStateV1>, reasons: Record<string, string> }`，由 pane-workbench 在 `apply()` 时一次性判定并订阅 seam 热插拔事件（slash 目录热插拔已有先例）。tier 判定纯函数化（输入 probe 结果集，输出 tier），可单测。

- Tier 0：无 `workspace.core-pane.v1`。overlay 宿主，单 region 完整交互。
- Tier 1：`workspace.core-pane.v1` + `shell.workspace.right/bottom` 齐。Core Pane docking，V4 全量交互（现状代码路径，不动）。
- Tier 2：Tier 1 + `TerminalHostV2` + PreviewResourceV1 + ArtifactRef 官方 seam。真终端/生产预览/官方 handoff。

备选：继续隐式 probe-per-feature（现状）。否决理由：残废感的根源就是状态不可见；显式 tier 同时服务 UI 降级、证据事件与文档话术。备选二：用版本号比较（`>=rc.x`）。否决：probe 能力字符串比版本号诚实（rc.9 已证明"有残缺 workspaceLayout"这种中间态存在）。

### D2：Tier 0 overlay 复用 V4 chrome 组件，而不是另写一套"简化版"

`OfficialOverlayPaneHost` 重写为挂载与 Core host 相同的 tab 系统（`tabs.tsx`）、Quick Pick、视图菜单与 i18n，只是 region 拓扑固定为单 group：reducer 仍是同一个 `PaneWorkspaceV1` store，split/move-cross-region/maximize 等意图在 Tier 0 下 dispatch 前被 capability gate 拦截并返回标准 disabled reason。区域内 tab 拖拽重排复用 `PaneDragCoordinator`（其 generation/阈值/磁滞语义不变），drop intent 集合在 Tier 0 收敛为 `reorder_within_group`。

合规性论证：`docs/plugin-host-protocol.md` 禁止的是"插件实现 AppFrame 几何"（四列两行、Details 优先级）。单 region 内 tab 管理是插件自有 overlay 内容，不触碰 host 几何；V2 起 overlay fallback 就是合法路径（`dsh-pane-agents-host-compat-v1` 确立）。备选：给 overlay 自研简化 tab 条（现状）。否决：两套交互模型双倍维护且体验割裂，正是"残废感"来源之一。

### D3：drama client 注册进 Pane Workbench runtime，命令面走三级 probe 链

- 视图：六个 drama 视图（Context/Story/Visual/Audio/Run/Review）通过 `PaneWorkbenchClientFace.registerView()` 注册——这是本仓插件间公开面，Tier 0/1 都可用。`probeDramaCapability` 改为真实 probe 组合：pane-workbench inject + creator-studio projection transport + drama host transport。
- 命令：主路径是**本仓 command-experience 的 live `/` 目录**——以 `PaneCommandDescriptor` 贡献（`presentation.launcher: true` + `slash.name: 'drama'`，category=work），无需编辑 command-experience 目录码，卸载即消失，保留 P0 名冲突按 pane-protocol 合同禁用。上游 `command-experience-router` seam 只是增强投影 probe（该系列仍处 exploration 阶段），不是注册前置条件。command-experience 面整体缺失（极简 profile）时 /drama 组禁用并给标准 reason，pane 内操作仍可用（pane 不依赖命令面）。
- 键盘：drama 快捷键经 command-experience 共享 keymap 面（`CommandKeymapConfig`/`resolveKeymap`）声明与解析，替换 stub 里的裸 window keydown 监听；冲突按 keymap 面规则降级可见。
- Preset：Director preset 经 `workspace-preset.ts` 应用；Tier 0 下塌缩语义规格化（三个默认视图进同一 region 的 tab 集，secondary 视图按需开 tab，不伪造第二个 region）。
- Context/证据：DramaContextV1 经 host transport 真实解析；`recordDramaEvidence` 复用现有脱敏合同。

备选：继续等"官方 pane/command registry"。否决：该假设是 stub 时代的过期注释；本仓 runtime 已存在且被 desktop-workbench、creator-studio 使用。备选二：drama 自建独立 shell。否决：违反"不创建第二侧栏/第二工作台"的既有非目标。

### D4：场景 handoff 双轨——本仓合同先行，官方 seam probe-gated 升级

跨模块 artifact handoff（compose 6.4 的缺口）按本仓主 spec `pane-artifact-handoff`（ArtifactRefV1/ArtifactIntentV1 已是主 spec）实现菜单与拖拽意图；当官方 ArtifactRef/Intent seam 出现时经 probe 切换到官方通道，插件侧合同不变。`Open in Workbench` 深链消费 WorkbenchHandoffV1（host signer 已实现）：client 侧增加消费门——expiry/nonce 校验、intent 白名单（open_show/open_episode/open_review/open_artifact/open_evidence）、过期/未知一律拒绝并记证据事件，目标端必须重新向 owner 拉数据。

备选：等官方 seam 冻结再动手（compose 6.4 现状）。否决：本仓合同已是主 spec，且 drama↔workbench 是做剧用户的核心回路；双轨让今天的用户可用、未来的升级零 breaking。

### D5：Workspace 能力矩阵作为诊断视图 + 证据事件，而非新设置页

`/workspace capabilities`（命令面 probe 链可达时）与 pane-workbench 设置/帮助入口展示同一份投影：当前 tier、每个 seam 的 probe 状态与 disabled reason、解锁指引（指向 bundle/seam 文档锚点）。同时发脱敏证据事件（tier 分布、禁用原因类别、解锁点击类别），复用 drama/productivity 的证据落盘管道（`temp/integration-test-runs/<run-id>/`），不含 URL/token/路径/内容。备选：做独立 doctor 插件包。否决：矩阵是 pane-workbench 自身状态的投影，独立包只会复制 probe 逻辑。

### D6：与相邻 change 的边界

本 change 不动 `dsh-pane-workspace-experience-v3` 的 preview/renderer/terminal lane（Tier 2 内容归它），不动 `dsh-ai-drama-director-pack-v1` 的 3.5/3.6（metadata CLI），不改写任何已归档历史。`dsh-core-pane-only-next-rc` 与 `dsh-pane-agents-host-compat-v1` 任务全勾但未归档造成主 spec 漂移（legacy fallback 语义），本 change 在 tasks 里登记"推动归档/对齐"作为文档任务，不代行归档。

### D7：Tier 0 塌缩是渲染态投影，canonical 布局持久化必须 round-trip 无损

Overlay 的多 group 塌缩只发生在渲染层；reducer 持有的 canonical `PaneWorkspaceV1` 保持完整 region/group 结构，持久化写出的始终是 canonical 数据。这样 Tier 1 布局在 Tier 0 会话往返后无损恢复，seam 热插拔导致 Tier 0→1 升级时宿主切换也不丢 tab/状态。备选：Tier 0 直接改写布局为单 region 再持久化（实现简单）。否决：用户跨环境（桌面/浏览器、新旧版本）往返会静默摧毁布局，这比"残废"更伤信任。

### D8：Preset 应用与 preset 持久化解耦

应用 Director preset 是本地原子布局提交（draft apply），不依赖 settings owner；只有用户显式保存 preset 变体才走 `PaneWorkspacePresetServiceV1` 的 create/update（receipt 可能 `rejected`/`permission_denied`）。持久化被拒不阻断布局应用，只禁用写操作并给 reason。

## Risks / Trade-offs

- [Tier 0 overlay 复用 V4 chrome 后组件体积增大，低端设备/窄屏性能下降] → 复用既有有界测量与虚拟窗口合同；390px 断点已在 V4 测试矩阵内，overlay 路径补同等矩阵；性能预算沿用 drag-motion spec（pointermove 零 dispatch）。
- [双轨 handoff 造成"本仓合同"与"官方 seam"语义长期分叉] → spec 明确官方 seam 为上位合同：probe 命中即切换，本仓路径仅作降级；切换行为写入 spec scenario。
- [capability matrix 暴露过多内部状态] → 投影只含 tier、probe 布尔、标准 reason key 与文档锚点；reason 文案走 i18n namespace，不拼接内部字符串。
- [Tier 0 preset 塌缩让多视图挤进单 region，信息密度过高] → 塌缩语义限制默认 visible tab ≤4（沿用 V2 可见上限），secondary 视图保持按需打开，与 drama pane-preset spec 的"最多三个 visible pane"一致。
- [用户把 Tier 0 完整单 region 误认为 docking 已可用，产生错误预期] → 能力矩阵与禁用 reason 明确写"split/dock 需要 workspace seam"；UI 上 split 类控件禁用可见而非隐藏。
- [drama client 真接线后暴露 host/transport 未覆盖的边界 case] → 全部 mutation 经 typed handler + admission；unknown/partial 不自动重试（沿用 drama command-surface 合同）。

## Migration Plan

纯 additive：overlay 宿主升级替换 `official-host.ts` 内部实现但保持挂载协议（`mountOverlayPaneHost` 签名与 `provide('paneWorkbench')` 语义不变）；drama client 从 stub 转真实注册不改 host 合同；bundle 只新增/调整单行 profile insert。回滚 = 摘除 bundle 行或回退包版本，无持久化迁移（pane persistence 只存布局与安全引用，tier 信息不落盘、每次启动重判）。

## Open Questions

- Tier 2 的 PreviewResourceV1 upstream PR（productivity-ui-v3 task 1.4）推进节奏是否并入 upstream-canary 统一管理？倾向：是，但由 seam program 决定。
- drama 命令 slash 短名冲突策略已有着落：pane-protocol 合同的保留 P0 名 + 冲突禁用语义直接适用，无需新增规格。
- WorkbenchHandoffV1 的消费端在 yeisme-workbench 仓，本仓只能验 signer/门校验；跨仓联调证据的归属目录需要与 workbench 仓约定（暂放本仓 `temp/integration-test-runs/` 并互引）。
