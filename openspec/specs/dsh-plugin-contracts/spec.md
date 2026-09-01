# dsh-plugin-contracts Specification

## Purpose
TBD - created by archiving change dsh-plugin-dev-toolchain-v1. Update Purpose after archive.
## Requirements
### Requirement: sdk SHALL 收口内部共享契约且不拥有运行时状态
`packages/sdk/dsh-plugin-contracts` SHALL 收口 31 包重复定义的 safe projection 类型、slot/capability probe helpers 与 dispose 合同为单一来源。该包 MUST NOT 拥有 DSH/domain state、scheduler、ledger 或浏览器 store，仅提供类型与纯 helper。

#### Scenario: 消费方改用共享 probe helper
- **WHEN** 某 client 包以 sdk 的 capability probe helper 替换本地重复实现
- **THEN** probe-first 降级行为 SHALL 与替换前语义一致
- **AND** 包体积 SHALL 不因引入 sdk 出现非预期显著增长

### Requirement: contract 测试 SHALL 防止契约漂移
sdk SHALL 附 contract 测试：消费包内联或分叉的契约类型与 sdk 声明不一致时测试 MUST 变红。contract 测试 MUST 覆盖 safe projection 类型、probe helper 签名与 dispose 合同三类。

#### Scenario: sdk 类型演进未同步消费方
- **WHEN** sdk 修改 probe helper 签名而未同步某个仍内联旧签名的消费包
- **THEN** contract 测试 SHALL 红灯并指出漂移的包与签名差异

### Requirement: sdk SHALL 明示内部定位与无 semver 承诺
sdk 的 README SHALL 明示：本包面向本仓内部一致性，不向第三方承诺 API 稳定性或 semver；对外作者平台化延后至有真实第三方需求再立项。版本策略 SHALL 以仓库内部 workspace 引用为准。

#### Scenario: README 声明内部定位
- **WHEN** 读者查看 `packages/sdk/dsh-plugin-contracts/README.md`
- **THEN** SHALL 看到内部定位声明与「不承诺对外 semver」的明确表述
