## ADDED Requirements

### Requirement: Tags SHALL 存储为插件拥有的 Session sidecar
`@yeisme/dsh-session-tags-host` SHALL 使用公开 `ctx.storageDomain` 打开 `yeisme_session_tags_v1` domain，并按 SessionId 保存标签行。每行 SHALL 绑定当前持久化 Session 生命周期身份，MUST NOT 写入 `SessionEvent`、Workspace registry 或浏览器 localStorage。

#### Scenario: Host 重启后恢复标签
- **WHEN** 用户给会话设置标签并重启同一 DSH Host
- **THEN** 标签 SHALL 从 storage domain 恢复
- **AND** 按标签分组 SHALL 在 Client 重新连接后重建

#### Scenario: SessionId 被不同生命周期复用
- **WHEN** sidecar 行的 Session 创建身份与当前持久化 Session 不一致
- **THEN** Host SHALL 将该行视为 stale 并不向 Client 暴露
- **AND** MUST NOT 把旧标签附加到新会话

### Requirement: V1 标签 SHALL 使用最小字符串模型
V1 标签身份 SHALL 是经 trim 与 Unicode NFKC 规范化后的非空字符串，大小写保持区分。单个 Session SHALL 最多包含 12 个标签，每个标签 SHALL 不超过 64 UTF-8 bytes，且 MUST NOT 包含 NUL 或控制字符；同一 Session 内重复标签 SHALL 去重并保留首次顺序。

#### Scenario: 设置合法标签
- **WHEN** 用户提交 `工作`、`research` 和 `UI` 三个合法标签
- **THEN** Host SHALL 按规范化后的首次顺序持久化
- **AND** Client SHALL 显示相同标签文本

#### Scenario: 标签输入越界
- **WHEN** 请求包含空标签、控制字符、超过长度或超过数量上限
- **THEN** Host SHALL 返回 typed `tags-invalid` 失败
- **AND** 旧标签与版本 SHALL 保持不变

### Requirement: Host SHALL 暴露版本化 list/set Remote
Host SHALL 通过 Typert Remote 服务 `sessionTags` 暴露 `list` 与 `set`。`list` SHALL 返回 `specVersion: '1.0'` 和当前有效标签行；`set` SHALL 接收 `sessionId`、完整目标 tags 与 `ifVersion`，并返回权威提交行或 typed business failure。

#### Scenario: 首次设置标签
- **WHEN** 已存在 Session 的当前标签行不存在且 `ifVersion` 为 `null`
- **THEN** `set` SHALL 创建带 opaque version 和 `updatedAt` 的行
- **AND** 返回值 SHALL 与耐久化状态一致

#### Scenario: CAS 冲突
- **WHEN** `ifVersion` 不匹配当前行版本
- **THEN** Host SHALL 返回 `version-conflict` 与当前权威行
- **AND** MUST NOT 覆盖并发写入

#### Scenario: 无变化写入
- **WHEN** 规范化后的目标 tags 与当前行相同且版本匹配
- **THEN** Host SHALL 返回当前行
- **AND** MUST NOT 生成新版本或更新时间

#### Scenario: 清空全部标签
- **WHEN** `set` 提交空 tags 且版本匹配
- **THEN** Host SHALL 删除该 Session 的 sidecar 行
- **AND** 返回无标签的权威结果

### Requirement: Tags mutation SHALL 验证 canonical Session
每次 `set` 前 Host SHALL 通过公开 Session persistence surface 检查 Session 存在且生命周期身份仍匹配；Client 提供的 SessionId MUST NOT 被当作创建 sidecar 权限。

#### Scenario: 未知或已删除 Session
- **WHEN** `set` 指向不存在或已被删除的 Session
- **THEN** Host SHALL 返回 `session-not-found`
- **AND** storage domain SHALL 不新增记录

### Requirement: Client SHALL 提供稳定的 tags snapshot controller
`@yeisme/dsh-client-ui-session-tags` SHALL 使用 generation-aware snapshot store：首次挂载、`connection/reset`、窗口重新获得焦点和成功 mutation 后重新读取权威 `list`；卸载后 SHALL 忽略旧 Remote 应答。

