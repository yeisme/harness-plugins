## ADDED Requirements

### Requirement: Owner 发现与能力状态

系统 MUST 通过统一 OwnerService 返回已配置 owner、合同版本、健康、readiness 和 capability，且 UI 动作可用性 MUST 只由 capability 决定。

#### Scenario: Auctra adapter 尚未晋级

- **Given** Auctra Operation Catalog 存在但生产 network adapter 未通过 owner release gate
- **When** Workbench 获取 Auctra capabilities
- **Then** 读取或 mutation capability 返回 `needs_contract`
- **And** UI 不创建 Task、不写入本地成功状态
- **And** Diagnostics 返回不含私有路径或 token 的 owner handoff 说明

#### Scenario: Owner 离线但 Workbench 可用

- **Given** 一个已配置 owner 当前不可达
- **When** 用户打开 Workbench
- **Then** Owner capability 返回 `offline`
- **And** Workbench Task 控制面和其他 owner 模块继续可用
- **And** 缓存数据明确标记 stale，不显示为 current

#### Scenario: Discovery digest 与批准 SDK 不一致

- **Given** Provider discovery 返回的 contract/schema digest 或 SDK version 不在 Workbench批准范围
- **When** connector 执行 handshake
- **Then** 对应 capability MUST 返回 `contract_mismatch` 并禁止 read/mutation/event consumer启动
- **And** Workbench MUST NOT 根据 endpoint存在、HTTP 200 或旧缓存推断 capability `available`

### Requirement: 浏览器同源与凭据隔离

浏览器 MUST 只通过 Bun BFF 调用 Workbench API，不得直接连接 owner 或获得 owner/session token。

#### Scenario: 浏览器提交伪造 Authorization

- **Given** 浏览器请求携带自定义 `Authorization` 或 owner URL
- **When** BFF 代理请求
- **Then** BFF 丢弃浏览器 Authorization 和动态目标参数
- **And** 仅从服务端 token source 注入允许的凭据
- **And** token 不出现在响应、日志、构建产物或测试 evidence

### Requirement: 安全 typed projection

系统 MUST 只返回经过 allow-list sanitizer 和注册 JSON Schema 校验的 owner typed projection，不得转发 raw owner payload。

#### Scenario: Owner 返回未知必填 schema

- **Given** owner 响应的 contract version 或 required projection 字段不兼容
- **When** connector 校验响应
- **Then** capability 或请求返回 `contract_mismatch`
- **And** raw payload 不进入浏览器、日志、数据库、事件或 evidence

#### Scenario: 显式读取安全资源

- **Given** 用户打开一个 opaque resource ref
- **When** Workbench connector 解析并读取 owner projection
- **Then** connector 只返回安全字段、公开 resource URI、版本、digest 与 typed projection
- **And** 不返回本机路径、credential、raw prompt、provider payload、完整正文或完整思维链

### Requirement: Opaque project 与 resource ref

WorkBench API MUST 使用绑定 owner identity 的 opaque ref，并拒绝浏览器提交路径、任意 owner URL 或未经注册的 owner ref。

#### Scenario: 恶意路径作为 resource ref

- **Given** 请求包含 `../`、绝对路径、URL userinfo 或未注册 scheme
- **When** Workbench 解析 project/resource ref
- **Then** 请求在连接 owner 前被拒绝
- **And** 错误响应不泄露 owner base URL 或文件系统结构

### Requirement: 真实 P0 owner 投影

系统 MUST 为 Scaena、Eikona、Pinax 和 Sonora 提供基于其公开合同的真实只读投影，并保留 owner、contract、version 和 freshness。

#### Scenario: 查看 Eikona 运行资产

- **Given** Eikona `/api/v1` handshake 与 schema 兼容
- **When** 用户打开一个 Eikona run
- **Then** Workbench 展示 run、event、asset、lineage 和 assessment 的安全投影
- **And** 资产使用 opaque ref 或公开 `eikona://` URI，不显示 artifact path

#### Scenario: 查看 Scaena 项目

- **Given** Scaena session 允许访问项目
- **When** 用户打开 Production workspace
- **Then** Workbench 从 Scaena facade 展示 scene、shot、run、output、review 和 delivery
- **And** 浏览器不直连 Ordo、Auctra、Eikona 或 Sonora 拼装 production state

#### Scenario: 查看 Pinax note card

- **Given** Pinax API 以 read-only mode 启动
- **When** 用户打开 note card
- **Then** Workbench 只显示 capability 允许的 card projection
- **And** write 动作保持 disabled 或需要 owner `allow-write` 与 approval gate

#### Scenario: 查看 Sonora 策略比较

- **Given** Sonora API 可用
- **When** 用户比较 audio strategies
- **Then** Workbench 展示 provider-neutral model、strategy、estimate 和 rights/review 状态
- **And** 不触发真实 render 或 voice clone

### Requirement: Mutation 统一进入 Task 控制面

