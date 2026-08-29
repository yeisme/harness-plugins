# dsh web Pane 体验完成度设计（做剧 × Workbench）

> 状态：设计已落 OpenSpec `openspec/changes/dsh-web-pane-experience-completion-v1/`（2026-08-27）。
> 用途：回答"dsh web 的 pane 交互为什么还是残废、怎么不靠等上游把它做完整"，并给后续实施提供旅程级参照。

## 1. 诊断：残废感的三层根因

**第一层：seam 缺口让完整交互无处安放。** V4 已交付真实可用的 tab 系统、拖拽动效、Workspace Designer（`packages/client/ui-pane-workbench/src/`，组件测试 198/198）。但物理 docking 依赖 `workspace.core-pane.v1` + `shell.workspace.right/bottom` seam（`upstream-prs/pane-workspace-layout`），未进官方发布版。官方 rc 上 `probePaneWorkbenchHost` 只能落到 `OfficialOverlayPaneHost`——一个把所有 group 塌缩成一条手写 tab 条的 fixed 抽屉（`official-host.ts` 自述 "Pre-Core DSH collapses every Pane group into one tabbed right drawer"）。用户看到的不是 V4 设计稿，而是这个抽屉。

**第二层：场景 client 是 stub。** AI Drama Director 的 host 端合同完整（DramaContextV1、handoff signer、证据），但 client 端注册全是 `console.log`、`probeDramaCapability()` 硬编码 `false`（`packages/client/ui-ai-drama-director/src/client/index.ts`）。其注释假设的"DSH command/pane registry 不可用"已过期：Pane Workbench 的 `registerView()` 是本仓插件自有面，今天就能注册。做剧在 dsh web 上因此是整体不可用，而不是部分降级。

**第三层：能力状态不可见。** 每个插件各自 probe、各自静默禁用，用户面对死按钮得不到"当前处于什么能力等级、缺哪个 seam、装什么能解锁"的任何指引。残废感 = 缺失能力 × 不可见原因。

## 2. Experience Tier 模型

把"能不能用"从隐式二元状态变成显式运行时投影 `WorkspaceExperienceTierV1`（纯函数判定，不落盘，seam 热插拔重判）：

| Tier | 前置 seam | 用户拿到的体验 | 状态 |
| --- | --- | --- | --- |
| Tier 0 | 无（官方发布版现状） | overlay 单 region **完整**工作台：真 tab 系统（pinned/preview/overflow/bulk close）、区域内拖拽重排、Quick Pick、菜单、键盘路径、i18n、能力矩阵 | 本 change 交付 |
| Tier 1 | `workspace.core-pane.v1` + `shell.workspace.right/bottom` | Core Pane docking：split、跨 region 移动/拖拽、maximize、Workspace Designer apply | 代码已在，等 seam 进发布版 |
| Tier 2 | Tier 1 + TerminalHostV2 + PreviewResourceV1 + 官方 ArtifactRef/Intent | 真终端、生产级预览、官方 artifact handoff 通道 | v3 lane + seam program |

关键原则：

- **Tier 0 不是降级版，是完整版的一个拓扑形态。** 同一 reducer、同一 tab 系统、同一 drag coordinator；只是 region 拓扑固定为单 group，split/dock 意图被 capability gate 拦截并给出标准 reason（控件可见禁用，不隐藏）。
- **合规边界**：插件实现单 region tab 管理是 overlay 自有内容，不触碰 AppFrame 几何——`docs/plugin-host-protocol.md` 禁止的是插件实现四列两行几何，不是禁止把 overlay 做好。
- **能力矩阵即诊断**：`/workspace capabilities` 视图 + 脱敏证据事件，把每个禁用入口的原因和解锁路径摆在台面上。残废感治理的核心不是"全都能用"，而是"不能用的都说得清、指得出路"。

## 3. 做剧用户旅程（Tier 0，今天的发布版即可达）

