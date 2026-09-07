## ADDED Requirements

### Requirement: R0 SHALL 只提供生产基础
R0 SHALL 冻结共享 contract、配置、持久化、迁移、运行时、可观测性、工程入口与验证基础，不 SHALL 实现 Desktop、Asset、Team、WorkItem、Board 或 Studio 用户功能。

#### Scenario: 新业务 operation 尚未实现
- **Given** registry 已包含 WorkItem 或 Board capability descriptor
- **When** consumer 查询或调用未实现 operation
- **Then** 系统返回 `needs_contract` 或 `unavailable`
- **And** 不创建空业务对象、Task 或 synthetic success receipt

### Requirement: Contract SHALL 通过 registry 保持四 transport parity
所有注册 operation 与 capability SHALL 从同一 registry 投影 SDK、HTTP、gRPC 与 JSON-RPC，并共享字段、错误、version、idempotency、event 与 receipt 语义。

#### Scenario: 新 capability 注册
- **Given** Asset capability schema 已加入 registry
- **When** contract generation 与 conformance tests 运行
- **Then** 四 transport 均出现兼容定义
- **And** transport 层不新增 operation-specific 状态机或 handler 语义

### Requirement: 平台 SHALL 支持 local 与 managed profile
系统 SHALL 通过同一 GORM repository 支持 pure-Go SQLite local profile 与 PostgreSQL managed profile，并保持 Task/registry 的业务语义一致。

#### Scenario: Local build
- **Given** 使用 local profile
- **When** 执行正常 build/test
- **Then** `CGO_ENABLED=0` 路径成功
- **And** 默认 listener 为 loopback

#### Scenario: Managed config 缺失
- **Given** 使用 managed profile但缺少批准的 DB/TLS/auth 配置
- **When** 服务启动
- **Then** 进程在绑定 public listener 前 fail-fast
- **And** 错误不显示 secret value

### Requirement: Migration SHALL 可检查、恢复与阻止不兼容流量
Migration framework SHALL 记录 id、checksum、version range、reversible 状态、backfill cursor 与 receipt，并支持 expand/backfill/shadow/cutover/contract。

#### Scenario: Backfill 中断
- **Given** backfill 已提交部分 checkpoint
- **When** worker 被终止后恢复
- **Then** 系统从安全 checkpoint 继续
- **And** 不重复业务副作用或提前 cutover

#### Scenario: Schema 不兼容
- **Given** 当前 app version 不支持数据库 schema
- **When** readiness 检查
- **Then** `/readyz` 返回失败
- **And** 实例不接收业务流量

### Requirement: Backup SHALL 经过 restore verification
Managed release readiness SHALL 要求有效 backup metadata、checksum 与 disposable restore verification；不可逆 migration 前缺少有效证据时 SHALL 阻止执行。

#### Scenario: Backup 文件存在但无法恢复
- **Given** backup artifact 已创建但 restore checksum 或 schema verification 失败
- **When** release readiness 运行
- **Then** 返回 `backup_unverified`
- **And** migration/canary/production 晋级被阻止

### Requirement: Health 与 readiness SHALL 分离
`/healthz` SHALL 表示进程存活；`/readyz` SHALL 检查配置、DB、schema、registry 与 required workers，并返回安全 component summary。

#### Scenario: DB 不可用但进程存活
- **Given** workbenchd 进程正常但 DB ping 失败
- **When** 查询 health/readiness
- **Then** health 成功而 readiness 失败
- **And** 响应不泄露 DSN、credential 或私有路径

#### Scenario: 可选 Owner 离线
- **Given** 核心 DB/registry 正常而一个可选 Owner 离线
- **When** readiness 运行
- **Then** Workbench 可保持 ready
- **And** 对应 Owner capability 标记 offline/degraded

### Requirement: Shutdown SHALL 有界并安全 drain
服务 SHALL 在终止信号后先使 readiness false，再停止接收新流量，drain HTTP/gRPC/SSE 与 workers，flush bounded telemetry 并关闭 DB。

#### Scenario: SSE client 在 shutdown 时连接
- **Given** 一个 SSE stream 正在活动
- **When** 服务收到终止信号
- **Then** stream 在批准窗口内结束或收到安全关闭事件
- **And** 进程不会因无限等待超过 shutdown bound

### Requirement: Observability SHALL 可关联且脱敏
Logs、metrics、traces、diagnostics 与 evidence SHALL 使用 correlation ref 和共享 sanitizer，不得记录 token、Authorization、raw payload、正文、private path、完整思维链或高基数 PII label。

#### Scenario: Owner 返回含敏感错误
- **Given** downstream error 包含 URL userinfo、token、private path 与 raw body
- **When** error 被记录并返回 diagnostics
- **Then** 敏感值被移除或摘要化
- **And** correlation 与稳定 error code 保留

#### Scenario: Telemetry exporter 离线
- **Given** metrics/trace exporter 不可达
- **When** 正常 API 请求执行
- **Then** 核心请求继续处理
- **And** telemetry 使用 bounded drop/retry，不无限占用内存

#### Scenario: 读取受保护 metrics diagnostics
- **Given** 调用者已通过当前 deployment profile 的认证
- **When** 调用者读取 metrics diagnostics
- **Then** 服务返回版本化的 call、readiness、Task transition、DB query status/duration 与 pool 聚合
- **And** label 只包含固定 transport、operation、status class、readiness component/state、Task status 与 DB status
- **And** 未认证调用被拒绝
- **And** 响应不包含 Task id、operation type、workspace、project、tenant、user、resource、SQL、URL、query、error text、token、DSN 或 private path

