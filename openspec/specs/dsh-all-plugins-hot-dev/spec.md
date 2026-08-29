# dsh-all-plugins-hot-dev Specification

(merged from archived change 2026-08-29-dsh-all-plugins-hot-dev-v1)

## Purpose

定义 Harness Plugins 工作区全部本地 bundle 的发现、增量构建、profile 同步、HMR/restart 分流、安全进程生命周期与脱敏开发证据合同。

## Requirements

### Requirement: Dev command SHALL discover and synchronize all local bundles
开发命令 SHALL 发现 workspace 中所有声明 `dsh.bundle.patch` 的 package，并通过官方 `dsh plugin` 将其作为 link dependency 同步到目标 profile。已有非目标 dependency MUST 保留。

#### Scenario: 启动全部本地 bundle
- **WHEN** 开发者在仓库根运行默认 dev 命令
- **THEN** 所有合法本地 bundle 被构建并加入 Web profile
- **AND** composed config 校验成功后启动 DSH Web

#### Scenario: 加载仓库外插件
- **WHEN** 开发者重复传入 `--plugin <path>`
- **THEN** 每个路径必须解析到声明 `dsh.bundle.patch` 的 package
- **AND** 合法 package 与 workspace bundle 一起同步和监听

### Requirement: Dev command SHALL rebuild the affected dependency closure
源码变化后，开发命令 SHALL 计算 changed package 的 transitive dependents，并调用各 package 现有 build script。Build MUST 串行合并，失败 MUST 保留当前 DSH 进程和上一版产物。

#### Scenario: 修改共享 host package
- **WHEN** 一个 workspace host package 的源码变化且多个 bundle 依赖它
- **THEN** changed package 与所有 transitive dependents 按依赖顺序重建
- **AND** 成功产物触发 HMR change

#### Scenario: build 失败
- **WHEN** 增量 build 返回非零状态
- **THEN** 当前运行中的 DSH 不因该失败自动退出
- **AND** 下一次相关文件变化重新尝试 build

### Requirement: Dev command SHALL distinguish HMR from profile restart
普通源码变化 SHALL 使用 build artifact pulse + Cordis HMR。Bundle manifest、patch 或 bundle 集合变化 SHALL 重新同步 profile 并重启 DSH。

#### Scenario: 修改 TypeScript 源码
- **WHEN** package `src/` 下的运行时代码变化并成功构建
- **THEN** 脚本更新相关 runtime artifact mtime
- **AND** DSH process 保持运行，由 Cordis HMR reload 已加载插件

#### Scenario: 修改 bundle patch
- **WHEN** `cordis.patch.yml` 或 bundle manifest 变化
- **THEN** 脚本重新运行官方 profile reconciliation
- **AND** 旧 DSH process 被对称停止后启动新 process

### Requirement: Dev command SHALL own a safe local process lifecycle
开发命令 SHALL 合并重复事件、限制一个 build/sync writer，并在 SIGINT/SIGTERM 时关闭 watcher 和 DSH child。临时 overlay 与 evidence MUST 位于本子项目 `temp/`。

#### Scenario: 用户停止开发命令
- **WHEN** 用户按 Ctrl+C 或进程收到 SIGTERM
- **THEN** watcher 停止接收新事件
- **AND** DSH child 先收到 SIGTERM，超时后才使用 SIGKILL

### Requirement: Dev workflow SHALL provide non-mutating validation and evidence
开发命令 SHALL 提供只读 check 模式。Integration entrypoint SHALL 总是生成脱敏 evidence 文件集，包括失败结果。

#### Scenario: 只读检查
- **WHEN** 开发者运行 check 模式
- **THEN** 命令校验 DSH/pnpm、bundle manifests 与外部插件路径
- **AND** 不构建、不写 profile、不启动 DSH

#### Scenario: integration run
- **WHEN** 执行 dev workflow integration entrypoint
- **THEN** `temp/integration-test-runs/<run-id>/` 包含 summary、command、stdout、stderr、env 与 artifacts
- **AND** evidence 不包含绝对 workspace path、凭据或 provider payload
