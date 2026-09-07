# Project Continuity 消费接口

状态：pre-1.0 设计合同，尚未注册 wire 方法或发布 provider digest。实现真源为 [owning change](../../openspec/changes/workbench-project-continuity-desktop-v1/design.md)，跨项目边界为 [root contract](../../../../openspec/changes/workbench-project-continuity-program-v1/design.md)。

## 1. 信任链与归属

Browser → same-origin BFF → `WorkbenchClient` → Workbench shared services → 固定 owner public API/structured bridge。用户级 token、provider credential、私有路径、工具参数与 owner endpoint 不进入 Browser/控制面 evidence。服务端逐次解析 principal/project scope，caller refs 不是授权证明。

现有 ProjectWorkspace/Dataset/WorkItem/Board/Task 语义不变。新 project continuity 服务聚合安全引用，Pinax 负责编译 continuity，Runtime 负责 content/attempt，成果 owner 负责 revision/preview/export。新增视图 state 复用 Layout service，不新建 content/session DB。

## 2. 最小 public surface

新增 `workbench.project_continuity.v1alpha1` projection，沿用 `WorkbenchClient.project` facade；wire methods 经既有 registry 四面投影。

| SDK 方法（拟新增） | Operation / RPC method | HTTP（拟新增） | 行为 |
|---|---|---|---|
| `project.getOverview` | `GetProjectOverview` | `GET /v1alpha1/project-continuity/projects/{projectRef}/overview` | 只读授权总览，各分区独立 availability/freshness |
| `project.getContinuity` | `GetProjectContinuity` | `GET /v1alpha1/project-continuity/projects/{projectRef}/pack` | 消费 Pinax bounded pack；不写/确认长期记忆 |
| `project.prepareContinuation` | `PrepareProjectContinuation` | `POST /v1alpha1/project-continuity/projects/{projectRef}:prepare` | 准备 server-authored 继续描述符；不启动 Task/工具 |

JSON-RPC 复用 `workbench.project.v1alpha1` namespace 并新增对应方法；gRPC 添加新 request/response message 与方法，不修改旧 message 字段号。无法安全表示的新 projection 不塞进 closed 的旧响应对象。

模型名称为 `ProjectOverviewV1`、`ProjectContinuityV1`、`PreparedProjectContinuationV1`。最小公共字段族：contract version；服务端确认 scope/project refs；projection revision；section availability/reason；source refs/revisions/freshness；分页信息与安全动作描述符。Contract fixture 必须固定精确 closed schema，未经声明的 critical field/version 不能授予能力。

`ProjectOverviewV1` 关联最近 artifacts、sessions、active Tasks 与 relevant decisions。列表遵循现有 cursor/page 限制，不返回完整 transcript/全文 corpus。单个 optional owner 超时可返回 partial 分区；项目授权失败则整体拒绝，不能把另一项目作为 fallback。

`ProjectContinuityV1` 包含 owner-issued continuity ref/revision、objective/last-state 的 bounded safe summary、confirmed decision refs、blocker/conflict、推荐下一动作和 source verification。缺 handoff 返回明确 context-only；sources 的时间来自原来源，不能用本次编译时间伪装新鲜度。

## 3. Prepare 与执行

Prepare 请求携带项目、选定 session 或显式新 session 意图、observed overview/continuity revisions、用户选择的 safe refs 和幂等键；不接受 provider、目录、任意工具参数或客户端拼装批准事实。

服务端重新验证 binding、source revisions、principal、policy 与原 attempts，返回以下闭合集合中的一个后续动作：`observe_existing`、`reconcile_existing`、`continue_session`、`start_new_session`、`refresh_context`、`resolve_binding`、`request_permission`。每个描述符包含原合同的 action identity、适用引用、版本条件和恢复信息；不在这里创造第二套执行状态。

- Prepare 只准备安全 metadata/Context 引用；若要保存准备记录，必须通过服务端 repository、幂等与有效期，不产生 provider call。
- 用户提交继续后，复用既有 Context prepare/authorize/attach 与 Agent turn submission；执行时再次验证，不能把 prepare 时的结果当永久授权。
- Prepare 重复请求返回一致准备结果；Task submit 独立使用原幂等合同，重复点击不产生重复 attempt。
- running 只观察/附着；`unknown_accept` 只 reconcile；terminal 状态才允许新回合。Runtime restart/resume 是否可用来自 owner descriptor。
- 换 Runtime 必须显式创建同项目的新 session，并重验 grant；原运行/回执保留，不自动重放 transcript 或 tools。

## 4. Binding、视图与内容

