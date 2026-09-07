## Why

上一轮 `workbench-agent-ui-unification-v1` 只统一了 chrome、状态块、文案与响应式呈现，并明确不改变后端合同。当前 `/agent` 仍由 `AgentRoute` 把 `AgentConversationWorkspace` 和 `SpatialSurface` 作为并列 surface 挂载：两边各自拥有 layout、selection 和 context 状态，Canvas 选择不能直接进入下一次提问；Chat 又只运行 dev reference adapter，因此截图中的“等待权限、无真实回答、大片控制面事件、画布完全脱节”是产品与数据流问题，不是继续换样式能够解决的问题。

本 change 交付本地优先 Beta 的第一条真实纵向闭环：在一个自适应 shell 中选择 Canvas 对象，显式附加到 Chat，获得真实 Pi/OMP 结构化回答，并以软跟随预览和原子 Spatial change-set 回到同一工作面。

## What Changes

- 将 `/agent` 从“Conversation / Split / Spatial Focus”三个一级模式收敛为一个 session-scoped 自适应工作台：宽屏默认左 Chat rail、中间 Canvas/registered Pane document dock、右侧唯一 Detail/Inspector/Review/Evidence context rail；Session directory 默认抽屉并可固定。
- Canvas 成为 canonical Pane/layout reducer 中的第一类 document，不再由 route 作为与 conversation 并列、独立状态的 sibling surface；registered Pane 与 Canvas 在同一中央 dock 内 tab/split，继续遵守 visible 1–3、hard max 4、split depth 2。
- 新增 Workbench Conversation Runtime typed consumer：会话 Profile、加密内容读取、结构化 Block stream、partial/failed/unknown、删除/导出 action descriptor 和 runtime availability 均来自独立 owner；Browser 不直连 owner、broker 或 Pi/OMP。
- 保留 `workbench.agent.turn.submit.v1` 与 TaskService 作为控制面：Composer 先通过 owner content API 创建 sealed `turnIntentRef`，再提交 Task；Task/event/receipt 不保存 raw prompt 或完整 model response。
- 新增 session Profile UX：首次确认 Pi/OMP runtime、model profile、tool scope、Context scope、预算上限和期限；授权范围内普通 Chat 回合不再逐条等待 permission，越界、敏感读取、成本提升和 mutation 仍使用 server-authored gate。
- 新增安全结构化回答 Block：Markdown、代码、表格、引用、artifact ref、proposal summary 和 bounded recovery 可以流式呈现；回答是 timeline 主线，Task/tool/gate/receipt 压入可展开 Run detail，并合并重复状态。
- 新增 Canvas 待附加选择托盘：Canvas selection 立即同步为 safe pending refs，但不自动写 composer、不自动附加 Context Pack；用户显式确认后，服务端按 exact revision/scope 重载对象并创建 Context Pack。stale/revoked/mismatch 会阻止附加并要求 Refresh 或 Remove。
- 新增软跟随默认：在已授权 active session 中，真实回答可自动高亮/预览 safe refs 并更新右侧 Context rail，但不得移动键盘焦点、自动平移相机、切换 canonical owner state、写 Draft、创建 proposal decision 或提交 mutation。
- 持久 Canvas 修改继续 proposal-first：回答可携带 `preview_change_set`，Workbench 在 Canvas 渲染临时预览并在 Review rail 展示一个 server-authored 原子 change-set；用户只能整体 Accept、Reject 或 Request Changes，冲突时整包不落地。
- 中断回合保留已确认 Block 并标为 `partial`；已知失败允许同一用户消息创建新 attempt，`unknown_accept` 只允许原 attempt reconcile。Runtime 不可用时保持 unavailable，只允许用户显式切换真实 Profile；reference adapter 只作为明确标识的 dev 模式。
- 移动/窄屏支持真实 Chat、选择摘要、可访问对象列表、Review/Accept 和 Context Sheet；首版不挂载完整无限画布编辑器。
- 用 Creative Production Lens 跑通 first-support vertical slice，同时把 selection/context/content/change-set 合同设计为所有 Lens 可复用的通用内核。
- 保持现有稳定 `?view=conversation|split|spatial-focus` deep link 可解析；v2 shell 将其迁移为兼容的初始 layout preference，不再创建三套独立 mode state。旧 reference runtime 和旧 layout 可通过独立 beta kill switch 回退，不删除持久 Task/Context/Pane 数据。
- Workbench BFF 编排 Conversation session → Identity `aigora-agent-access` exchange → Aigora access context/grant/ticket → Runtime Plane `aigora.agent-access` launch/renew/close；Browser 永远不接触 exchange token、ticket、local bearer 或 loopback endpoint。
- Session Profile 展示两张来源明确的卡：Agent Framework 卡负责 ACP/OMP/session/cursor/tool readiness 与 Conversation session budget；Aigora Access 卡负责 grant/generation、model protocol/alias、MCP bridge、freshness 和独立 model/MCP budgets。不得合并为一个 ready 状态或共享余额。
- Workbench/Agent Framework 继续拥有 ACP session create/load/resume/close/cancel、tool approval 和 content operations；Aigora `/identity/keys` 只显示 Agent Access 摘要，不显示 ACP wire/OMP version，并提供 server-authored safe deep link。
- ACP v2 alpha 只作为 Agent Framework 独立 prototype/readiness lane；没有兼容 runtime 时显示 `blocked`。AG-UI 只保留为未来 Workbench BFF 对 content/Task/approval stream 的 HTTP/SSE compatibility projection，不进入 Aigora。

