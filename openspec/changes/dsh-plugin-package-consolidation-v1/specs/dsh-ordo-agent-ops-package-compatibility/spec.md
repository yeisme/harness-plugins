## ADDED Requirements

### Requirement: 旧 leaf package 的一个发布周期兼容 shim

发布 0.1.0-rc.7 SHALL 继续发布 @yeisme/dsh-host-ordo-agent-ops、@yeisme/dsh-host-ordo-commands 与 @yeisme/dsh-client-ui-ordo-agent-ops 的 compatibility shim。shim SHALL 保持当前已发布 root/subpath export 可解析，并把行为委派给统一 package 的受控模块；旧 package SHALL 发出一次无敏感数据的弃用诊断。

#### Scenario: legacy profile 未升级

- **WHEN** profile 只包含三个旧 leaf package 的既有 Loader row
- **THEN** shim SHALL 保持一个 bridge、一个 /ordo 和一个 sidebar 的兼容行为，并提示迁移到 @yeisme/dsh-ordo-agent-ops

#### Scenario: 旧 subpath consumer

- **WHEN** 现有 consumer 导入旧 leaf package 已发布的类型、invariant 或 remote subpath
- **THEN** shim SHALL 在 0.1.0-rc.7 中保持该 import 可解析，且不得把 consumer 指向未发布源码路径

### Requirement: mixed profile 恰好一次挂载

legacy-only、new-only 和同时包含 legacy/new 的 profile SHALL 在一个 runtime generation 内只产生一份逻辑 Ordo Agent Ops contribution。重复保护 SHALL 是 fiber-scoped、可 dispose 且不依赖加载顺序或永久全局标志。

#### Scenario: new-only profile

- **WHEN** profile 仅安装 @yeisme/dsh-ordo-agent-ops
- **THEN** Loader/Web composition SHALL 产生恰好一个 bridge、一个 /ordo 与一个 sidebar

#### Scenario: mixed profile

- **WHEN** profile 同时解析 unified package 和任何旧 leaf shim
- **THEN** composition SHALL 不重复注册 Host service、/ordo command、Remote 或 sidebar，并在卸载后允许下一 generation 正常重新挂载

### Requirement: 兼容窗口、移除门与回滚

旧 leaf package SHALL 至少保留 0.1.0-rc.7 一个完整发布周期，并且不早于 0.1.0-rc.8 才能由新的 OpenSpec change 移除。发布文档 SHALL 指明回滚为恢复此前 bundle-only 的 @yeisme/dsh-ordo-agent-ops release；本 change 不得删除用户数据或迁移 Ordo canonical state。

#### Scenario: 候选发布的单命令验收失败

- **WHEN** 干净 profile 的 unified package 安装、Loader 或 Web composition 失败
- **THEN** 发布 SHALL 被阻止，且 rollback SHALL 恢复此前的 @yeisme/dsh-ordo-agent-ops bundle 版本而不是要求用户手动安装 leaf package

#### Scenario: 兼容窗口结束前的删除尝试

- **WHEN** 实现者尝试在 0.1.0-rc.7 中删除旧 leaf package 或其 export
- **THEN** change SHALL 被视为违反兼容窗口，并要求另一个含迁移与 release 证据的 OpenSpec change