1. `dsh plugin add` 装 `dsh-ai-drama-director` bundle → 能力矩阵显示 drama 相关 probe 全绿。
2. 输入 `/drama`（命令经 command-experience `/` 目录贡献：`presentation.launcher` + `slash.name: 'drama'`；目录缺失则禁用+reason，pane 内操作不受影响）→ 命令组出现 typed selector。
3. `/drama open` 选剧 → host transport 解析 DramaContextV1（refs + owner versions + contextRevision + freshness）。
4. Director preset 经 preset service 应用：Tier 0 塌缩为单 region 有序 tab 集——Context / Review / Run 三个默认 tab，active 落在 Context；Story/Visual/Audio 在 Quick Pick 按需开。
5. 在 Review tab 处理下一项审查：action 走 server-authored descriptor + admission，denied 即禁用+owner 原因。
6. 需要改生成参数 → pane 内发起允许的 repair；mutation 一律 typed handler，unknown/partial 不自动重试。
7. `/drama evidence` 查看运行证据投影（有界摘要 + evidence ref，无内容出域）。
8. 工作量上来 → "Open in Workbench"：现有 `WorkbenchHandoffV1` 作为 legacy path；Bridge V2 由 host 签发短期 `launchRef`，Workbench `/agent` ingress 重新鉴权并向 owner 拉数据，再按 intent 打开 Creative Production、Review 或 Evidence lens。

Tier 1 差异只有第 4 步：preset 按声明分布到 Right/Bottom region，可 split。Tier 2 差异：Run tab 内终端/媒体预览为真实 seam 数据。

## 4. Workbench 场景回路

- **深链**：drama → Workbench 单向深链，消费门 fail-closed（过期/重放/未知 intent 一律拒绝并记证据）。
- **跨模块 handoff**：菜单 + 拖拽意图先行按本仓主 spec `pane-artifact-handoff`（ArtifactRefV1/ArtifactIntentV1 已是本仓合同）实现；官方 seam 出现即 probe 切换官方通道，UI 与插件合同不变。这把 `dsh-workbench-compose-v1` 6.4 从"无限期 blocked"变成"双轨可用"。
- **场景 preset 映射**：Drama/Code/Review/Media → workbench 模块集的版本化声明式映射，缺项禁用+安装指引。

## 5. 交互缺口 owner 矩阵

| 交互 | 现状 | owner | 解锁条件 |
| --- | --- | --- | --- |
| tab 系统（pin/preview/overflow/bulk close） | 已实现，Tier 1 可用 | 本 change 2.x | Tier 0 复用接线 |
| 区域内 tab 拖拽重排 | coordinator 已有 | 本 change 2.3 | 同上 |
| split / 跨 region 移动 / dock | 代码已有，seam 未到 | `upstream-prs/pane-workspace-layout` | seam 进发布版 |
| Workspace Designer apply | 已实现 | 同上 | 同上（无 seam 时诚实禁用 Customize） |
| Quick Pick / 菜单 / 键盘路径 | V4 已实现 | 本 change 2.4 | Tier 0 接线 |
| /drama 命令面 | client stub | 本 change 3.3 | command-experience `/` 目录贡献，无需上游 |
| drama 视图与 preset | client stub | 本 change 3.1/3.4 | registerView，无需上游 |
| Workbench 深链消费 | V1 host signer 已有；V2 需要 approved launcher + Workbench consumer | 本 change 4.1/4.2 + `dsh-workbench-ai-drama-bridge-v2` | DSH provider 无需上游；跨仓上线依赖 Workbench consumer conformance |
| 跨模块 artifact handoff | compose 6.4 blocked | 本 change 4.3/4.4 | 本仓合同先行，官方 seam probe 升级 |
| 真终端（xterm/PTY） | probe-only | v3 §6 + TerminalHostV2 seam | Tier 2 |
| 生产级文件/媒体预览 | v3 lane 半截 | v3 §3/§4/§5 | Tier 2 |
| 能力矩阵 / disabled reason 标准化 | 不存在 | 本 change 1.x | 无需上游 |

