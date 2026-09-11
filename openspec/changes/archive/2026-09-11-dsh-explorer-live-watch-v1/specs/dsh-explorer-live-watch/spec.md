## ADDED Requirements

### Requirement: Owner SHALL 以引用计数 watcher 交付真实 FileWatchCapabilityV1
`/yeisme-files/api` owner SHALL 按 workspace realpath 维护引用计数的文件 watcher：首个订阅者出现才启动、末位订阅者离开即关闭。事件 SHALL 映射为 `FileWatchEventV1`（cursor、单调 sequence、op ∈ created/changed/deleted/renamed、entryRef、parentRef?、occurredAt），entryRef/parentRef MUST 为 opaque ref（对新建路径确定性铸造），MUST NOT 携带绝对路径、URL 或凭据。watcher SHALL 恒忽略 `.git` 内部；.gitignore 命中的路径与树列表一致照常发事件（树以 ignored 标志列出这些条目，事件一致性要求照发）。

#### Scenario: 外部创建文件
- **WHEN** 订阅在场时用户在外部工具创建 `docs/new.md`
- **THEN** owner SHALL 发出 `{op: 'created', entryRef: <opaque>, parentRef: <docs 目录 opaque>}` 事件
- **AND** 该 ref 与后续 `fs.treeV2` 列出的同一文件 ref 一致

#### Scenario: 无订阅零开销
- **WHEN** 没有任何活跃 SSE 订阅
- **THEN** owner SHALL 不持有任何文件系统 watcher

#### Scenario: `.git` 内部无事件
- **WHEN** 事件发生在 `.git/` 内部
- **THEN** owner MUST NOT 发出该事件
- **AND** .gitignore 命中的普通路径照常发事件（与树列表的 ignored 标志可见性一致）

### Requirement: watch 事件 SHALL 经 SSE 流传输并支持 cursor 重放
owner SHALL 提供 `GET fs.watch.streamV1?sessionId=&since=`：sessionId fence 与既有 opaque 方法一致（无 workspace owner → 403）；响应为 `text/event-stream`，首条 `cursor` 事件给出当前游标，随后重放 sequence 大于 `since` 的缓冲事件，再转发实时事件；MUST 有周期心跳保活。客户端断线重连 SHALL 携带最新 cursor，重复事件由客户端既有折叠吸收，sequence gap 触发既有一次权威重读。

#### Scenario: 断线重放
- **WHEN** 客户端断开后以 `since=<最后已知 sequence>` 重连
- **THEN** owner SHALL 重放缓冲区内 sequence 更大的全部事件
- **AND** 超出缓冲（512 条）的历史 SHALL 造成客户端 sequence gap → 一次权威重读

#### Scenario: 会话 fence
- **WHEN** 请求携带未知 sessionId
- **THEN** owner SHALL 返回 403，不建立流

### Requirement: 浏览器 host SHALL 暴露 watch 句柄并让 runtime 广告能力
`createExplorerFileHost` SHALL 在支持流式传输的环境实现 `watch(parentRef?)`（v1 为整 workspace 流）并声明 `FILE_WATCH_CAPABILITY`；事件在分发前 SHALL 做形状校验（op 合法、entryRef 非 path 形、sequence 为数字），非法事件 MUST 被丢弃并保持订阅。`dsh-desktop-workbench` SHALL 在 host 具备 watch 时把 host 作为 `fileWatch` 注入 `ExplorerRuntimeV2`，`ExplorerWatchController` 随即绑定；host 不具备时保持既有 on-demand 降级，MUST NOT 伪造事件或轮询。

#### Scenario: 能力探测翻转
- **WHEN** explorer host 支持 watch
- **THEN** `ExplorerWatchController.available` SHALL 为 true，树进入 live 模式

#### Scenario: 非法事件隔离
- **WHEN** 流中出现 entryRef 为 `/etc/passwd` 的事件
- **THEN** host SHALL 丢弃该事件且不影响其余订阅

### Requirement: explorer SHALL 显示活度徽标并提供用户显式刷新
explorer 头部 SHALL 显示 `data-file-watch="live|ondemand"` 与 `data-freshness` 徽标；「刷新」动作 SHALL 触发视图级权威重读（roots + 已展开目录），重读 MUST 保留用户展开、选择、焦点与滚动锚点（既有 `reconcile_apply` 语义）。无 watch 能力时徽标 SHALL 如实显示 on-demand，MUST NOT 暗示自动刷新。

#### Scenario: on-demand 如实标注
- **WHEN** host 无 watch 能力
- **THEN** 徽标 SHALL 显示 on-demand，刷新按钮仍可用（显式重读）
