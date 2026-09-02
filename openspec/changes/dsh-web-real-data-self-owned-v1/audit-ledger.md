# 常用面板数据源审计账本（dsh-web-real-data-self-owned-v1）

> 状态：基线审计完成（2026-09-01，任务 1.1/1.2）。本文件是 ≥80% 真数据率验收（§4.1 / R11 副指标）的唯一账本，随任务推进更新。
>
> 三态定义（以代码事实为准，不看文档宣称）：
> - **真数据**：面板主数据来自真实 owner 数据源或官方已有 seam（fetch/官方 projection/storage 落盘）。
> - **probe 降级**：运行时探测官方/owner seam，缺失时显示空态/禁用+原因，不伪造数据。
> - **静态演示数据**：主数据路径由硬编码常量、fixture transport 或 demo payload 提供。

## 1. 基线审计表（2026-09-01）

常用面板清单口径 = 本 change proposal 三组：ordo/team-hub、token/session/model/用量、command-first 状态中枢投影。共 **10** 个面板。

| # | 面板 | 组 | 主要包 | 基线三态 | 代码证据（file:line，仓库相对路径） | seam 缺失 |
|---|------|----|--------|---------|-----------------------------------|-----------|
| 1 | Ordo Agent Ops 值班面板（sidebar/popup/toolview） | ordo/team-hub | `packages/bundle/ordo-agent-ops`（`packages/host/ordo-agent-ops` 为 rc.7 兼容 shim） | **真数据（本地 ordo CLI）** | 生产 owner：`src/host/cli-owner.ts` 只读 `ordo team status --json` + `ordo doctor --json`；仅当 envelope 已含 CLI-authored `preview_ref` 时才 `ordo approval inspect <preview-ref> --json`，否则跳过。`bindLocalOrdoCliOwner` provide `ordoAgentOpsOwner`。投影 run/task/capacity/evidenceRefs/approval actions。CLI 缺失/失败 → `offline` + 原因，无事实。测试：`tests/cli-owner.spec.ts`、`cli-owner-consumer.spec.ts` | 无（CLI 为自控 owner；二进制缺失时诚实离线） |
| 2 | Ordo Agents Hub / Team V1 工作区 | ordo/team-hub | `packages/client/ui-ordo-agent-ops`（视图模型）+ `packages/bundle/ordo-agent-ops` team-projection | **真数据（本地 ordo CLI 只读投影）** | 同一 CLI owner：`cli-owner.ts` `teamSnapshot()`/`capability()` 映射 team/task/assignment，maturity=`readonly`（`team-projection.ts` mutationEnabled 仅 `live`）。Hub `projectAgentsHub`（`ui-ordo-agent-ops/src/client/hub-state.ts`）只在 live/readonly 且非 offline 时出 task 行；unavailable/fixtures/offline → `offlineReason` + 零行。测试：`tests/cli-owner.spec.ts`、`hub-state.spec.ts`。Team V1 写入 seam 仍未发布，只读不造第二 ledger | Team V1 mutation/event/action owner 服务未发布（只读 CLI 已覆盖 run/task/approval/evidence 投影；mutation 保持关闭） |
| 3 | Token 用量与余额面板 | token/用量 | `packages/host/dsh-token-usage` + `packages/client/ui-token-usage` + `packages/bundle/dsh-token-usage` | **真数据（官方 seam）** | host `src/index.ts:17` inject `['typert','sessionProjections']`、`:64` 折叠官方 `tokenUsage` projection delta；`src/ledger.ts:9-11`（只折官方投影、不重放日志）；`src/balance.ts:16,96` DeepSeek 官方 balance API + `:120-132` 凭证 port/失败诚实降级；seam 缺失时 fail closed（`index.ts:48-54` 无 seam 即不建账本）；client `controller.ts:52-61` unavailable 诚实态、无演示值 | 无（官方 seam 已接） |
| 4 | 会话标签/分组侧栏 | session | `packages/host/dsh-session-tags` + `packages/client/ui-session-tags` + `packages/bundle/dsh-session-tags` | **真数据（自控持久化 + 官方 sessions seam）** | host `src/plugin.ts:42` inject `['storageDomain','sessionPersistence']`；`src/service.ts:1-27` CAS 落盘 sidecar（durability-before-memory）；client `src/client/controller.ts:165` 经 `sessionTags.list` Remote 读权威行、provider 折叠官方 sessions.list；上游 `sessionGroupings` seam 缺失时 probe+晚绑定诚实降级（`src/client/index.ts:112-138`） | 上游分组 seam `sessionGroupings`（未进官方发布版；tag 数据本身已真实，仅分组挂载点降级） |
| 5 | 对话管理面板（desktop.sessions） | session | `packages/bundle/dsh-desktop-workbench`（ConversationManagerPane） | **真数据（官方 seam）** | `src/client/apply.ts:215,243` `ctx.get('sessions')` 官方会话快照（displayTitle/running/pendingInteraction）；`:205` `resolveSessionOrganizationRemote`（sessionOrganization Remote）；remote 缺失时诚实文案（`:207`） | 无（sessionOrganization 已随 session-tags host 提供；未安装时已诚实降级） |
| 6 | 会话侧栏 SessionSidebar / GlobalSearch | session | `packages/client/ui-desktop-workbench` + `packages/host/dsh-session-manager` | **真数据（官方 seam 接线，3.1）** | 生产 adapter：`dsh-session-manager/src/adapter.ts:204`（listSessions 折叠 persistence/sessionQuery 语料 + workspaceRegistry 分组/归档集 + agents 运行态）、`:272`（archive→官方 `workspaceRegistry.archiveSession` 持久写）、`:299`（fork→官方 `agents.create` + `readFrom` 平衡 turn 边界 seed）；seam 激活：`dsh-session-manager/src/index.ts:294`（动态 inject `sessionPersistence`/`workspaceRegistry`/`agents`，`:157` gap probe，缺席即不绑定）；消费面：bundle `dsh-desktop-workbench/src/index.ts:51`（hosts.session getter 优先插件绑定真服务）、`:128`（node apply 装配 host plugin）、`composed-workbench.tsx:79` 与 `ui-desktop-workbench/src/client/desktop-workbench-shell.tsx:47`（placeholder 仅作诚实回退）；侧栏 `session-sidebar.tsx:78`/`global-search.tsx:43` 按契约渲染 host 返回的真数据。无 seam 的面（restore/trash/purge/labels/pause/resume）返回带原因的 `not_implemented`（`adapter.ts:280-297`）；composed overlay 仍为 deprecated，生产 apply 不注册 | 无（读写主面已接；restore/trash/purge/labels/pause/resume 官方 seam 未发布，逐面诚实降级） |
| 7 | 登录档案/账户面板 | session/model | `packages/client/ui-session-cookie-manager` + `packages/bundle/dsh-session-cookie-manager` | **真数据（官方 sessions seam；cookie jar 仍 probe）** | 账户主数据：bundle `src/client/index.ts` apply 折叠官方 `sessions.list` → `officialSessionsToSnapshot`（`provider-adapter.ts`）→ `composeAccountProjections`；缺 sessions 时 accounts 为空态。cookie apply/switch/clear 仍需 `WebCookieJarsV1`，缺席禁用+原因（`pane-views.tsx`）。测试：`ui-session-cookie-manager/tests/profile-manager.spec.tsx`、`bundle/dsh-session-cookie-manager/tests/bundle-smoke.spec.ts` | cookie jar 写面仍缺 `WebCookieJarsV1`（账户读面已接官方 sessions） |
| 8 | 模型/预设选择（/model /preset /reasoning） | model | `packages/client/command-experience-core`（P0 目录） | **probe 降级** | `p0-catalog.ts:49,58-60` `/model`→`set-model`、`/preset`→`apply-preset`、`/reasoning`→`set-reasoning` 均为 owner-action（owner: dsh）；`:83` 默认 `availableActions: new Set()`；`:106` 缺 owner action → 保留可见但 disabled+reason（诚实禁用，非伪造） | 官方 owner-action receipt seam（set-model/apply-preset/set-reasoning） |
| 9 | Slash 命令目录与 inspect（host/client/TUI） | command-first | `packages/bundle/dsh-command-experience` + `packages/client/command-experience-core`（TUI 为薄适配 `ui-command-experience-tui/src/index.ts:4`） | **真数据（官方 seam）** | `dsh-command-experience/src/slash-bind.ts:100-101` `ctx.get('paneWorkbench')`/`ctx.get('commands')` 官方命令注册与快照、`:35-56` plugins/loader entries（官方 plugin inventory seam）；`command-experience-core/src/slash-runtime.ts:207` hostCommands 快照投影；`live-directory.ts` 合并 P0 静态目录（指令元数据，设计固有）+ pane + host 源，fail-closed | 仅 P0 owner-action 项（同 #8；目录与 inspect 面本身已真） |
| 10 | Web command owner-action 执行/receipt（session-hub 列表同源） | command-first | `packages/client/ui-command-experience-web`（并行 lane 在途包） | **静态演示数据（fixture transport）** | `src/transport.ts:4` "MSW fixtures stand in for the owner when official DSH receipts are unavailable"；`:39,46-52` 默认 transport POST `https://api.deepseek.com/v1/commands/execute`（占位端点，测试以 MSW 拦截）；生产未挂载（`bundle/dsh-command-experience/src/client/index.ts:16-23` web adapter 以 handoff descriptor 描述、不进 ModuleLoader bundle）；host 侧仅接口+mock（`host/dsh-command-experience/src/owner-action-adapter.ts:339` `createMockAdapter` 测试用） | 官方 DSH owner-action/receipt transport seam（并行 command-first lane 所有，本 change 不改其设计） |

