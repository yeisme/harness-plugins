## Why

Workbench 已经分别具备 R3 `WorkItem` 日常运营模型与 R4 Spatial Board / durable workflow 基础，但用户仍缺少一个可由企业自行配置、可在同一数据源上切换 Table、Kanban、Todo 与 Canvas 的项目协作层。若每种视图各自保存任务、或让浏览器把拖拽和连线直接解释成执行，会重新产生第二套任务状态机、权限漂移、重复 mutation 和不可审计自动化。

本 change 将“飞书多维表格式”的字段、记录、视图、筛选、角色与自动化产品语法收敛为 Workbench 自己的 typed contract：记录真相仍由 WorkItemService 管理，画布复用 BoardService，自动化复用 durable workflow runtime，Agent-first `/agent` 仍是唯一主壳。

## What Changes

- 新增 Workbench-owned `ProjectWorkspace`、`ProjectDataset`、`ProjectFieldSchema`、`ProjectView` 与 `ProjectRolePolicy`；`ProjectWorkspace` 只绑定现有 safe `projectRef`，不创建第二个 canonical Project，首个且唯一可变记录类型为 `WorkItem`，Owner 对象只能作为只读 safe projection/link 字段。
- 在同一 dataset 上提供 `table`、`kanban`、`todo`、`canvas` 四种视图与共享 filter/sort/group/visible-field contract；切换视图不复制记录或创建平行状态。
- 以 R4 BoardService 提供结构化“无限画布”：pan/zoom/viewport/LOD/virtualization、typed node/edge、分组与安全预览；画布连线只表达组织关系或 workflow draft binding，不直接执行 mutation。
- 新增 Project Automation binding：由 record create/update/transition、manual、schedule 或 approved event 触发已发布的 R4 `WorkflowDefinition`；条件、动作、审批、成本、权限、receipt、reconcile 与 `unknown_accept` 全部由服务端验证。
- 扩展 WorkItem 为项目记录核心：受控 custom fields、batch mutation、project/query scope、field-level validation 与 event diff；系统状态、负责人、依赖、验收和 Owner links 继续由 WorkItemService 权威管理。
- 将项目工作区注册为 `/agent` 内的 versioned Pane family；桌面支持 Agent + Project Workspace 并列和受控 focus mode，平板/手机退化为单 Sheet，不新增顶层“Canvas/Project”主壳。
- 增加企业级权限、审计、模板、导入/导出、容量、可访问性和 integration evidence 门；首期只交付安全字段、四视图、基础角色与低风险自动化，公式/lookup、公开表单、任意外部 webhook 和脚本执行不进入首期。

### Required Capability Ledger

| 能力 | 准入 | 交付状态 | Canonical owner | 可见宿主 |
| --- | --- | --- | --- | --- |
| ProjectWorkspace / Dataset / schema | `fit` | deliver-now | Workbench Project service | Project Workspace Pane |
| Table / Kanban / Todo 多视图 | `fit` | deliver-now | WorkItemService + ProjectView metadata | Project Workspace Pane |
| 结构化无限画布 | `fit + reuse` | deliver-now | BoardService | Canvas view |
| 项目自动化设计与运行观察 | `fit + reuse` | deliver-now low-risk slice | Project Automation binding + WorkflowService | Automations / Run Pane |
| 企业角色、字段/动作权限 | `fit` | deliver-now baseline | R1 identity + ProjectRolePolicy | Inspector / Settings Pane |
| Owner 专业对象与动作 | `split-owner` | contract-gated | 对应 Owner + TaskService | safe field / Inspector / deep link |
| Formula / lookup / cross-dataset relation | `fit` | retain-next | Project service | Table / schema editor |
| Intake form / template marketplace / dashboard | `fit` | retain-next | Project service | registered Pane |
| 任意脚本、任意 HTTP/webhook、浏览器 workflow executor | `reject-now` | rejected | 未定义 | 不提供入口 |

## Capabilities

### New Capabilities

- `workbench-project-data-workspace`: 定义 ProjectWorkspace、受控字段 schema、同源多视图、项目角色、Project Workspace Pane、Canvas 绑定、响应式、可访问性、容量与证据合同。
- `workbench-project-automation`: 定义项目记录 trigger、typed condition/action binding、WorkflowDefinition publish/start、审批/成本/权限、run observation、receipt/reconcile 与 operator recovery 合同。

### Modified Capabilities

- `workbench-daily-operations`: 扩展 WorkItem 以支持 project/dataset scope、受控 custom fields、batch mutation、typed query/event diff，同时保持既有集中状态机、expected-version 与 Task/Owner 边界。

## Impact

- Go service：新增 `service/internal/projects/**`、`projectviews/**`、`projectautomation/**`，扩展 `workitems/**`，并通过现有 registry 暴露 HTTP、gRPC、JSON-RPC 与 SDK parity。
- Web：新增注册的 Project Workspace / Schema / Automation / Run Panes；Table/Kanban/Todo 使用同一 query cache，Canvas 复用 `@xyflow/react` 与 R4 Board contract，不引入 tldraw 或第二套 dock/shell。
- 合同与数据：新增 Project/Dataset/Field/View/Role/Automation typed contracts；保存 Workbench-owned metadata、safe refs、revision、audit 与 receipt，不保存 Owner payload、credential、private path、artifact blob 或任意 URL。
- 依赖：实现依赖 R3 WorkItem remaining promotion gates、R4 Board/Workflow four-transport binding 与 Agent Pane registry；依赖未晋级时对应视图/automation 必须显示 `needs_contract`，不得使用 fixture 冒充企业可用。
- 运维与测试：新增 project query/field migration、50k WorkItem 多视图、10k Canvas、concurrent edit/drag、permission revoke、workflow crash/reconcile、rollback 与 24h soak evidence。
