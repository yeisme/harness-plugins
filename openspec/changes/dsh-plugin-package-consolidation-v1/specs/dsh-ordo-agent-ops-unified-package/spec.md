## ADDED Requirements

### Requirement: 单一 Ordo 安装 package

系统 SHALL 将 @yeisme/dsh-ordo-agent-ops 作为唯一的 Ordo Agent Ops DSH 安装 package。该 package SHALL 同时发布 Host bridge、/ordo command、./client browser export、dsh.bundle.patch 和 dsh.client metadata；生产安装不得要求用户显式安装三个旧 Ordo leaf package。

#### Scenario: 干净 web profile 安装统一 package

- **WHEN** 用户在干净 DSH web profile 中执行 dsh plugin --profile web add @yeisme/dsh-ordo-agent-ops
- **THEN** profile SHALL 仅因该命令增加 unified Ordo bundle，且其 Loader 可解析 Host bridge、/ordo 与 client sidebar

#### Scenario: 打包产物独立可解析

- **WHEN** 发布前检查 @yeisme/dsh-ordo-agent-ops 的 npm tarball
- **THEN** tarball SHALL 包含根入口、./client export、类型、patch 与所需构建产物，且不得以 workspace:^ 旧 leaf dependency 作为运行时前提

### Requirement: 单一 Ordo root row 与官方 DSH seam

@yeisme/dsh-ordo-agent-ops 的 cordis.patch.yml SHALL 仅插入一个名为 @yeisme/dsh-ordo-agent-ops 的 Ordo root row。若 bundle 需要 composition facts，它 SHALL 以单独命名、直接依赖的 @yeisme/dsh-agent-composition-preview row 消费，而不得插入旧 Ordo leaf row。Host 与 client SHALL 仅通过 Cordis、Remote、commands、dsh.client、受审查 slot 和后续 ToolView seam 组合。

#### Scenario: dump 的 Ordo patch 不包含旧 leaf

- **WHEN** DSH 解析 unified package 的 bundle patch
- **THEN** Ordo Agent Ops contribution SHALL 只出现一个 root row，可出现一个独立 composition preview row，且不得引用 dsh-host-ordo-agent-ops、dsh-host-ordo-commands 或 dsh-client-ui-ordo-agent-ops

#### Scenario: Web Shell 不被直接改写

- **WHEN** 审查 unified package 的 host、client、patch、测试与依赖
- **THEN** 它们 SHALL 不使用 data-dsh-frame、CSS class selector、gridTemplateColumns、直接 DOM append、MutationObserver shell hook 或 iframe bridge

### Requirement: 安全 projection 与运行面语义保持

Host bridge SHALL 继续在 Host 边界验证 context、schema、opaque ref、safe text、version、freshness 和 allowed action。/ordo SHALL 保持现有只读语义，sidebar SHALL 只展示 safe projection；任何 action、approval 或 receipt 的真实性 SHALL 由 Ordo owner 提供。

#### Scenario: 浏览器读取 ready projection

- **WHEN** owner 返回与绑定 context 精确一致的 ready 或 stale safe projection
- **THEN** unified bridge SHALL 只向 browser client 暴露允许的有界字段，且 sidebar 与 /ordo 使用同一 authoritative source

#### Scenario: 发生 contract drift 或 unsafe 字段

- **WHEN** owner payload context 漂移、schema 不匹配、包含 unsafe ref/text，或 owner source 不可用
- **THEN** unified bridge SHALL fail closed 为既有安全状态，且不得向 sidebar 或 /ordo 透传 facts、token、URL、host path、prompt 或 provider payload

### Requirement: Client lifecycle 与值班范围

统一 package 的 client SHALL 在 unload、HMR、runtime/context switch、断开和 late result 时对称清理并 reset。当前 delivery SHALL 只注册紧凑 sidebar 值班摘要；src/client/toolview.tsx 不得在缺少 server-authored action descriptor、approval binding 和 owner receipt 合同时注册 mutation UI。

#### Scenario: 新 generation 覆盖旧请求

- **WHEN** context 或 runtime generation 切换后旧 Remote 请求才返回
- **THEN** client SHALL 丢弃旧结果并从新 generation 的 authoritative snapshot 开始

#### Scenario: 复杂运营工作流

- **WHEN** 用户需要完整 DAG、跨 run 分析、证据比对或多租户运营
- **THEN** DSH sidebar SHALL 提供安全 Workbench navigation，而不得把该工作流实现为 DSH browser domain store