分母备注（不计入常用面板清单）：`ui-agent-preset` PreviewPanel 为 props 驱动只读组件（无独立数据源）；`dsh-workbench-core` CommandPalette 为 props 驱动（Wave 3 消费面）；`host/ordo-commands`、`host/yeisme-commands` 是命令注册 host（贡献 #9 的数据源，不单列）。

## 2. 计算真数据率（分母 = §1 共 10 行）

从 §1 逐行计数（不以文档宣称覆盖代码事实）：

| # | 三态 | 计入真数据 | 未真数据原因 |
|---|------|-----------|-------------|
| 1 | 真数据（本地 ordo CLI） | 是 | — |
| 2 | 真数据（本地 ordo CLI 只读投影） | 是 | — |
| 3 | 真数据（官方 seam） | 是 | — |
| 4 | 真数据（自控持久化 + 官方 sessions seam） | 是 | — |
| 5 | 真数据（官方 seam） | 是 | — |
| 6 | 真数据（官方 seam 接线） | 是 | — |
| 7 | 真数据（官方 sessions 账户读面） | 是 | cookie jar 写面仍 probe，不改读面计数 |
| 8 | probe 降级 | 否 | 官方 owner-action receipt seam 未发布（set-model/apply-preset/set-reasoning） |
| 9 | 真数据（官方 seam） | 是 | — |
| 10 | 静态演示数据（fixture transport） | 否 | 并行 command-first lane；生产未挂载 ModuleLoader |