所有 owner mutation MUST 由 Operation registry 注册并进入 TaskService，不得由 Panel 或 SDK 直接调用 owner mutation endpoint。

#### Scenario: mutation gate 通过

- **Given** capability 可用且 permission、cost、schema、expected version 和 idempotency gate 通过
- **When** 用户确认动作
- **Then** Workbench 创建 Task 并由 connector 调用 owner
- **And** Task 保存 safe receipt ref、owner version 和事件摘要，不保存 owner payload

#### Scenario: 接受结果未知

- **Given** mutation 已发送但 owner 响应超时
- **When** connector 无法确认是否接受
- **Then** Task 进入 `unknown_accept`
- **And** 系统使用原 idempotency key、receipt ref 或 owner status lookup 对账
- **And** 系统不得自动重新提交 mutation

#### Scenario: Mutation response丢失且没有 receipt ref

- **Given** Provider可能已接收 mutation，但 Workbench未收到 response/receipt ref
- **When** Task进入 `unknown_accept`
- **Then** connector MUST 使用原 operation/project/idempotency key 执行 provider receipt lookup
- **And** lookup/reconcile MUST 只读取 canonical operation truth，不得创建新 idempotency key或重放 mutation

#### Scenario: Cancel request尚未确认

- **Given** Workbench已发送 cancel command但Provider尚未确认停止
- **When** 用户查看Task或Delivery
- **Then** 状态 MUST 保持 `cancel_requested` 并继续查询receipt/status
- **And** 只有Provider返回不会继续产生副作用的cancel acknowledgement后才能标记 `cancelled`

#### Scenario: Partial operation包含 unknown child

- **Given** parent receipt包含 succeeded、failed和unknown children
- **When** Workbench执行repair/retry
- **Then** succeeded child MUST 保留，failed/not-dispatched child MAY按原policy重试
- **And** unknown child MUST 先receipt/status/reconcile，MUST NOT自动重复执行

#### Scenario: Scaena production mutation

- **Given** 用户在 Workbench 操作短剧生产项目
- **When** 动作需要多个领域 owner 协作
- **Then** Workbench 只提交 Scaena facade operation
- **And** 跨 Auctra、Ordo、Eikona、Sonora 的编排由 Scaena owner 完成

### Requirement: Owner event 可恢复观察

系统 MUST 以 SSE 投影公开 owner 安全事件，并分别维护 owner cursor 与 Workbench task sequence。

#### Scenario: SSE 断线重连

- **Given** 用户正在观察一个 Eikona run 或 Scaena project
- **When** SSE 连接中断并恢复
- **Then** Workbench 使用最后确认的 owner cursor 重连
- **And** UI 标识事件来源、owner sequence 与 freshness
- **And** 不宣称跨 owner 事件具有全局 exactly-once 顺序

#### Scenario: Owner cursor超出retention

- **Given** resume cursor早于Provider retention floor或存在不可证明gap
- **When** connector恢复Owner event stream
- **Then** Provider/SDK MUST 返回typed `resync_required`与snapshot/relist hint
- **And** Workbench MUST 按snapshot fence重建该source projection，不得返回空成功、猜测缺失事件或清空其他owner状态

### Requirement: 多 Pane owner 上下文可恢复

Dockview layout MUST 只持久化 owner ID、opaque ref、projection type 和 Panel 参数，并在 capability 变化后安全恢复。

#### Scenario: 恢复已离线 owner 的 Inspector

- **Given** 保存的布局包含一个当前离线 owner resource
- **When** 用户恢复布局
- **Then** Panel 保留位置并显示 offline Diagnostics
- **And** 不从 localStorage 恢复 token、正文、raw payload 或私有 URI

### Requirement: Owner 合同演进

新增或变化的 owner 合同 MUST additive 演进，并通过 handshake、schema range、transport parity 与 owner-side OpenSpec 交付。

#### Scenario: Owner 发布兼容 optional 字段

- **Given** owner 在兼容 contract version 中新增 optional 字段
- **When** 旧 Workbench connector 收到响应
- **Then** 已知字段继续可用
- **And** 未知 optional 字段被安全忽略

#### Scenario: Owner 需要 breaking contract

- **Given** owner 计划删除、重命名或重解释稳定字段
- **When** 该变更进入实施
- **Then** owner OpenSpec 包含迁移、deprecation、compatibility 和 rollback
- **And** Workbench 在支持新合同前保持旧版本或返回 `contract_mismatch`

### Requirement: 集成证据与安全门禁

每个 P0 connector MUST 具备 contract、integration、security 和 browser evidence，并写入脱敏的 per-run evidence 目录。

#### Scenario: Connector integration run

- **Given** 使用 fixture 或显式本机 owner 服务运行 connector integration test
- **When** 测试完成或失败
- **Then** `temp/integration-test-runs/<run-id>/` 包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`
- **And** evidence 不包含 token、Authorization、raw prompt、provider payload、私有路径或完整思维链
