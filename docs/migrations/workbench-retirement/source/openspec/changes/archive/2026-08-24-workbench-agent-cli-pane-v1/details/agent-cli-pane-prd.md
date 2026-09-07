# Agent CLI Pane PRD

## 1. 产品判断

### Owner fit

| 能力 | 准入 | Canonical owner | Workbench 角色 |
|---|---|---|---|
| CLI Pane、command catalog、typed form、run history、结果/证据视图 | `fit` | Workbench | UI 组合、安全投影、Task/receipt 消费 |
| Operation-backed 企业任务命令 | `fit` | TaskService + 对应 Owner | Workbench 将 Operation 投影为 command，不复制 Owner 状态机 |
| 真实进程、mount、env、secret、network、resource sandbox | `split-owner` | Approved Host Runtime | Workbench 只提交 prepared intent 并消费 receipt |
| 任意 shell、自由 PTY、浏览器 spawn、raw filesystem | `reject-now` | 无 | 不设计 fail-open 入口 |

### 产品命题

让企业用户在 Agent 对话旁，以“命令即受控任务”的方式运行自研工作流：命令可被人理解、被 Agent 准备、被权限系统约束、被 TaskService 追踪、被证据系统复核。

### 首屏问题

> 当前准备运行什么命令、作用于哪个范围、风险和门禁是什么、执行到哪里、Agent 能否安全继续下一步？

## 2. 用户与核心 Jobs

| 用户 | Job | 成功结果 |
|---|---|---|
| 项目负责人 | 在项目/任务/看板上下文执行标准流程 | 不离开 Agent workspace，运行结果可回链到项目与任务 |
| 运营/发布人员 | 执行诊断、构建、迁移、发布检查 | 参数、权限、环境和证据可复核；失败有明确恢复 |
| 开发者 | 运行企业内部 CLI 与自动化 | 无需复制 shell；输出结构化，可取消、重试、对账 |
| 审批者 | 审查 Agent 提议的高风险命令 | 看见范围、effect、risk、expected versions 和 evidence basis 后决定 |
| Agent | 发现、准备、执行获准读取、观察结果 | 不持有 ambient credential，不绕过 Task/Proposal authority |

## 3. 问题

- 当前 Terminal 只是 `needs_contract`，Agent 建议和用户执行之间没有稳定桥梁。
- 复制 CLI 字符串不能证明执行了什么、使用了什么版本/权限，也无法安全处理 secret/path/幂等/取消。
- human stdout 不适合作为 Agent 或 UI 的业务状态源；长日志也会污染会话和前端状态。
- 项目、Kanban、Todo 和工作流需要一个统一“执行入口”，但不能让 Workbench 接管所有 Owner 状态机。
- Pane 关闭、切换 session 或移动端降级时，命令执行不能与 UI 生命周期绑定。

## 4. Required-capability ledger

| ID | Required capability | 决策 | Slice | 验收证据 |
|---|---|---|---|---|
| CLI-001 | `agent.cli.v1` first-party Pane | `fit` | A | registry/catalog unit + screenshots |
| CLI-002 | server-authored command catalog | `fit` | A | seal/digest/schema tests |
| CLI-003 | typed argument draft + preflight | `fit` | A | form/component + invalid-input tests |
| CLI-004 | Operation-backed commands | `fit` | A | Task/Owner receipt integration |
| CLI-005 | run history derived from Task | `fit` | A | close/reopen/session restore E2E |
| CLI-006 | summary/facts/events/artifacts/explain views | `fit` | A | projection/golden/virtualization tests |
| CLI-007 | Agent discover/prepare/present/observe | `fit` | B | Agent interaction contract/E2E |
| CLI-008 | delegated read execution | `fit` with policy | B | grant scope/expiry/deny tests |
| CLI-009 | Agent-origin write proposal | `fit` | B | ProposalAuthority integration |
| CLI-010 | Host Runtime process execution | `split-owner` | C | no-shell argv + receipt canary |
| CLI-011 | resource/network/env/secret policy | `split-owner` | C | policy/redaction/timeout tests |
| CLI-012 | cancel and unknown-accept reconcile | `fit + split-owner` | C | race/reconcile integration |
| CLI-013 | four transport parity | `fit` | C | SDK/HTTP/gRPC/JSON-RPC contract suite |
| CLI-014 | responsive/keyboard/a11y | `fit` | A | Playwright/axe/fixed screenshots |
| CLI-015 | arbitrary shell / PTY | `reject-now` | — | catalog/input fail-closed tests |