ProjectWorkspace 保存已有合法 projectRef 的组合关系，不创建 canonical 项目或探测文件系统。部署端 workspaceRef 由运行时 owner 解析；Pinax scope binding 由 Pinax CLI/service 管理。缺 binding 或 source contract 时在 UI 暴露 setup blocker，不能按目录名猜测。

按 principal/project 存储最近 document refs/revisions、tab 顺序和 active document、宽度、稳定可恢复 selection/scroll anchor；新 `ProjectViewStateV1` 是 Layout service 的 additive extension。Session 自身草稿与滚动继续按 session 管理。跨版本/失权 ref 不合法时回项目续接视图，不能读取已删除对象或其他 scope 的缓存。

编辑 buffer、owner autosave/draft recovery 与 undo 分工复用对应 editor/owner 合同；不把正文写入 Layout、localStorage 或 Workbench metadata。没有可恢复编辑合同的 renderer 只读；不能承诺刷新后保留尚未收到 owner 确认的内容。

## 5. 有界自主授权消费

独立合同 `workbench.bounded_action_grant.v1alpha1` 由 ProposalAuthority 管理，不更改现有 session/access grant。grant 创建/撤销必须通过现有 proposal/decision 服务；Web 只提交 owner-authored descriptor refs，所有 controls 来自 server capabilities。

批授权绑定 principal/project、resource scope、operation/effect class、Profile/manifest revision、预算/次数、期限和批准 receipt。每个 action proposal 继续经服务端准入；只有 owner 验证通过的 effects 可由先前批准满足。有效 grant 的展示不等于全部工具可执行。

预算预留、幂等、writer lease 与 effect classification 在权威服务内完成。撤销与 dispatch 的竞争通过原子准入/owner fence 处理：撤销之后的新 admission 拒绝，撤销前已 accepted 的动作保留原状态并按 owner cancel/reconcile。不能用 UI optimistic cancel 隐藏仍在执行的工作。

文件/terminal/MCP write 不自动享受旧 chat grant。未知命令/脚本、外部发布、敏感读取、不可丢弃数据删除、范围升级和 Canon acceptance 保留原明确决定。缺 provider capability 时只允许原单次批准或 needs_contract；批授权 readiness 独立于普通 Chat readiness。

## 6. 事件、错误与清理

复用 Project/Task/Conversation/owner 流与既有 cursor：事件触发对应投影 invalidation，不在浏览器归并出新的 canonical 状态机。新增 continuity 更新事件只作为 additive event type，旧消费者可安全忽略；gap/resync 按现有协议拉快照。

| 情况 | 消费者行为 |
|---|---|
| project 失权/tenant 切换 | 取消相关查询/订阅，清除敏感缓存，拒绝 mutation |
| optional owner offline | 对应 section offline/partial，保留最后确认且仍授权的投影 |
| source stale/conflict | 显示来源和 Refresh/Remove/Review；不自动重写 ref/revision |
| prepared descriptor 过期 | 重新 prepare，不复用旧批准 |
| content/resource 被删除 | tombstone/不可用；不展示已撤销预览，不把删除内容等同删除 Task receipt |
| partial/cancel 请求中 | 保留 partial output，owner 确认前保持 pending |
| unknown / 重复返回 | 原 attempt reconcile；按 canonical event identity 去重 |

## 7. 兼容、部署与证据

独立 capability `projectContinuityDesktopV1`、`projectContinuity`、`boundedActionGrantV1` 为新增 server fields，缺失/未知值等同未启用；不能通过 URL、build flag、localStorage 或只有 UI fixture 打开。新桌面姿态还依赖已授权 unified shell 与 `chatCanvasV2`，不能反向开启这两个基础门。旧 route 与新 shell capability 的组合必须测试，Project/Chat/Spatial 既有状态 owner 继续单一。

本地模式继续 private local-session；远程浏览器通过 HTTPS 和既有 managed Identity/BFF，不允许 local token fallback。部署端服务使用本机固定 adapter；工具 readiness、Agent protocol、模型出口与 Identity 各自独立，connection success 不提升 generate/execute。

日志/证据仅记录 scope-safe refs、revisions/digests、状态、计时、计数和 evidence refs。每次 integration/component/e2e 由既有 runner 生成六件套；引用持有者仍须授权，不在文件名、命令行或截图中携带正文/凭据/私有路径。

回滚关闭新增能力并停止新 action grant admission；已 accepted Task 的查询、取消、对账不受新 UI capability 关闭影响，始终经过原 principal 权限。新增表/字段保留，当前不删除/重解释任何已发布 API 或数据库列。
