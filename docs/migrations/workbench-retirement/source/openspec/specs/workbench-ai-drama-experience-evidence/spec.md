# workbench-ai-drama-experience-evidence Specification

## Purpose
TBD - created by archiving change workbench-ai-drama-show-control-room-v1. Update Purpose after archive.
## Requirements
### Requirement: Workbench 必须生成脱敏产品研究证据

Workbench SHALL 为受控设计伙伴测试记录 task start/end、stage transitions、blocker categories、review outcomes、reuse refs count 和 export/handoff outcome。证据 MUST NOT 包含内容正文、raw prompt、provider payload、credential 或 private path。

#### Scenario: 用户完成第二集

- **WHEN** 用户完成或 handoff 第二集
- **THEN** evidence SHALL 记录复用的 accepted refs 数量与 owner 类型
- **AND** SHALL 能计算首次可审结果、完整路径和跨集复用指标

### Requirement: 无用户证据时不得提升成熟度

Show Control Room 的成熟度 SHALL 区分 contract evidence、fixture evidence、integration evidence 和 observed-user evidence。

#### Scenario: E2E 已通过但没有设计伙伴测试

- **WHEN** contract、component 和 E2E 全部通过但 observed-user evidence 不存在
- **THEN** capability SHALL 最多标记 first-support
- **AND** MUST NOT 宣称真实评分目标已达成

