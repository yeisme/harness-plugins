# Project Data Workspace PRD

## 1. Problem and Target Users

### Problem

企业团队已经能在 Workbench 中创建和跟踪 WorkItem，也能使用 Spatial Board 与 durable workflow，但三者尚未组成日常可配置的项目系统。项目经理需要在一个地方定义字段和视图，团队成员需要用 Kanban/Todo 快速推进，流程管理员需要把重复规则绑定为可审计自动化，Agent 需要在同一上下文中解释、建议和发起受控动作。

当前替代方案会迫使用户在多个 Pane、外部表格和手工流程之间同步，或把画布连线误当作执行，导致状态漂移、权限绕过和“看起来完成但没有 receipt”。

### Target Users

| Persona | Job to be done | Success signal |
| --- | --- | --- |
| 项目经理 | 建立项目字段、共享视图、负责人和流程约束 | 不写代码即可形成团队工作方式 |
| 团队成员 | 从个人 Todo 和 Kanban 处理任务 | 所有视图实时反映同一 WorkItem 状态 |
| 流程管理员 | 设计、验证、发布和停用自动化 | 每次触发、审批、执行和失败都可审计/恢复 |
| 审批人/运营 | 处理风险、成本、冲突和 unknown outcome | 不重复执行，能从 receipt/evidence 对账 |
| Agent | 基于 selection/project context 提建议、建草稿和观察运行 | 不取得浏览器外权限，不绕过 Proposal/Task/Owner gate |

## 2. Owner-Fit Decision

| Capability | Decision | Canonical owner | Workbench responsibility |
| --- | --- | --- | --- |
| ProjectWorkspace/Dataset/View/Role metadata | `fit` | Workbench Project service | versioned metadata、query、policy、audit |
| WorkItem record and lifecycle | `fit/reuse` | WorkItemService | custom field extension，不复制状态机 |
| Canvas geometry and relations | `fit/reuse` | BoardService | structured visual organization |
| Workflow execution | `fit/reuse` | WorkflowService + TaskService | trigger/binding、观察、恢复 |
| Owner domain object/action | `split-owner` | corresponding Owner | safe projection/action/receipt/deep link |
| Arbitrary scripts/network/browser executor | `reject-now` | undefined | 不提供入口 |

## 3. Required Capability Ledger

| ID | Capability | Requirement status | Delivery | Owner | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| P01 | ProjectWorkspace binding to safe projectRef | required | now | Project service | cross-tenant/owner tombstone tests |
| P02 | ProjectDataset + schema revisions | required | now | Project service | migration/revision/property tests |
| P03 | WorkItem custom fields | required | now | WorkItemService | type/permission/transaction parity |
| P04 | Table view | required | now | Project view + Web | fixed viewport screenshots + keyboard edit |
| P05 | Kanban view | required | now | Project view + WorkItemService | drag/menu parity + conflict/WIP tests |
| P06 | Todo view | required | now | Project view + WorkItemService | actor-safe query + transition tests |
| P07 | Canvas view | required | now | BoardService | 10k LOD + safe node reconcile |
| P08 | Shared filters/sort/group/visible fields | required | now | Project query | four-transport query/cursor parity |
| P09 | Project roles and field/action permissions | required | now baseline | R1 + Project policy | role matrix/revoke/cache purge |
| P10 | Project automation binding | required | now low-risk | Project automation + WorkflowService | dedupe/pin/stale/start-run tests |
| P11 | Owner mutation in automation | required | contract-gated | Owner + TaskService | real canary receipt/reconcile |
| P12 | Agent proposal and selection handoff | required | now | Agent/Proposal authority | proposal accept → typed action trace |
| P13 | Formula/lookup | committed | next | Project service or projection owner | separate spec/security/perf evidence |
| P14 | Form intake | exploratory | next | unresolved | owner-fit + anti-abuse + evidence |
| P15 | Dashboard/report | optional | later | Project analytics | query/capacity spec |
| P16 | Arbitrary script/webhook | rejected | none | undefined | separate user decision/new trust boundary |

## 4. First Delivery Slice

### Deliver now

- 一个 `ProjectWorkspace` 绑定一个 safe projectRef。
- 一个默认 `ProjectDataset`，record kind 固定 WorkItem。
- System fields + 9 种 custom fields。
- Table/Kanban/Todo/Canvas 四视图。
- typed filter/sort/group、private/project shared views。
- viewer/contributor/project_manager/automation_manager/project_admin 五角色基线。
- manual、record_created、status_transitioned 三类 trigger。
- `read_projection`、condition、delay、approval、WorkItem mutation 和一个低风险 Owner operation canary。

### Retain next

- formula、lookup、跨 dataset relation、form intake、模板市场、dashboard、评论/通知。
- schedule 与 approved external event trigger 在 worker/readiness 证据后晋级。