任何 ledger 项不得在实施 review 中静默删除。Host Runtime 未就绪时 CLI-010–012 保持 `needs_contract`，但 CLI-001–009 的 Operation-backed 路线仍可独立交付。

## 5. 产品对象

| 对象 | Authority | 说明 |
|---|---|---|
| `CommandDescriptorV1` | command registry | 可见命令能力、参数、风险、输出合同；通过 stable actionId 绑定共享 ActionDescriptor |
| `CliCommandIntentV1` | CLI command service | immutable、TTL、typed args digest、安全预检结果 |
| `Task` / `Attempt` / `Event` | TaskService | 唯一执行 lifecycle |
| `CliCommandResultProjectionV1` | CLI result projector | 统一 summary/facts/actions/evidence/data/error |
| `CommandSessionProjectionV1` | derived read model | session/runtime/scope 下的 Task runs 聚合 |
| `Proposal` | ProposalAuthority | Agent-origin write/dangerous 决策权威 |
| `HostReceipt` | Host Runtime | 进程接受/完成/取消/lookup 事实 |
| `PaneLayoutState` | browser composition | open/focus/split/size；不持有 command truth |

## 6. 关键用户旅程

### 6.1 用户运行 Operation-backed 项目命令

1. 用户从 Kanban card、Todo、workflow node、command palette 或 Agent suggestion 选择“在 CLI 中打开”。
2. Workbench 编译 safe refs，打开/聚焦当前 session 的 CLI Pane。
3. 用户选择 descriptor，typed form 自动绑定 project/work item refs。
4. Server preflight 返回 effect、risk、permission、cost、version、runtime state 和 intent TTL。
5. 用户点击 Run；TaskService 创建对应 Operation Task。
6. Pane 通过既有 event cursor 展示进度；结果进入 Summary/Facts/Artifacts。
7. 用户可把 result ref 交给 Agent，或从 result action 创建下一个 typed intent。

### 6.2 Agent 提议写命令

1. Agent 从显式 Context Pack 选择允许 descriptor 并准备 suggestion。
2. 对话显示 command proposal card；Pane 可打开到同一 prepared intent。
3. ProposalAuthority 保存 canonical proposal、basis、revision、expected versions。
4. 用户/approver 审查并接受。
5. ProposalAuthority 只创建一次 Task；Agent 观察安全结果并给出下一步。

### 6.3 Agent 执行 delegated read

1. 用户授予某 session、scope、command group、有效期和资源上限的 read grant。
2. Agent 准备符合 descriptor 的 intent。
3. 服务验证 `system-agent` actor、initiating principal 和 grant。
4. TaskService 执行；Pane/timeline 显示“Agent initiated under grant”。
5. grant 到期、scope 变化或 descriptor revision 变化时立即退化为 Prepare。

### 6.4 Host command 进入 unknown_accept

1. Workbench dispatch 后连接中断，无法确认 Host 是否启动。
2. Task 进入 `unknown_accept`；Pane 显示 request/receipt ref 和风险说明。
3. Agent 只能解释/导航；用户点击 Reconcile。
4. Host 通过 original request key/hostSessionRef lookup，Task 映射到真实状态，不重跑。

## 7. 功能需求

### Command discovery

- 以 group、scope、effect、availability、recent/favorite 过滤。
- 搜索 label、description、stable command ID；技术 ID 不做主标签。
- descriptor 不可用时展示 reason/recovery，不打开假 Pane。
- Context Menu、Inspector、Command Palette、Agent 使用同一 action/descriptor。

### Draft 与 preflight

- 参数控件由 schema 生成，但复杂输入允许使用 first-party specialized field renderer。
- context bindings 显示来源对象、freshness、revision；可 detach，但不能改为 raw ID/string 绕过验证。
- preflight 返回 effect preview、changed objects summary、permission/cost、expected versions 和 timeout/output ceilings。
- stale/expired intent 必须重新 preflight。

### Execution controls

- Run、Cancel、Retry、Reconcile 的可见性由 Task/descriptor/policy 决定。
- `Cmd/Ctrl+Enter` 不绕过任何 dialog/gate。
- 写命令默认单并发；read 按 grant/policy 限制。
- 关闭 Pane、切 session 或刷新页面不改变 Task。

