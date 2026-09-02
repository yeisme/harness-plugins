## ADDED Requirements

### Requirement: 内部稳定结构化 surface V1

`packages/sdk/dsh-plugin-contracts` SHALL additive 导出 `DshPluginSurfaceContributionV1`、view/action/health/receipt codec 与 probe helpers，并保留所有现有 safe projection、slot/capability probe 和 dispose exports。V1 面向 Yeisme 内部 profile 视为稳定，字段演进 MUST optional/additive；rename/removal 需要新 contract version、至少一个 release 双读和回滚记录。

#### Scenario: 旧 SDK consumer 编译

- **WHEN** 现有 consumer 只使用变更前 exports
- **THEN** 其类型检查与运行行为 SHALL 不变，MUST 不要求提供新字段或新 registration

### Requirement: SDK 与宿主镜像合同测试

SDK SHALL 提供 Web host、TUI structural mirror 和 example plugin 的 conformance fixtures；任一字段、enum、reason code 或 dispose 语义漂移 MUST 使 contract test 红灯。

#### Scenario: TUI mirror 遗漏 action revision

- **WHEN** SDK fixture 包含 `expected_revision` 而 TUI mirror/decoder 未保留
- **THEN** conformance test SHALL 红灯并指出丢失字段