- 真数据：#1、#2、#3、#4、#5、#6、#7、#9 → **8 / 10 = 80%**
- probe 降级：#8 → 1
- 静态演示数据：#10 → 1
- **当前计算 = 80%**（达标；#8/#10 均有 seam 缺失/外部 owner 原因，不得伪造）

## 3. seam 缺失清单（3.1「probe-first 降级保留原因」底账）

| 面板 | 缺失 seam | 性质 | 本 change 处置 |
|------|-----------|------|----------------|
| #1 ordo 值班面板 | ~~`ordoAgentOpsOwner` 未接线~~（2.1 已接本地 ordo CLI） | 已接线 | CLI 缺失/失败走 `owner_projection_unavailable` 离线态；无演示行 |
| #2 Team V1 工作区 | Team V1 mutation/event/action owner 服务 | owner 发布依赖 | 2.1/2.2 以 CLI `team status --json` 覆盖 run/task/approval/evidence 只读投影，maturity=`readonly`；mutation 仍关闭 |
| #6 会话侧栏 | ~~`SessionManagerHostV1` 生产 adapter~~（3.1 已接线官方 `sessionPersistence`/`workspaceRegistry`/`agents`/`sessionQuery`；labels 归 sessionTags sidecar 所有不重复接线） | 已接线 | restore/trash/purge/labels/pause/resume 无官方 seam，逐面 `not_implemented`+原因；seam 缺席环境整包回退 placeholder（空表+禁用动作） |
| #7 登录档案/账户 | cookie jar `WebCookieJarsV1` 写面 | 官方未发布 | 账户读面已接官方 `sessions.list`；apply/switch/clear 仍 probe-first 禁用+原因 |
| #8 /model /preset /reasoning | 官方 owner-action receipt seam（set-model/apply-preset/set-reasoning） | 官方未有 | probe-first 降级保留（disabled+reason） |
| #10 web owner-action 执行 | 官方 DSH owner-action/receipt transport | 并行 command-first lane 所有 | 本 change 不动；账本仅记录 fixture transport 现状 |
| #4 分组挂载点（数据已真） | 上游 `sessionGroupings` seam | 上游未进官方发布版 | 已有晚绑定 probe；到位自动注册 |

