## ADDED Requirements

### Requirement: 市场投影必须通过独立能力协商接入
Host MUST 探测 Radar market capability/schema/lane 并校验 refs、revision、coverage、policy 与 actions；MUST NOT 将旧个人机会字段改义。缺新能力时保留旧入口，按现有能力说明提供 disabled reason。

#### Scenario: 只有旧 Radar
- **WHEN** owner 没有市场 capability
- **THEN** 市场 face 不展示伪数据或可点击死动作，旧个人 Radar 继续可用

### Requirement: 消费者必须只保存可丢弃 UI 状态
DSH SHALL 只持有布局、选择、筛选和草稿；已读、关注、市场信号及证据 MUST 从 Radar 获取，不访问其 SQLite、配置或审计文件。

#### Scenario: Pane 重载
- **WHEN** 用户关闭后重新打开市场 Pane
- **THEN** 领域状态权威重读，不靠本地缓存重建第二账本，也不自动标记已读

### Requirement: 显式动作必须使用权威回执恢复
提交 MUST 包含幂等键、payload digest 和 reader revision；pending 不伪装成功，unknown 必须按原键对账，冲突重读，reader lane 不自动提权。

#### Scenario: 双击后断线
- **WHEN** 用户双击关注且回执丢失
- **THEN** 仅有一个逻辑动作，重连查询原键回执，不能新建重复关注或触发采集

### Requirement: 无本机 CLI 与权限改变必须诚实处理
已连接 MCP 的客户端 SHALL 使用 discovery/resources/inputSchema/receipts；需要 owner 配置时明确 host。policy 不匹配的旧正文 MUST NOT 继续显示。

#### Scenario: Reader policy 更新
- **WHEN** 旧异步结果在禁区修改后返回
- **THEN** 丢弃旧响应并安全重读，不让历史缓存绕过新禁区

#### Scenario: 客户端未安装 Radar
- **WHEN** MCP 已连接但本机无 radar 二进制
- **THEN** 正常市场读取不依赖本机 shell；需要配置时说明 owner 侧动作，不能虚构本机执行成功