## Capabilities

### New Capabilities

- `workbench-agent-conversation-content-consumer`: 定义 Workbench 对 Conversation Runtime 的 session Profile、sealed turn intent、结构化 Block、content cursor、partial/retry/delete/export 与安全边界。

### Modified Capabilities

- `workbench-agent-runtime-chat`: 从 reference-only 拟真回合扩展为真实 Conversation Runtime control/content 双平面，并引入会话级授权、partial attempt 和显式 runtime switch。
- `workbench-agent-session-workspace`: 将 session 的 Task 派生控制面与独立加密正文投影组合为一个 selected-session stream，同时保持 Browser 只拥有 UI composition。
- `workbench-agent-pane-composition`: 移除三种一级桌面 mode，令 Canvas 与 registered Pane 共享同一 document dock 和 layout reducer。
- `workbench-agent-spatial-interaction`: 增加 selection tray、exact-revision Context attachment、soft follow preview 与回答到原子 change-set 的闭环。
- `workbench-agent-ui-unification`: 将 v1 的视觉统一升级为单一自适应 shell 与真实跨区域状态连续性。
- `workbench-agent-shell-visual-language`: 将时间线改为回答优先、运行细节折叠、重复 gate/status 合并的内容层级。
- `workbench-agent-presentation-intents`: 在 session Profile 明示授权后默认开启 presentation-only soft follow，并保持 replay、dirty composer、Review/modal 和 focus guards。
- `workbench-agent-composer-triggers`: 增加 Canvas pending-selection tray、显式附加、safe artifact refs 和 per-draft 清理语义。
- `workbench-client-runtime-adapter`: 增加 Conversation Runtime 固定 adapter/readiness/run binding，禁止 Browser、route 或 localStorage 选择任意 executable/provider。

## Impact

- 产品/UI 真源：`docs/product/agent-workbench-blueprint.md`、`docs/ui/agent-first-workbench.md`、`docs/interfaces/agent-pi-workspace.md`。
- Web：Agent shell/layout store、conversation content renderer、Composer selection tray、Canvas document adapter、shared context rail、responsive Sheets、runtime Profile 和 beta rollback。
- BFF/SDK：`WorkbenchClient` 增加 versioned Conversation Runtime consumer；同源 content stream 与 Task lifecycle stream 在 BFF/Workspace supervisor 中合并为 selected-session projection，不建立每 Pane/每消息连接。
- Service：TaskService、ProposalAuthority 和 Spatial/Context services 保持 authority；只新增 owner adapter、sealed intent ref 绑定、session grant 校验和 safe content correlation，不保存正文。
- 外部依赖：根 change `openspec/changes/agent-conversation-runtime-workbench-integration-v1/`、未来 `agent/conversation-runtime` owner change、`backend-server/client-runtime` adapter change。
- Aigora access 依赖：根 `openspec/changes/aigora-unified-agent-access-plane-v1/`、Aigora `aigora-agent-access-sidecar-v1`、Identity audience change 与 Runtime Plane `aigora-agent-access-binding-v1`；Workbench 只实现 BFF orchestration/consumer/UI，不成为 grant、identity、credential 或 local binding owner。
- 测试/证据：Vitest/component、SDK contract、Go service、Playwright、integration/system 和 real Pi/OMP opt-in canary；integration 证据继续写入 `temp/integration-test-runs/<run-id>/` 并扫描 raw prompt、provider payload、credential、private args/path 和完整推理。
- 兼容性：新增 API/schema/event/locale/layout fields 全部 additive；旧 Task/event/session/pane/deep-link 语义保留。任何字段 removal、rename、enum repurpose 或持久数据迁移必须另立 change。