### Explicit non-goals

- 任意脚本、任意 URL/webhook、browser execution、跨 tenant dataset、Owner 私有页面、通用 BPMN。

## 5. Core User Workflows

### A. Project manager creates a workspace

1. 从 `/agent` 命令面板打开 Project Workspace Pane。
2. 选择服务端批准的 projectRef；无权限或合同不足显示 truthful state。
3. 使用默认 WorkItem schema，新增受控 custom fields。
4. 创建共享 Kanban 与 Todo view，配置 filter/group/visible fields。
5. 分配 project roles；服务端返回 policy revision 和 audit ref。

### B. Team member processes work

1. 打开 “My Todo”，服务端按当前 principal 解析 records。
2. Quick add 创建 WorkItem；event 出现后加入 Table/Kanban/Todo。
3. 在 Kanban 中拖动卡片；若状态允许则提交 transition，若需审批/WIP override 则显示 gate。
4. 在 Canvas 中查看依赖/阻塞关系；连线只更新组织关系或 workflow draft。

### C. Automation manager builds a task flow

1. 从 selection/record 创建 automation draft。
2. 选择 trigger 和已发布 WorkflowDefinition，映射允许字段。
3. 服务端验证 schema、role、capability、cost、approval 和 definition checksum。
4. 用户显式 enable；Agent 生成的草稿先进入 ProposalAuthority。
5. WorkItem event 触发 run；Run Pane 展示 step/gate/receipt/reconcile。
6. schema drift、permission revoke 或 Owner offline 时停止新 run并显示 recovery。

### D. Unknown outcome recovery

1. Owner mutation 网络结果未知，workflow step 进入 reconciling。
2. WorkItem/Todo/Kanban 不显示最终完成，只显示 unknown 状态和 receipt ref。
3. 用户或 operator 触发 reconcile，同一 idempotency key 查询 Owner。
4. 确认后更新 run/step/evidence；禁止自动重放。

## 6. State and Transition Summary

```text
ProjectWorkspace: active -> archived
Dataset: draft -> active -> schema_migrating -> active | degraded -> archived
ProjectView: active -> stale -> active | archived
AutomationBinding: draft -> enabled -> paused | stale | needs_contract -> enabled | disabled
```

这些状态不替代 WorkItem、Board 或 Workflow 状态机，只描述组合 metadata 的可用性。

## 7. Data and Integration Contracts

- Browser 只通过 `WorkbenchClient.projects/workItems/boards/projectAutomation` typed clients。
- Project query 返回 access-trimmed safe record page 与 opaque cursor。
- WorkItem custom field mutation与 WorkItem version/event/outbox 同事务。
- Canvas 只保存 Board geometry/relation 和 workItem safe ref/version。
- Automation binding pin schema revision 与 workflow definition version/checksum。
- Owner action只通过 step registry → TaskService → approved adapter → receipt/reconcile。
- 所有 mutation带 expected revision、idempotency、actor context、trace/audit ref。

## 8. Trace, Audit, and Evidence

每个 record/schema/view/role/binding mutation 记录 actor、scope、action、target ref、previous/current revision、request/trace/audit ref 和 redacted changed field refs。Automation 另外记录 trigger event ref、binding version、workflow run ref、Task/receipt/evidence refs。

integration 及以上运行必须由项目 runner 自动生成 `temp/integration-test-runs/<run-id>/summary.json`，不能手写官方 summary；失败也必须保留 command、stdout、stderr、env 和 artifacts。

## 9. Acceptance Criteria

- 四种视图对同一 WorkItem mutation 在一个 event cycle 内收敛，刷新后不漂移。
- Kanban pointer/keyboard/menu move 解析为同一 typed action，conflict/WIP/permission 失败不产生 ghost success。
- Todo “My” query 不接受浏览器伪造 actorRef，done 受 WorkItem transition/acceptance 约束。
- Canvas 10k node 时按 viewport/LOD bounded 查询，不下载全量 detail。
- Automation duplicate event只启动一个 run；schema/definition/policy drift fail-closed。
- Owner unknown outcome 只 reconcile，不自动重发。
- HTTP/gRPC/JSON-RPC/SDK 的 state/version/error/page/event/receipt 语义一致。
- 移动端仍可 browse/review/quick action，复杂编辑明确提示 desktop_required。
- 所有 integration/system/e2e/performance evidence 已脱敏并落在项目 temp 路径。

## 10. Risks and Open Decisions

- EAV 性能、grid/DnD dependency、row-level predicate 深度、formula/lookup owner、form/notification owner 尚需独立证据或后继 change。
- R3/R4 未完成的真实 provider、PostgreSQL、worker 和 staging gates 是正式启用 automation/Canvas mutation 的硬依赖，不能用 fixture 消除。
