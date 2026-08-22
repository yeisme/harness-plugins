## ADDED Requirements
### Requirement: 插件面 profile 管理
插件 SHALL 提供 per-site/per-account profile 的创建、列出、重命名与删除，且插件侧持久化 SHALL 只包含 ProfileMetaV1 元数据，MUST NOT 存储任何 cookie/token/bearer 值。
#### Scenario: 持久化无凭据
- **WHEN** profile CRUD 操作触发持久化
- **THEN** 存储内容通过 schema 校验且不含凭据类字段
### Requirement: 诚实降级
在 host cookie seam 未就绪时，插件 MUST 对真实 jar 应用/切换显示明确 unavailable 状态与原因，MUST NOT 提供本地伪造实现。
#### Scenario: 无 seam 点击应用
- **WHEN** 用户在 Phase 1 点击"应用登录态"
- **THEN** 界面显示等待 host seam 的说明，不执行任何本地写操作
### Requirement: 配额只读投影
配额面板 SHALL 只渲染 owner 提供的 typed 投影字段与 freshness，SHALL NOT 抓取或推断配额。
#### Scenario: 无配额源
- **WHEN** owner 未提供某 profile 配额投影
- **THEN** 面板显示不可用状态而非占位数据
