# Project Automation Pane UI Spec

## 产品与页面模式

- Surface：`project.automation.v1` 与 `project.automation-run.v1`，只存在于 `/agent` 的注册 Pane dock。
- Pattern：Automation 使用 `list + detail`；Run 使用 `timeline + event detail`。
- Owner：binding/trigger/mapping 属 ProjectAutomationService；definition/run/step 属 WorkflowService；proposal/decision 属 ProposalAuthorityService；Owner mutation receipt/reconcile 仍走 TaskService/Owner。
- 禁止：第二 route shell、Canvas edge 直接 enable、浏览器时间触发、任意脚本/URL/credential、把 proposal accepted 显示为 run succeeded。

## 信息架构

```text
ProjectAutomationPane
├── ScopeHeader(dataset + server truth badge)
├── BindingList
│   ├── NewBinding
│   └── BindingRow(state + revision + workflow label)
└── BindingEditor
    ├── TriggerAndFilter
    ├── PublishedDefinitionPicker
    ├── TypedInputMappingEditor
    ├── ActorCostApprovalPins
    ├── ValidationAndProposalDecision
    ├── PublishPauseDisableActions
    ├── ManualStart
    └── RunProjectionList

ProjectAutomationRunPane
├── RunTruthHeader
├── ReceiptAndReconcileRefs
├── StepList(gate/receipt/evidence)
├── SafeEventTimeline
└── WorkflowControls
```

## 状态与权限

- `loading`：稳定 skeleton，不显示假 binding/run。
- `empty`：一个真实创建入口；没有 published definition 时创建保持禁用并解释原因。
- `permission_required/needs_contract/offline`：显示服务端错误分类与恢复提示。
- `stale`：保留 binding 投影，validate/enable 禁用，要求更新 pin/schema 后重验。
- `decision_unknown` / workflow `reconciling|needs_intervention`：隐藏 accept/enable/retry/cancel，只显示原 attempt reconcile。
- mutation 在服务端返回前不乐观推进 state、revision、receipt 或 run。
- Agent-created binding 必须观察到匹配 binding 的 canonical proposal 为 `accepted` 后，才可显式执行 enable；proposal decision 本身不自动 enable。

## 设计系统

- 使用现有 semantic tokens、Button/Input/Select/Dialog 和 Pane 状态组件。
- 桌面保持高密度双栏；窄 Pane/移动端改为单列，不创建横向页面溢出。
- 运行、revision、checksum、binding/run/gate/receipt refs 使用 mono；主标签优先显示 dataset/definition 名称。
- Motion 只使用已有 CSS/Radix 120–240ms 状态动效；reduced motion 由共享 motion 层处理。

## 控件合同

| 控件 | Primitive | 服务端数据/动作 | 失败与键盘 |
| --- | --- | --- | --- |
| Dataset/definition/trigger/source picker | Select | Project/Workflow typed clients | Arrow/Enter/Escape；无合同项禁用并解释 |
| Binding row | native button | selected browser composition only | Enter/Space；不修改 binding |
| Mapping fields | Input + Select | draft only，submit 时 closed SDK validation | invalid 保留 draft，不回显不安全值 |
| Validate | Button | `ValidateAutomationBinding` | pending 禁双击；显示 reason/recovery |
| Proposal decisions | Button | ProposalAuthority typed decide/reconcile | 每次显式激活；unknown 只 reconcile |
| Enable/disable | Dialog + Button | expected revision + idempotency | server revalidate；无乐观 success |
| Manual start | Input + Button | record ref/version selection | selection/version 非法时不发请求 |
| Open run | Button | closed `project.automation-run.v1` request | 经统一 registry/limit/focus gate |
| Run controls | Button | WorkflowService pause/resume/cancel/reconcile | unknown/reconciling 只 reconcile |

## 验收

- Component：happy、stale、permission revoke、proposal unknown、run reconcile-only。
- Browser：proposal/validation/enable/run observation 主路径，stale/revoke/unknown 恢复路径。
- 1440/移动 Sheet 无页面级横向溢出；所有 control 可键盘到达，disabled 有原因。
- 浏览器网络只命中 Workbench same-origin typed facade；截图和错误不含 raw record value、credential、URL、private path 或 Owner payload。