#### Scenario: OTLP/HTTP receiver 接收 span
- **Given** 配置了无 credential 的 approved OTLP/HTTP endpoint
- **When** 一个 HTTP 或 gRPC call 完成且 batch flush 执行
- **Then** receiver 收到非空 OTLP protobuf payload
- **And** exporter error 或 timeout 不阻塞业务请求

### Requirement: 平台 SHALL 有安全资源限制
系统 SHALL 在进入业务、DB 或 Owner 路径前，对 request/response、body、batch、cursor、query、SSE connections、headers 与 timeout 使用统一且可配置的安全限制，并对 managed listener 强制批准 auth/origin/host policy。默认限制 SHALL 至少包括：`1 MiB` request body、`32 KiB` request headers、`8 KiB` query string、`32` JSON-RPC batch calls、`100` page size、每个进程 `32` 条认证后的 SSE streams，以及 `5 minutes` SSE lease。配置 MAY 收紧限制，但不得以 `0` 或负数关闭生产保护。

Local profile SHALL 只监听 loopback，使用 private local-session bearer token，并拒绝不匹配当前 listener 的 Host/Origin。由于 local-session 不使用 Cookie，CSRF 防护 SHALL 由 mandatory bearer header、exact Host/Origin validation、JSON-only mutation 与 no-CORS policy 共同提供。Managed profile 在 R1 approved issuer/session validator 可用前 SHALL 继续限制为 loopback；任何 public listener 配置 SHALL fail-fast，而不是回退到 local-session token。

所有进入 application middleware 的限制失败 SHALL 使用稳定、无敏感信息的 transport error：oversized body 返回 HTTP `413` / `request_too_large`，oversized headers 返回 HTTP `431` / `request_headers_too_large`，oversized URI/query 返回 HTTP `414` / `request_uri_too_long`，SSE capacity exhaustion 返回 HTTP `429` / `rate_limited` 并带 bounded `Retry-After`，非法 Host/Origin 返回 HTTP `403` / `forbidden`。HTTP parser 在 middleware 前拒绝的 malformed 或极端超大 header MAY 使用 Go server 原生 `400/431`，但仍不得记录或回显 header value。响应与日志不得包含 Authorization、token、Cookie、raw body、query value、Owner payload、DSN、private path 或内部错误文本。

#### Scenario: 超大 batch 或 cursor
- **Given** 请求超过批准 batch/cursor limit
- **When** API 校验输入
- **Then** 返回稳定 `invalid_argument` 或 `rate_limited`
- **And** 不进入 DB/Owner 执行路径

#### Scenario: 超大或分块 request body
- **Given** 一个认证请求的 `Content-Length` 超过 `1 MiB`，或 chunked body 在读取时越过该限制
- **When** HTTP/JSON-RPC transport 解码请求
- **Then** 返回 HTTP `413` 与稳定 `request_too_large`
- **And** 不解析、记录或回显 body
- **And** 不进入 application、DB 或 Owner 路径

#### Scenario: Host 或 Origin 被伪造
- **Given** local profile 收到非 loopback Host、带 userinfo/path/query/fragment 的 Origin、scheme 不匹配或 host/port 不完全匹配的 Origin
- **When** security middleware 校验请求
- **Then** 返回 HTTP `403` 与稳定 `forbidden`
- **And** 不消耗 SSE lease 或进入业务 handler

#### Scenario: SSE 并发耗尽
- **Given** 已有 `32` 条认证 SSE streams 持有 lease
- **When** 同一进程收到新的 SSE 请求
- **Then** 返回 HTTP `429`、稳定 `rate_limited` 与 bounded `Retry-After`
- **And** 已有 streams 不被驱逐
- **And** 请求取消、正常结束、timeout 或 shutdown 后 lease 必须释放

#### Scenario: SSE lease 到期
- **Given** 一条 SSE stream 已持续 `5 minutes`
- **When** stream lease 到期
- **Then** server cancel 该 stream context 并有界结束 response
- **And** client 可使用已有 cursor/`Last-Event-ID` 重连
- **And** server 不保留 goroutine、ticker 或 concurrency slot

#### Scenario: Managed public listener 缺少批准身份能力
- **Given** profile 为 `managed` 且配置了非 loopback HTTP 或 gRPC listener
- **And** R1 approved issuer/session validator 尚未配置
- **When** runtime 校验启动配置
- **Then** runtime fail-fast
- **And** 不创建 listener、不生成 local-session 公网回退、不打印 credential

### Requirement: Taskfile SHALL 提供稳定生产工作流
Taskfile SHALL 参数化 `SPEC_CHANGE`，提供 spec、dev、preview、build、分层测试、migration、backup/restore verify 与只读 release readiness 命令，并不得持久化 credential。

#### Scenario: 验证当前 R0 Spec
- **Given** 开发者在项目根运行 Taskfile
- **When** 执行 `task spec:validate SPEC_CHANGE=workbench-production-foundation-r0`
- **Then** 严格验证当前 change
- **And** 不再隐式验证旧 Open Design change

#### Scenario: Release readiness 默认运行
- **Given** 用户未授予 production write authority
- **When** 执行 `task release:readiness ENV=staging`
- **Then** 命令只读取和验证环境
- **And** 不部署、不迁移 production、不执行真实 Owner mutation

### Requirement: 测试证据 SHALL 由 runner 生成
Integration、system、security、performance 与 operations drill SHALL 由 evidence runner 生成六件套，保留原退出码并记录 contract digest、app/dependency versions 与 redaction status。

#### Scenario: 测试失败或被中断
- **Given** integration test 返回非零或收到终止信号
- **When** runner 收尾
- **Then** 原退出状态被保留
- **And** 已有 summary、command、stdout、stderr、env 与 artifacts 被安全写入
- **And** Agent 不手写或伪造通过的 summary
