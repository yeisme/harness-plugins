# Project Data Workspace UI Spec

## 1. Product Posture

```yaml
page:
  name: Project Data Workspace Pane
  host_route: /agent
  pane_types:
    - project.workspace.v1
    - project.schema.v1
    - project.automation.v1
    - project.automation-run.v1
  viewports:
    desktop: 1440x960
    tablet: 1024x768
    mobile: 390x844

design_tokens:
  source: existing Workbench design system
  product_type: operations-workbench
  keywords: [high-density, calm, professional, low-saturation, non-marketing]
  spacing: [4, 8, 12, 16, 24, 32]
  radius: 6-8
  motion: 120-240ms, reduced-motion-safe
  status_colors_only: [ready, running, warning, blocked, stale, unknown_accept]
```

页面问题：

> 当前项目有哪些需要推进的工作、我能安全改变什么、自动化正在做什么、失败后如何恢复？

视觉方向沿用现有 Agent-first / Operations Orbit，不新增营销 Hero、KPI 卡片墙、厚玻璃、无意义渐变、随机颜色或全屏空 Canvas。

## 2. Information Architecture

```text
/agent
├── Agent anchor (timeline + composer)
└── Project Workspace Pane
    ├── Project/Dataset selector
    ├── View tabs: Table | Kanban | Todo | Canvas
    ├── Query bar: filter | sort | group | fields | search
    ├── Primary view surface
    ├── Selection toolbar
    └── Inspector

Auxiliary registered panes
├── Schema & Fields
├── Automations
└── Automation Run / Evidence
```

Automations 不是第五种数据视图，而是独立辅助 Pane。Table/Kanban/Todo/Canvas 是同一 dataset 的 view kind。

## 3. Desktop Wireframe

```text
┌──────── Agent session 36% ────────┬──────── Project Workspace 64% ───────────────┐
│ Session / runtime / context       │ Project ▾  Dataset ▾  View ▾      + Record    │
│                                   ├───────────────────────────────────────────────┤
│ Agent timeline                    │ Table | Kanban | Todo | Canvas                 │
│ - findings                        │ Filter  Sort  Group  Fields  Search   Automate │
│ - questions                       ├───────────────────────────────┬───────────────┤
│ - proposal / run updates          │ Primary view                  │ Inspector     │
│                                   │                               │ fields        │
│                                   │                               │ actions       │
│ Composer                          │                               │ evidence      │
└───────────────────────────────────┴───────────────────────────────┴───────────────┘
```

- 默认最多同时出现 Agent + Project Workspace + 1 个辅助 Pane。
- Inspector 可在 Project Pane 内 320–360px 展开，或作为独立 Pane；不能同时形成两个 competing inspector。
- Canvas focus mode 扩大 Project Pane，但保留 Agent session breadcrumb、composer restore 控制和当前 task status，不创建独立 route/shell。

## 4. View Patterns

### 4.1 Table

- Pattern：dense table + inspector。
- Sticky header、row selection、server pagination/virtualization、44px default row、compact density 36px。
- system fields 与 custom fields共用 header menu，但 system field的 rename/type/archive controls disabled并展示原因。
- cell edit 使用一致 editor primitive；保存中锁定该 cell，conflict 保留用户输入并显示 server/current diff。
- bulk action 显示选中数量、权限范围、可能 partial 与取消方式。

### 4.2 Kanban

- Pattern：horizontal board + inspector；列来自 server-approved group field。
- 卡片 primary text 为 title，secondary 为 priority/assignee/due/status；最多显示 4 个 configurable fields。
- drag placeholder 是 pending 呈现，不改变 canonical column；event 确认后落位。
- 每个 drag action都有 `Move to…` context menu、keyboard move mode和 command palette等价路径。
- WIP limit显示 server count/policy；超限列不可仅靠隐藏 drop target表达，必须给 disabled reason/recovery。

### 4.3 Todo

- Pattern：sectioned list + compact inspector。
- Sections：Today、Upcoming、No date、Completed；可由 view config缩减，但不能用 browser-local user id决定“My”。
- checkbox 不是纯视觉 checkbox：点击后解析 allowed action；需要 review/approval时显示对应 action label。
- Quick add 最少输入 title，可展开 priority/assignee/due/custom fields。

### 4.4 Canvas

- Pattern：structured graph canvas + Inspector + Problems & Evidence。
- `@xyflow/react` 负责 pan/zoom/select/connect/geometry；backend负责 node/edge policy、persistence、viewport/LOD、permissions。
- minimap、fit selection、layer filters、search、zoom controls、keyboard move/connect mode。
- far/medium/near 三档投影，zoom 远时不显示全文或全部 handles。
- 空态提供“从当前 view 添加记录”或“导入现有 WorkItem”单一推荐动作，不显示永久空白画布。

## 5. Component Tree

```text
AgentConversationWorkspace
└── AgentPaneDock
    └── ProjectWorkspacePane
        ├── ProjectWorkspaceHeader
        │   ├── ProjectSelector
        │   ├── DatasetSelector
        │   ├── ViewSwitcher
        │   └── PrimaryActions
        ├── ProjectQueryToolbar
        ├── ProjectDataState
        ├── ProjectViewSurface
        │   ├── ProjectTableView
        │   ├── ProjectKanbanView
        │   ├── ProjectTodoView
        │   └── ProjectCanvasView
        ├── ProjectSelectionToolbar
        └── ProjectInspector

ProjectSchemaPane
├── FieldList
├── FieldEditor
└── MigrationStatus

ProjectAutomationPane
├── BindingList
├── TriggerEditor
├── WorkflowDefinitionPicker
├── InputMappingEditor
└── ValidationAndPublish

ProjectAutomationRunPane
├── RunTimeline
├── StepDetail
├── GateAndDecision
└── ReceiptEvidenceRecovery
```

