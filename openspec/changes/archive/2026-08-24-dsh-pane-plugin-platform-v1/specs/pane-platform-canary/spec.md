## ADDED Requirements

### Requirement: Canary SHALL 覆盖两个独立 mock provider
首切片 SHALL 至少装配一个只读 notes provider 与一个媒体审查 provider，覆盖不同 view/artifact/action contribution。两者 SHALL 通过同一 SDK 注册，不得使用 test-only 私有 registry 路径。

#### Scenario: 两个插件同时注册和卸载
- **WHEN** canary 注册两个 provider、更新 projection、分别 dispose
- **THEN** contribution snapshot SHALL 按生命周期准确增减
- **AND** 所有 plugin dispose 后 listener、entity 与 pending receipt SHALL 无残留

### Requirement: Canary SHALL 使用真实 DSH SessionProjectionRegistry
集成测试 SHALL 使用已发布 `@deepseek-ai/dsh-session-projection` 与 `@deepseek-ai/dsh-session` 注册纯 projection unit、append 安全 session event、读取 snapshot/change 并映射到 Pane event runtime。测试 MUST NOT patch DSH core 或模拟一个同名自制 registry。

#### Scenario: DSH projection 产生 whole-value change
- **WHEN** Session append 一个被 canary unit 观察的安全 event
- **THEN** DSH registry SHALL 产生 schema-valid whole-value snapshot/change
- **AND** Pane runtime SHALL 以连续 cursor/sequence 应用它而不轮询

### Requirement: Canary SHALL 执行 source-independence gate
依赖、manifest、source import、fixture 和 build/tarball SHALL 扫描 `dsh-better-sidebar` package/path/copied artifact marker。研究性文档链接 MAY 存在；生产依赖、imports 或复制产物 MUST 使 gate 失败。

#### Scenario: 生产依赖误加入参考插件
- **WHEN** package manifest 添加 `dsh-better-sidebar` dependency
- **THEN** source-independence test SHALL 失败并指出合同违规
- **AND** 构建不得被判定为可发布 canary

