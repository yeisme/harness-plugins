# creator-studio-drama-workflow Specification

## Purpose
TBD - created by archiving change dsh-creator-unified-pane-workspace-v2. Update Purpose after archive.
## Requirements
### Requirement: Creator Home SHALL expose a complete current-project drama workflow

Creator Home SHALL 提供“完整做剧”入口，并复用 AI Drama Director 的 Context、Story、Visual、Audio、Run 和 Review Pane。用户 SHALL 能按需完成故事、视觉、音频、镜头、生成、审批和 owner 发布的导出动作，而无需先打开 Workbench。

#### Scenario: Drama Director face is available
- **WHEN** 用户从 Creator Home 进入完整做剧
- **THEN** Client SHALL 应用 Director preset 并聚焦当前项目/Show Context

#### Scenario: Secondary drama panes are needed
- **WHEN** 用户进入故事、视觉或音频阶段
- **THEN** 对应 Pane SHALL 按需打开且默认 preset MUST NOT 一次铺开所有面板

### Requirement: Workbench SHALL remain an optional professional handoff

Pane 内流程 SHALL 面向当前会话和项目任务；Workbench SHALL 继续承载 Episode Board、批量 Review、跨集比较、专业 Asset Wall 和 Delivery。Handoff SHALL 只传 refs、revision、intent、expiry 与 nonce，并在 Workbench 重新读取 owner 数据。

#### Scenario: User continues in Pane
- **WHEN** 当前 owner contract 已发布所需动作
- **THEN** 用户 SHALL 能继续做剧而不触发 Workbench handoff

#### Scenario: User opens Workbench
- **WHEN** 用户显式选择 Open in Workbench
- **THEN** Client SHALL 使用现有签名 handoff，且 Creator/Drama browser cache MUST NOT 成为 Workbench facts

