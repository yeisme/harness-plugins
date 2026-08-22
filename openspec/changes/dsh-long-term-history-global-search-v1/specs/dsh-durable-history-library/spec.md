## ADDED Requirements

### Requirement: 会话日志长期保留
系统 SHALL 将已物化 Session 的 append-only 日志视为长期历史 canonical state，并且 SHALL NOT 因进程重启、客户端退出、归档、索引重建或 context compaction 自动删除日志。

#### Scenario: 重启后恢复历史
- **WHEN** 一个已完成或中断修复后的 Session 已持久化且 DSH 进程重启
- **THEN** 用户仍可列出、读取、搜索并恢复该 Session，且事件顺序与 source revision 保持有效

#### Scenario: compaction 后保留原始讨论
- **WHEN** Session 发生 context compaction 并产生 shadowed 历史事件
- **THEN** canonical log 仍保留原始事件，全局历史搜索可以将其作为带 `shadowed` 标记的命中返回

### Requirement: 归档不得等同删除
系统 MUST 将 archive/unarchive 视为可见性与组织状态，MUST 委托现有 archive owner，并且 MUST NOT 从 SessionPersistence 删除原始日志。

#### Scenario: 搜索归档会话
- **WHEN** 用户在全局历史搜索中启用 archived 范围
- **THEN** 已归档且仍被当前 principal 授权的 Session 可以返回，并带明确 archived 标记

#### Scenario: 恢复归档会话
- **WHEN** 用户从历史结果对一个 archived Session 执行 unarchive 或 resume
- **THEN** owner 返回 receipt 后客户端才显示成功，原始日志不发生复制或迁移

### Requirement: 索引为可重建派生数据
系统 SHALL 将全文索引与 SessionPersistence 分离，SHALL 绑定 source revision、registry digest 与 index generation，并且 SHALL 能从 canonical logs 重建索引而不修改原始日志。

#### Scenario: 索引损坏
- **WHEN** 搜索索引 schema、identity 或内容被识别为损坏或不兼容
- **THEN** Session resume/export 继续可用，history search 返回 typed unavailable/reconcile 状态，并可启动受控 rebuild

#### Scenario: unchanged restart
- **WHEN** DSH 使用同一个 persistence store 与 index store 重启且 Session revisions、schema 和 registry digest 均未变化
- **THEN** 索引 SHALL 复用现有 generation，并且 SHALL NOT 全量 inspect 全部 Session logs

### Requirement: 长期历史具有可观察健康状态
系统 SHALL 提供 history health/doctor 能力，报告 storage provider、index mode、generation、coverage、last reconcile 与 redacted failure，不得输出会话正文、凭据或绝对路径给未授权客户端。

#### Scenario: 搜索被禁用
- **WHEN** deployment 配置为 metadata-only 或 full-text disabled
- **THEN** health 明确报告模式，精确读取与 Session 恢复保持可用，搜索入口显示可操作的启用或诊断提示

#### Scenario: source coverage 不完整
- **WHEN** 某些持久 Session 因 corruption、unsupported event 或取消而未进入当前 generation
- **THEN** health 报告 partial coverage 与数量，search 结果不得宣称完整

### Requirement: 兼容与回滚不触碰原始历史
系统 MUST 以 additive 方式引入新事件、RPC、CLI、配置与插件贡献；回滚 SHALL 能关闭新搜索面而保持现有 `session.search`、Session logs 与 archive state 可用。

#### Scenario: 降级到不识别标签事件的 build
- **WHEN** Session log 包含新 `session/labels` 事件并由旧 build 加载
- **THEN** 该事件因 `ignorable: true` 可被保留和跳过，旧 build 不得因此拒绝整个 Session

#### Scenario: 关闭新插件
- **WHEN** Web/TUI history plugin 被卸载或 full-text `openAt` 恢复为 `never`
- **THEN** 旧侧栏搜索和会话恢复合同保持原义，派生索引不成为启动依赖
