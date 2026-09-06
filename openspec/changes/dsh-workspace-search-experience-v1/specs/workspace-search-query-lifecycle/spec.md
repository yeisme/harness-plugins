## ADDED Requirements

### Requirement: 分组异步生命周期与取消
查询协调器 SHALL 即时返回本地结果、按来源异步加载历史，支持取消和请求 generation 校验。

#### Scenario: 连续输入与乱序响应
- **WHEN** 用户从查询 A 切换到 B，A 的响应晚于 B 返回
- **THEN** A 不得更新 B 的结果、计数、分页 cursor 或错误状态
- **AND** 中文输入法组合期间不发送中间态远程查询

#### Scenario: 一个来源变慢或失败
- **WHEN** 历史来源等待、超时或返回错误
- **THEN** 已完成的其他分组仍可使用，失败只在所属分组表达并可独立重试
- **AND** 短暂加载不使已有列表清空或闪烁

### Requirement: 有界缓存与权限隔离
搜索 SHALL 使用有限内存缓存并按 profile、项目范围、查询、筛选、locale、cursor 和 owner／权限版本隔离；不得持久化结果正文。

#### Scenario: 缓存后台更新
- **WHEN** 查询命中仍允许呈现的缓存
- **THEN** 先显示结果和更新状态，并在后台验证新数据
- **AND** 在 30 秒 fresh、5 分钟可显示旧数据、32 页／1000 条摘要的初始预算内淘汰

#### Scenario: 权限或上下文变化
- **WHEN** provider 返回 permission_denied 或 profile／权限 generation 改变
- **THEN** 清理受影响缓存和选择，旧片段不可继续显示
- **AND** 无可验证权限 generation 的 provider 不得跨搜索打开周期复用远程结果

### Requirement: 分页和选择连续性
查询 SHALL 按完整请求绑定 opaque cursor，去重追加并维持选中项身份。

#### Scenario: 新结果刷新
- **WHEN** 后台追加或替换结果且当前选中实体仍存在
- **THEN** 键盘选择保持该 stableKey，而非保持可能指向另一实体的数组下标

#### Scenario: 修改筛选后加载更多
- **WHEN** 旧分页响应在筛选已变化后返回
- **THEN** 响应被丢弃，新筛选从独立第一页开始