## 4. 随任务推进更新的变更记录

每完成一个影响面板数据源的任务，追加一行（状态列填新三态；真数据率按 §2 口径重算）。

| 日期 | 任务 | 面板 # | 变更前三态 | 变更后三态 | 证据（file:line 或测试/运行记录） | 真数据率 |
|------|------|--------|-----------|-----------|--------------------------------|---------|
| 2026-09-01 | 1.1/1.2 | 全部 | — | 基线落账 | 本文件 §1 | 4/10 = 40% |
| 2026-09-01 | 3.1/3.2 | #6 | probe 降级（seam 未接线） | 真数据（官方 seam 接线） | `dsh-session-manager/src/adapter.ts:204,272,299` + `src/index.ts:294`（动态 inject 激活）；消费面 `dsh-desktop-workbench/src/index.ts:51,128`、`composed-workbench.tsx:79`、`ui-desktop-workbench/src/client/desktop-workbench-shell.tsx:47`；测试 `tests/official-seams-adapter.spec.ts`（20 用例含降级等价）、`tests/session-manager-host-plugin.spec.ts`、bundle `tests/bundle.spec.ts`（hosts getter 真数据解析+node apply 接线）；#7/#8 降级核验只读引用（#7 `provider-adapter.ts:52-67` 空投影、`pane-views.tsx:45-47` cookieJars 缺席禁用；#8 `p0-catalog.ts:106` disabled+reason） | 5/10 = 50% |
| 2026-09-01 | 2.1/2.2/2.3 | #1/#2 | probe 降级 | 真数据（本地 ordo CLI 只读链） | `cli-owner.ts` 只读 `ordo team status --json` + `ordo doctor --json`；仅当 envelope 含 CLI-authored `preview_ref` 时 `ordo approval inspect <preview-ref> --json` → run/task/assignment/capacity/evidenceRefs/approval actions | 7/10 = 70% |
| 2026-09-01 | 4.1 | #7 | probe 降级 | 真数据（官方 sessions 账户读面） | bundle apply 折叠 `sessions.list` → `officialSessionsToSnapshot`；cookie jar 写面仍缺席禁用。测试 `profile-manager.spec.tsx`、`bundle-smoke.spec.ts` | 8/10 = 80% |
| 2026-09-01 | 4.1 重算 | 全部 | 8/10 | **计算确认 8/10=80%** | §2 逐行计数：真数据 #1–#7+#9；#8 probe（官方 owner-action receipt 未发布）；#10 static-demo（并行 command-first fixture，生产未挂载）。tasks.md §2 与 §4 全部 [x] | 8/10 = 80% |

## 5. 验收口径备注

- 真数据判定（spec ADDED Requirement 4）：面板主数据来自真实 owner 数据源或官方 seam，演示/静态数据仅出现在显式标注的降级/空态。
- 分母 = §1 表格行数；实现中发现新常用面板或口径修正时，在 §1 加行并在 §4 记录理由，不静默改口径。
- ≥80%：#7 账户读面接官方 sessions 后为 8/10。剩余 #8（官方 owner-action receipt 未发布）与 #10（并行 command-first fixture transport，生产未挂载）有 seam 缺失/外部 owner 原因；不得伪造。