结论：12 项缺口里 8 项不依赖任何上游合入，本 change 全部收掉；4 项 Tier 1/2 能力维持 probe + 诚实降级，由 seam program 推进。

## 6. 与相邻 change 的边界

- `dsh-pane-workspace-experience-v3`：继续 own preview 平台/renderer/终端 lane（Tier 2 内容），本 change 不接管其 50 项 open tasks。
- `dsh-ai-drama-director-pack-v1`：3.5/3.6（metadata CLI、安装幂等）保持原 owner；本 change 只消费其产物合同并把 client 从 stub 变真。
- `dsh-workbench-compose-v1`：6.1/6.3 维持 blocked-on-seam；6.4 由本 change 4.3/4.4 以双轨方式解封。
- `dsh-core-pane-only-next-rc`、`dsh-pane-agents-host-compat-v1`：任务全勾未归档造成主 spec 漂移，本 change task 6.5 登记推动归档，不代行。

## 7. 验证策略

- 完成门照旧是本仓协议对接：`typecheck` / 包测试 / `build` / `check:bundles` / `openspec validate --strict`，不含官方 `dsh web` 实测。
- Tier 0 交互用组件测试矩阵（1440/1024/768/390px）覆盖；drama 接线与 handoff 回路用集成测试 + 证据六件套落盘 `temp/integration-test-runs/<run-id>/`，脱敏复核。
- 合规自查对照 `docs/plugin-host-protocol.md` 反例表逐条确认。

## 8. 合同锚点（实现参照，已与代码核对）

| 用途 | 合同/入口 | 位置 |
| --- | --- | --- |
| 视图注册 | `PaneWorkbenchClientFace.registerView(input): () => void`（返回精确 disposer）、`openView(request)` | `packages/client/ui-pane-workbench/src/client.ts:73-81` |
| Preset 服务 | `PaneWorkspacePresetServiceV1`（list/get/create/update/delete/reset，receipt = ok/rejected/permission_denied；内建 focus/code/review/media） | `packages/client/ui-pane-workbench/src/workspace-preset.ts:9-44` |
| 命令贡献 | `PaneCommandDescriptor`：`presentation.launcher: true` + 可选 `slash{name, aliases≤4, hint≤80, category}`；保留 P0 名冲突禁用 | `openspec/changes/dsh-slash-directory-hotplug-v1/specs/pane-protocol/spec.md`、`docs/cookbook/slash-commands.md` |
| 共享 keymap | `CommandKeymapConfig` / `resolveKeymap` / `DEFAULT_COMMAND_KEYMAP` | `packages/client/command-experience-core/src/index.ts:56-66` |
| Workbench 深链 | Legacy：`SignedWorkbenchHandoffV1{handoff, digest}` 与 `verifyWorkbenchHandoff`；目标态：`dsh.workbench_ai_drama_bridge.v2` + host-approved `launchRef` + Workbench server reauthorization | `packages/host/dsh-ai-drama-director/src/handoff.ts:70-87`、`openspec/changes/dsh-workbench-ai-drama-bridge-v2/` |
| Handoff intent | `WORKBENCH_HANDOFF_INTENTS` = open_show/open_episode/open_review/open_artifact/open_evidence | `packages/host/dsh-ai-drama-director/src/handoff.ts:12-18` |
| Artifact 合同 | `ArtifactRefV1`（validator 拒绝 credential/raw prompt/provider payload/绝对路径/任意 URL）、`ArtifactIntentV1` 词汇 = open/compare/attach_context/transform/handoff/link + idempotency key | `openspec/specs/pane-artifact-handoff/spec.md` |
| Drama 上下文 | `DramaContextV1` + `validateDramaContext` / `contextRevisionMatches` / reconcile | `packages/host/dsh-ai-drama-director/src/contracts.ts:29`、`context.ts:51-69` |
