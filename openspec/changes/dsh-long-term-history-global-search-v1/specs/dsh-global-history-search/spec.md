## ADDED Requirements

### Requirement: 全局历史范围可控
系统 SHALL 在当前 DSH profile/identity 内搜索所有授权 Session，并 SHALL 支持 all、workspace 与 session scope、archived inclusion、match kind 与时间范围过滤。

#### Scenario: 跨工作区搜索
- **WHEN** 用户以 `scope=all` 搜索一个出现在不同 workspace Session 中的短语
- **THEN** 系统返回所有授权 workspace 的稳定排序结果，并为每条结果标识 workspace ref/display metadata

#### Scenario: 未授权 Session
- **WHEN** index 中存在当前 principal 不可见的 Session 文档
- **THEN** 搜索 API 不返回该 Session、snippet、计数或可推断其存在的 facet

### Requirement: 搜索字段和历史表面明确
系统 SHALL 默认搜索 title、labels、workspace display metadata、current 与 shadowed 的 human user/assistant final messages；系统 MUST 默认排除 reasoning、stream chunks、request headers、hidden prompts、provider payloads、credentials 与 private tool arguments。

#### Scenario: 查找被 compaction 替换的消息
- **WHEN** query 只匹配一个 shadowed user/assistant event
- **THEN** 全局历史返回该命中并标记 `surface=shadowed`，客户端显示它属于历史上下文

#### Scenario: 敏感结构不进入索引
- **WHEN** SessionEvent 含 reasoning、Authorization、raw provider response 或 private tool arguments
- **THEN** 默认 search document projection 不产生可由这些内容命中的文档或 snippet

### Requirement: 搜索结果可恢复并深链
系统 SHALL 为每个结果返回安全 Session summary、best match、snippet、highlight ranges 与 opaque anchor；客户端 SHALL 能恢复 cold/archived Session 并定位到授权的 event/message。

#### Scenario: 从结果打开精确消息
- **WHEN** 用户选择带 event/message anchor 的结果
- **THEN** 客户端打开或恢复 Session、加载覆盖该 anchor 的 history page，并在不改写日志的情况下定位/高亮命中

#### Scenario: anchor 已被新 generation 判定无效
- **WHEN** 结果 anchor 对当前授权 revision 或 Session log 已不再有效
- **THEN** open action 返回 typed stale/not-found，客户端回到 Session 顶部或请求新搜索，不伪造成功定位

### Requirement: 分页和排序稳定
系统 SHALL 使用 opaque cursor 分页，cursor MUST 绑定 normalized request、authorization revision、index generation 与 service instance；排序 SHALL 优先 exact title/label，再按 field weight、match quality、recency 和稳定 tie-break。

#### Scenario: 加载下一页
- **WHEN** 用户使用同一 query/filter 和有效 cursor 请求下一页
- **THEN** 系统不重复前页结果，并返回确定性的后续结果或 final page

#### Scenario: generation 变化
- **WHEN** index generation、provider registry digest 或 authorization revision 在分页间变化
- **THEN** 旧 cursor 以 `HISTORY_CURSOR_STALE` 拒绝，客户端从第一页重新搜索

### Requirement: 中文和代码标识符可找回
系统 SHALL 支持拉丁 word/phrase、至少 2 个 CJK 字符的正文 substring-style match，以及 camelCase、snake_case、路径片段和常见代码标识符 token match。

#### Scenario: 中文正文搜索
- **WHEN** 用户输入两个或更多 CJK 字符且该序列出现在授权 message document 中
- **THEN** 系统返回包含匹配 highlight 的结果，不要求空格分词

#### Scenario: 单字符正文查询
- **WHEN** 用户只输入一个 CJK 字符且没有 metadata exact/prefix match
- **THEN** 系统不执行无界正文扫描，并返回 refine-query 提示或空结果

#### Scenario: 代码标识符搜索
- **WHEN** query 是 `sessionSearch`、`session_search` 或路径 segment 的可识别部分
- **THEN** 系统通过规范化 identifier tokens 返回相关命中，并保持原文 snippet

### Requirement: 索引状态和取消可见
系统 SHALL 在搜索与 rebuild 中暴露 ready、building、partial、disabled、reconcile-required 和 failed 状态；查询、分页和 rebuild SHALL 支持取消并保持已启动工作有界收敛。

#### Scenario: 首次搜索触发 rebuild
- **WHEN** durable index 尚未建立且用户发起第一次内容搜索
- **THEN** 客户端立即进入 building/searching 状态，用户可取消，composer 和现有 transcript 仍可使用

#### Scenario: provider 失败
- **WHEN** 某个 search document provider 或 persistence inspection 失败
- **THEN** 未完成 generation 不提交，search 返回 partial/failed 与可重试 evidence，不混合旧新 provider 语义

### Requirement: 搜索规模具有发布门
系统 SHALL 为 10,000 Session 与 1,000,000 searchable document 定义可复现基准，warm first page p95 SHALL 不高于 250 ms，且 unchanged restart SHALL 不全量读取所有日志。

#### Scenario: 性能基准
- **WHEN** 在固定硬件/fixture 上运行规定的 warm-query benchmark
- **THEN** 报告 query latency、index size、reconcile work 和 event-loop impact，并仅在门槛通过后声明该规模 ready
