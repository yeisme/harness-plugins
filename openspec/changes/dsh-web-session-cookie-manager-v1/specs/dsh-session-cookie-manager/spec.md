## ADDED Requirements
### Requirement: Profile 数据模型与 owner 边界
系统 SHALL 以 per-site/per-account 的 profile（显示名、站点 scope、账号标识摘要、capabilities、创建/更新时间）建模登录态，且 SHALL 把真实 cookie jar 的存储与执行保留在 DSH host 侧 owner；插件面 SHALL 只持有元数据与 owner 授权的投影。
#### Scenario: 插件侧持久化无凭据
- **WHEN** 用户创建或更新一个 profile 并触发插件持久化
- **THEN** 持久化内容只包含元数据字段，任何 cookie、token、bearer URL 或原始凭据值都不出现
#### Scenario: 无 owner 授权的字段不渲染
- **WHEN** owner 投影未包含某 profile 的某个能力字段
- **THEN** 客户端不猜测、不推断、不缓存该字段，并按缺失能力显示不可用状态
### Requirement: 凭据隔离红线
系统 MUST 视 cookie 为准凭据：renderer 的 props、state、DOM、日志与持久化 MUST NOT 出现 raw cookie/token 值；evidence 与测试快照 MUST 只包含 digest 或 redacted 投影；对凭据面的访问 MUST 默认拒绝（deny-by-default）。
#### Scenario: 切换操作的证据记录
- **WHEN** 用户执行 profile 切换并生成 evidence
- **THEN** evidence 只记录 profile ref、action 类型与结果状态的 digest/摘要，不包含任何 cookie 或 token 值
#### Scenario: 日志泄漏扫描
- **WHEN** 安全审查扫描 renderer 日志与持久化输出
- **THEN** 扫描结果为零命中，或命中项被判定为 redacted/digest 格式
### Requirement: 同站多账号与原子切换
系统 SHALL 支持同一站点的多个独立 profile 并存，且 SHALL 把"应用新 profile jar + 清除旧 profile cookie"定义为单一 owner 事务；切换 MUST NOT 让进行中的页面上下文读取到非当前 profile 的 cookie。
#### Scenario: 双账号同站隔离
- **WHEN** 同一站点存在两个已配置 profile 且当前激活 profile A
- **THEN** 站点上下文只能读到 profile A 的登录态材料，profile B 的 cookie 不可见
#### Scenario: 切换中途失败
- **WHEN** 切换事务中清除或应用任一步失败
- **THEN** 系统回滚到切换前状态并明确报错，不得出现两个 profile 部分混合的登录态
### Requirement: 配额与用量只读面板
系统 SHALL 只消费 owner 提供的 typed 配额/用量投影与 freshness 标记，SHALL NOT 抓取站点、推断配额或缓存带凭据的响应。
#### Scenario: 无配额数据源
- **WHEN** 某 profile 的 owner 未提供配额投影
- **THEN** 面板显示明确的不可用状态与原因，不显示占位假数据
### Requirement: 无 seam 时的诚实降级
在 host cookie seam 未就绪时，系统 MUST 保持 profile 管理、账号组合面板与配额骨架可用，MUST 对真实 jar 应用/切换/清除显示明确 unavailable 原因，且 MUST NOT 用本地伪造或猜测实现替代。探测到 `WebCookieJarsV1` 后，系统 MUST 只提交 profile ref 并走单一 host 事务。
#### Scenario: Phase 1 尝试切换
- **WHEN** 用户在无 seam 环境点击"应用登录态"
- **THEN** 界面显示该能力等待 host seam 的明确说明与引导，不执行任何本地写操作
#### Scenario: 探测到 fork seam 后原子切换
- **WHEN** host 暴露 `WebCookieJarsV1` 且用户从 profile A 切换到同站 profile B
- **THEN** 插件只调用一次 host `switchJar`
- **AND** 不安全 profile ref 不得进入 host
