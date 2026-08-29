## MODIFIED Requirements

### Requirement: Workbench SHALL remain an optional professional handoff

Pane 内流程 SHALL 同时支持当前项目任务和 owner-backed 全剧操作控制台，包括 Episode Board、显式目标批量 Review、跨集 Asset Wall 与 Delivery readiness；Workbench SHALL 继续承载更高密度的空间化布局、复杂跨集分析与外部专业工具。Handoff SHALL 只传 refs、revision、intent、expiry 与 nonce，并在 Workbench 重新读取 owner 数据。

#### Scenario: User continues in Pane
- **WHEN** 当前 owner contract 已发布所需投影与动作
- **THEN** 用户 SHALL 能在 DSH 内完成当前剧集和全剧控制台流程而不触发 Workbench handoff

#### Scenario: User opens Workbench
- **WHEN** 用户显式选择 Open in Workbench 进行高级空间分析
- **THEN** Client SHALL 使用现有签名 handoff，且 Creator/Drama browser cache MUST NOT 成为 Workbench facts
