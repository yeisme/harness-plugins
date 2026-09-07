# workbench-project-data-workspaces 变更

## ADDED Requirements

### Requirement: Project data next-slice 决策须证据驱动且不静默删项
首期切片之后的 capability 排期 SHALL 基于真实使用/性能/证据逐项做出 deliver-next、retain-next 或 reject-now 决定，并记录依据与 owner。retain-next 项不得在后续 change 中被静默删除或默认排期；reopen 时 MUST 重新做 fit 与 split-owner 评估。

#### Scenario: retain-next 项被重新提案
- **WHEN** 一个 retain-next capability（如 formula/lookup/cross-dataset relation）被提议进入实现
- **THEN** 提案 MUST 引用解除保留所依赖的新证据（合同设计、权限裁剪/预算验证或使用信号）
- **AND** 未附证据的提案不进入任务清单

#### Scenario: 首期切片无新视图负担
- **WHEN** form intake 之外的新展示面（dashboard 等）被请求
- **THEN** 在真实使用信号支撑前保持 reject-now/retain-next 决定
- **AND** 不在本能力面上偷加通用低代码/BPMN 范围