#### Scenario: 连接重置期间旧应答返回
- **WHEN** 旧 generation 的 `list` 在 `connection/reset` 后完成
- **THEN** Client SHALL 丢弃该应答
- **AND** SHALL 以新连接的 snapshot 重建 provider

#### Scenario: CAS 冲突后的编辑器
- **WHEN** 保存返回 `version-conflict`
- **THEN** Client SHALL 刷新权威标签并显示冲突提示
- **AND** MUST NOT 静默覆盖另一写入

### Requirement: Tags provider SHALL 投影多对多分组
Client SHALL 注册 provider id `yeisme.session-tags`，以当前标签集合产生一个组/标签；同一会话有多个标签时 SHALL 在每个标签组中出现。无标签的所有可见会话 SHALL 进入本地化“未标记”组。

#### Scenario: 多标签会话
- **WHEN** 会话同时具有 `工作` 和 `研究` 标签
- **THEN** “工作”和“研究”组 SHALL 各显示该会话一次
- **AND** 任一条目打开的 SHALL 是同一 SessionId

#### Scenario: 未标记会话
- **WHEN** 可见会话没有任何有效标签
- **THEN** 它 SHALL 只出现在“未标记”组
- **AND** “未标记”组 SHALL 排在全部标签组之后

#### Scenario: 标签组排序
- **WHEN** snapshot 含多个标签
- **THEN** 标签组 SHALL 使用当前 UI locale 的稳定文本排序
- **AND** 空标签组 SHALL 不渲染

### Requirement: 用户 SHALL 能从原生 Session 行管理标签
Tags provider SHALL 贡献“管理标签”动作，并通过既有 `shell.overlay` 挂载可访问的编辑器。编辑器 SHALL 支持选择既有标签、输入新标签、移除标签、保存和取消；领域 mutation SHALL 只通过 `sessionTags.set` 执行。

#### Scenario: 保存标签选择
- **WHEN** 用户在编辑器中修改标签并保存
- **THEN** 编辑器 SHALL 发送完整目标 tags 与已观察版本
- **AND** 成功后分组、搜索词和当前会话的所有副本 SHALL 同步更新

#### Scenario: 取消编辑
- **WHEN** 用户选择取消或按 Escape
- **THEN** overlay SHALL 关闭并恢复焦点到动作触发器
- **AND** Host SHALL 不收到 mutation

### Requirement: 搜索 SHALL 匹配标签但不泄露 Host 数据
Tags provider SHALL 只把规范化标签文本作为 `searchTerms` 提供给 DSH；MUST NOT 暴露绝对路径、存储 backend、Session 原始事件、prompt 或 provider payload。

#### Scenario: 标签搜索
- **WHEN** 用户输入与标签匹配而与标题不匹配的查询
- **THEN** 对应会话 SHALL 出现在原生搜索结果
- **AND** 搜索结果 SHALL 不展示 sidecar 内部版本或存储身份

### Requirement: Tags SHALL 不影响 Agent 与 Session 语义
标签读取和写入 SHALL 是模型不可见 sidecar：MUST NOT 注入 prompt、触发 Agent、修改 Session `updatedAt`、改变 KV cache、恢复归档会话或创建 Workspace。

#### Scenario: 修改标签时会话空闲
- **WHEN** 用户新增、删除或替换标签
- **THEN** Agent 运行状态和 Session 日志 SHALL 保持不变
- **AND** 最近更新排序 MUST NOT 因标签 mutation 被提升

### Requirement: Bundle SHALL capability-probe 并可安全回滚
`@yeisme/dsh-session-tags` SHALL 只在分组 seam 可用时注册 Client provider；缺少 seam 时 SHALL 保持无 UI 的诚实降级。移除 bundle SHALL 恢复原生分组且保留 sidecar 数据，重装后 SHALL 可恢复。

#### Scenario: seam 不可用
- **WHEN** 运行时没有 `ctx.sessionGroupings`
- **THEN** “按标签”和“管理标签” SHALL 不出现
- **AND** MUST NOT 替换侧栏或使用 DOM fallback

#### Scenario: 卸载并重装插件
- **WHEN** 用户移除 bundle 后再次安装
- **THEN** DSH 在卸载期间 SHALL 使用原生分组
- **AND** 重装后先前标签 SHALL 从 sidecar 恢复
