# dsh-session-insights-query Specification

## Purpose
TBD - created by archiving change dsh-session-insights-and-status. Update Purpose after archive.
## Requirements
### Requirement: 明确范围且授权的会话查询

Host SHALL 在既有统计服务上增量提供可选 query 能力，要求 sessionRef，默认 scope=session；run/range 参数 MUST 显式校验且不得扩大访问范围。

#### Scenario: 历史会话无需新请求

- **WHEN** 可访问的历史 session 有官方完整数据但当前进程未运行模型
- **THEN** 返回整段会话统计，不要求发送新消息激活账本。

#### Scenario: 不可访问会话

- **WHEN** sessionRef 无访问权限或已不可用
- **THEN** 返回受限安全原因，不泄露另一会话数据。

### Requirement: 完整性与零值

新投影 SHALL 分离 coverage complete/partial/unknown 与 freshness；未知数值 MUST NOT 填零，分页或摘要截断 MUST 可见。

#### Scenario: 一部分请求未报告用量

- **WHEN** 已知 10 个请求中只有 8 个有权威 usage
- **THEN** 返回 partial、已知数值和 2 个缺失请求；若总请求数也未知则不能伪造分母。

#### Scenario: 已知没有请求

- **WHEN** owner 已确认查询范围完整且没有请求
- **THEN** 可显示零和无请求空态。

### Requirement: 幂等请求聚合和桶归一化

Host SHALL 使用权威 request/attempt 身份归一化流式与最终 usage，明确互斥桶；MUST 区分实际重试与重复通知。

#### Scenario: 流式最终重复

- **WHEN** 同一 attempt 先收到 usage chunks 后收到最终累计并重放事件
- **THEN** 最终值只计一次；不同 retry attempt 的已报告消费分别保留。

#### Scenario: 等总数桶修正

- **WHEN** 缓存输入重分类而总 Token 未变
- **THEN** 各桶更新并提升 revision，不以总差值为零跳过。

#### Scenario: 桶语义未知

- **WHEN** provider input 是否包含缓存无法确认
- **THEN** 返回 partial 或未知，不能重复相加或自行猜测。

### Requirement: 历史消费与上下文独立

完整消费 SHALL 保留已发生请求的用量，context SHALL 只来自官方当前上下文来源；MUST NOT 用消费量推导 context remaining。

#### Scenario: 压缩和重启

- **WHEN** 会话发生 compact 并重新启动 Host
- **THEN** 既有消费不被上下文缩减清除，也不因历史加载再次计入。

#### Scenario: 仅有上下文投影

- **WHEN** 只有可见上下文聚合而无历史请求 seam
- **THEN** 上下文可展示，完整消费标记缺少来源。

### Requirement: 事件时间和并行耗时

range/today/week SHALL 按请求实际发生时间及明确时区处理，区间为 [from,to)；墙钟耗时与请求耗时总和 MUST 分开。

#### Scenario: 重启读取旧记录

- **WHEN** 今天首次读取昨天发生的请求
- **THEN** 不把昨天消费归到今天；无时间戳者标记范围归属未知。

#### Scenario: 并行请求

- **WHEN** 两个请求同时运行 5 秒
- **THEN** 不得把 10 秒请求耗时总和展示为 10 秒墙钟运行时间。

### Requirement: 分叉和子 Agent 归属

统计 SHALL 区分直接消费、继承历史及子 Agent 消费；合并 SHALL 要求 owner 关系和跨来源请求去重身份。

#### Scenario: 分叉继承历史

- **WHEN** 子会话继承父会话已有消息
- **THEN** 不把继承请求计为子会话新消费；可单独展示继承部分。

#### Scenario: 父汇总已含子消费

- **WHEN** 子 Agent 的请求同时出现在父汇总与子记录
- **THEN** 合并只计一次；归属不可证实时禁用合并并说明原因。

### Requirement: 有界分页与修订一致性

明细 SHALL 默认 50 行、最大 200 行；cursor SHALL 绑定目标、筛选与 revision；全部范围 totals MUST NOT 由当前页代替。

#### Scenario: 长会话分页

- **WHEN** 查询 10,000 条请求并读取下一页
- **THEN** 每次 wire 不超过 200 行，聚合仍覆盖已验证的整个范围且不阻塞 UI。

#### Scenario: 游标失效

- **WHEN** 下一页读取前聚合 revision 已改变
- **THEN** 返回 stale_cursor，保留已显示内容并要求从第一页重读。

### Requirement: 独立费用余额和凭据

费用 SHALL 标记实际结算、可追溯估算或未知；余额 SHALL 绑定独立账户且使用宿主凭据解析。MUST NOT 自动查询余额或向浏览器传凭据。

#### Scenario: 无价格或账户能力

- **WHEN** Token 可用但价格来源或余额接口不支持
- **THEN** Token 正常显示；费用未知、余额说明原因，不能伪造金额。

#### Scenario: 余额刷新失败

- **WHEN** 用户显式刷新账户余额且请求失败
- **THEN** 保留最近金额并标 stale/错误，不清掉会话用量，不吞掉失败。

### Requirement: 旧接口与安全投影兼容

旧 snapshot()/refreshBalance()、schema 与进程窗口语义 SHALL 保持；新 query 使用独立 schema 和 typed probe。Wire、日志、缓存与证据 MUST 排除正文、密钥、原始 payload、私有参数和绝对路径。

#### Scenario: 新客户端连接旧 Host

- **WHEN** query 能力缺失但旧 snapshot 可用
- **THEN** 显示明确标注的旧进程观察统计，不把它称为整个会话；旧客户端仍可消费原接口。

#### Scenario: 恶意字段与持久化

- **WHEN** owner 返回 credential-shaped 字段或客户端刷新布局
- **THEN** 非法字段被拒绝/丢弃；布局只保存引用和偏好，不复制统计账本及正文。