### Output

- Summary 为默认 tab，优先状态、影响、关键 facts、next action。
- Events 使用 cursor、virtualization、filter 和 follow-tail；用户滚离底部后不强制跳回。
- Artifacts 显示 type、size、checksum、freshness、evidence；无权限不显示路径。
- Explain 展示 bounded rationale/risk/confidence/next action，不展示思维链。
- Console/JSON 属于 technical disclosure；需权限，redacted/truncated。

### Agent collaboration

- Agent suggestion card 显示 command、scope、safe args、basis、risk、origin、Run/Open/Review。
- Agent presentation intent 默认 suggestion-only；用户激活后才打开 Pane。
- Agent 结果 card 链接到 Task/CLI/Evidence Pane，不把日志塞入 conversation。
- Agent 不自动 retry/reconcile，不自动同意 cost/permission，不修改 Pane layout。

## 8. 状态与恢复矩阵

| State | Pane 呈现 | Primary next action |
|---|---|---|
| `needs_contract` | disabled descriptor + missing contract | 查看 owner/实现要求 |
| `permission_required` | effect/risk + required role/scope | Resolve permission |
| `cost_required` | ceiling/estimate/approver | Confirm/Cancel |
| `stale` | retained safe draft + changed revision | Re-preflight |
| `offline` | last readiness + diagnostic | Retry readiness |
| `queued` | queue reason/order if safe | Wait/Cancel |
| `running` | live safe events + elapsed | Cancel if supported |
| `cancel_requested` | pending owner/host acknowledgement | Wait/Reconcile if unknown |
| `partial` | succeeded facts + remaining blockers | Retry incomplete part |
| `failed` | stable error/retryability/trace | Fix/Retry |
| `unknown_accept` | uncertain acceptance warning | Explicit Reconcile |
| `cursor_expired` | retained terminal summary | Reload from snapshot |
| `output_truncated` | summary/tail + artifact | Open Artifact |

## 9. 成功指标

- 95% 的 CLI Pane run 由 descriptor/typed form 发起，不出现 client command string。
- Operation-backed command 的 Task/receipt parity 与原 API 调用一致。
- Agent-origin write 的未授权 Task 创建率为 0。
- duplicate Run 的重复 side effect 为 0；`unknown_accept` 自动重试为 0。
- 可恢复运行在关闭/重开 Pane 后状态一致率 100%。
- 结构化输出 parser/redaction contract 通过率 100%；secret sentinel 泄漏为 0。
- desktop/tablet/mobile 核心路径键盘完成率 100%，关键 axe violation 为 0。
- 首批 canary 的 P95 event-to-Pane latency 和 memory baseline 在实施前记录，晋级不得回退超过批准阈值。

## 10. 交付切片

### Slice A — Native Command Pane

- `agent.cli.v1`、catalog、typed preflight、Operation-backed execution。
- Task-derived history、Summary/Facts/Events/Artifacts/Explain。
- Pane management、responsive、keyboard/a11y。
- 不启用 Agent auto-run 和 Host process。

### Slice B — Agent Command Collaboration

- Agent discover/prepare/present/observe。
- canonical write proposal。
- bounded delegated read grant canary。
- audit/attention/result cards。

### Slice C — Approved Host Runtime

- pure-Go host process/interface、argv/no-shell、mount/env/secret/resource policy。
- `workbench.cli.host.run.v1`、cancel/reconcile、structured stdout/stderr。
- 首批 2–3 个 Workbench CLI canary 和四 transport/evidence。

### Slice D — Enterprise expansion

- command groups/favorites/admin catalog management（仍为 server-authored）。
- 更多 owner/enterprise CLI adapters。
- performance tuning 与 SavedView/跨设备 safe presentation 评估。

## 11. Definition of Usable

- 用户能从 Agent、项目对象或 Pane palette 找到真实可用命令。
- 用户能理解命令范围、风险、门禁和 expected effect，而无需阅读 raw CLI help。
- Run 产生真实 Task、event、artifact、receipt；关闭 Pane 不影响执行。
- Agent 能准备、展示、观察；只有明确 delegated read 能自动执行，写命令必须决策。
- 任意 shell、PTY、browser spawn、raw path/env/secret 无法通过 UI/API 绕过。
- 错误/partial/unknown/cancel 状态保持真实并有恢复路径。