## 6. Interactive Control Inventory

| ID | Primitive | Data source / action | Keyboard and acceptance |
| --- | --- | --- | --- |
| project-selector | Combobox | server ProjectWorkspace directory | typeahead、no results、permission state、Escape restore |
| view-switcher | Tabs/segmented control | ProjectView list | arrows switch、selection preserved、no record refetch drift |
| query-filter | Popover + typed builder | field registry + operator registry | full keyboard、invalid predicate inline error |
| field-editor | Dialog/Sheet form | ProjectFieldDefinition | focus trap、dirty confirm、type migration warning |
| cell-editor | kind-specific control | WorkItem mutation descriptor | Enter edit/save、Escape cancel、conflict preserves draft |
| kanban-card-move | dnd + menu + keyboard mode | ProjectDragIntentV1 | all paths resolve same descriptor; live region announces pending/result |
| todo-complete | Checkbox/action button | WorkItem allowed action | Space activates; label changes to review/approve when done unavailable |
| canvas-connect | React Flow handle + keyboard dialog | Board typed relation | relation allowlist; reject leaves graph unchanged |
| bulk-action | Selection toolbar + confirmation | batch WorkItem mutation | shows count/scope/partial semantics; duplicate disabled while pending |
| automation-enable | AlertDialog for risky binding | ProjectAutomationService | displays trigger、definition version、scope、cost/approval and recovery |
| run-reconcile | ActionDescriptor button | Workflow reconcile | enabled only for unknown/reconciling; never starts new attempt |

## 7. Shared State Matrix

| State | Surface behavior |
| --- | --- |
| `loading` | structured skeleton matching current view |
| `empty` | one explanation + one recommended create/import action |
| `needs_contract` | truthful status + missing dependency + disabled actions |
| `permission_required` | scope/recovery path; hidden fields stay absent |
| `stale` | last-confirmed projection + refresh/re-authorize; mutation disabled |
| `offline` | local layout/selection retained; server data marked last-confirmed |
| `conflict` | current safe diff + reload/merge/reapply; draft preserved |
| `partial` | per-record result list; successes retained; failed subset retry only |
| `unknown_accept` | receipt/reconcile only; no retry/duplicate move |
| `limit_reached` | explain Pane/view limit and allow explicit close/replace |

## 8. Responsive Plan

- Desktop >= 1200px：Agent + Project Pane；Inspector inline；Canvas full editing。
- Tablet 768–1199px：一次一个 primary Pane；Inspector/filters/schema/automation 作为 right Sheet；Kanban 横向滚动并提供分组列表替代。
- Mobile < 768px：single Sheet；Table 变 record list，Kanban 变 grouped list，Todo 保持原生列表，Canvas 只 browse/select/inspect/lightweight move；schema 和 workflow graph editing显示 `desktop_required`。
- 200% zoom：不产生页面横向滚动；dense surface内部滚动；action toolbars可折叠到 overflow menu。

## 9. Accessibility

- 所有 drag/connect/reorder有 menu/keyboard等价路径。
- Pane/Sheet/Dialog 定义 focus entry、trap、Escape、scroll lock和 focus return。
- Kanban列、Todo sections、Table headers、Canvas selection变化通过 semantic labels/live region宣布。
- 不用颜色单独表达 status/WIP/conflict；status chip包含文字和可读 description。
- Canvas 支持 reduced motion，禁用 decorative zoom/transition；自动 layout 后 focus 回到原 selection。
- icon-only controls有 accessible name和 tooltip；disabled action有原因。

## 10. Dependency Canaries

- `@xyflow/react`：已存在，继续使用；验证与 Dockview、focus、touch、200% zoom共存。
- Editable grid：评估 `@tanstack/react-table` + `@tanstack/react-virtual`；未通过 bundle/a11y/perf gate时使用 server-paginated semantic table。
- DnD：评估 `@dnd-kit/core` keyboard/pointer sensors；无论是否采用，context menu/keyboard move是合同必需能力。
- 不为普通状态变化新增 motion runtime；优先现有 CSS/Radix state animation。

## 11. Visual Blacklist

- 顶层 Project/Canvas route 或第二套 app shell。
- 全屏空 Canvas、营销 Hero、KPI card wall、厚玻璃、渐变背景、随机 emoji/颜色。
- 卡片内再嵌卡片、每个字段都用 chip、过度圆角、无理由 disabled controls。
- 仅靠 toast 宣称保存/完成、假实时 glow、optimistic canonical success。
- Owner/provider内部服务名作为主导航。

## 12. Visual and Interaction Acceptance

- 固定桌面/平板/手机截图覆盖四视图、Inspector、filter open、field dialog、automation validation、unknown/partial/conflict状态。
- 四视图结构、密度、token、spacing和状态符合本 UI Spec；无文本溢出、布局跳动或 page-level overflow。
- pointer/keyboard/menu对 Kanban move、Canvas connect、bulk action产生同一 command和结果。
- mobile browse/review/quick action可完成，复杂编辑不伪装可用。
- Playwright/Axe 无 serious/critical a11y finding；reduced-motion和focus restore通过。
