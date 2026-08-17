## ADDED Requirements

### Requirement: DSH Pane Workbench SHALL be source-independent

Pane Workbench package、bundle、build output 与 runtime dependency graph MUST NOT import、link、vendor、patch 或 execute `dsh-better-sidebar` package、repository source、CSS、state schema 或 build artifact。实现 MAY 参考公开可观察行为和标准，但 SHALL 使用 Yeisme 自有类型、reducer、component、style 与 test fixture。

#### Scenario: 构建依赖扫描

- **WHEN** CI 检查 package manifests、lockfile、source imports、bundle chunks 与 copied path markers
- **THEN** 扫描 SHALL 找不到 `dsh-better-sidebar` runtime/build dependency 或 vendored source
- **AND** Pane Workbench SHALL 只依赖批准的 DSH 官方发布 surface 与现有项目依赖

### Requirement: View registration SHALL use local components and typed safe projections

`ctx.paneWorkbench.registerView` SHALL 只注册当前 client bundle 已加载的本地 component factory 与 versioned descriptor。Host/remote data MUST be limited to opaque refs、bounded summaries、versions、freshness、permissions、evidence refs 与 server-authored actions；MUST NOT 指定 component/module/script URL、generic fetch、credential、absolute path 或 arbitrary iframe bridge。

#### Scenario: Host projection contains a component URL

- **WHEN** Host 返回未注册 module URL 或任意 component name
- **THEN** client SHALL 拒绝该 projection 为 contract mismatch
- **AND** SHALL NOT 动态 import、eval 或创建 iframe

#### Scenario: Provider unloads while its Tab is open

- **WHEN** view registration disposer 在 HMR 或 plugin unload 中执行
- **THEN** 已打开实例 SHALL 进入 orphaned state，并显示来源插件、safe ref、重新启用与关闭入口
- **AND** 其他 provider 的 view 与 pane layout SHALL 保持可用

### Requirement: V1 SHALL use official additive DSH seams without replacing core surfaces

V1 client plugin SHALL 通过官方 `shell.overlay` list slot 渲染 Right/Bottom workbench host。它 MUST NOT 占用 `sidebar`、`conversation` 或 `details` single slot，MUST NOT 修改 DSH core，MUST NOT 通过私有 DOM selector、root margin 或全局 layout patch 模拟 push docking。

#### Scenario: Pane Workbench 与 Tool Details 同时启用

- **WHEN** DSH 当前 `details` occupant 显示 Tool Details，用户打开 Pane Workbench
- **THEN** Tool Details SHALL 继续由原 owner 渲染
- **AND** Pane Workbench SHALL 作为 additive overlay/drawer 出现

### Requirement: Plugin lifecycle SHALL be symmetric and HMR-safe

Client plugin unload、HMR、session teardown 或 bundle removal SHALL idempotently dispose view registrations、event listeners、ResizeObserver、rAF、timers、pending requests、focus traps、portal nodes、body attributes 与 temporary CSS variables。Host face 如存在 SHALL 同步终止 subscription 和 bounded cache。

#### Scenario: Client bundle hot reloads during Tab drag

- **WHEN** HMR 在 active drag session 中卸载旧 generation
- **THEN** 旧 generation SHALL 取消 drag、释放 pointer/global listeners 并清除 DOM flags
- **AND** 新 generation SHALL 从 normalized persisted snapshot 恢复，不接收旧 callback

### Requirement: Bundle installation and removal SHALL be reversible

Pane Workbench SHALL 通过 DSH plugin/profile bundle 安装，且 bundle SHALL 只挂载本仓库拥有的 package row。安装、检查和移除 SHALL 使用真实 DSH CLI；移除后原 DSH layout MUST 可用，无残留 layout reservation 或重复 mount。

#### Scenario: 用户移除 bundle

- **WHEN** 用户从 web profile 移除 Pane Workbench bundle 并重载 DSH Web
- **THEN** workbench toggle、overlay、client service 与 provider entries SHALL 全部消失
- **AND** sidebar、conversation、details 与 settings SHALL 恢复原组装行为

### Requirement: Real DSH profile composition SHALL verify the plugin contract

完成标准 MUST 包含真实 DSH Web profile 的安装/加载/卸载 smoke，以及 Right/Bottom、跨 region move、session switch、reload restore、narrow projection、keyboard path、view crash 与 HMR teardown 的浏览器测试。手工 mount 单个 React component MUST NOT 作为 profile 组装已验证的证据。

#### Scenario: 组件测试通过但 profile 未装载 client bundle

- **WHEN** isolated component tests 通过，而真实 profile loader 未发现 Pane Workbench client contribution
- **THEN** change SHALL 保持未完成
- **AND** 发布或 canary 任务 MUST 被阻止直到 profile test 通过
