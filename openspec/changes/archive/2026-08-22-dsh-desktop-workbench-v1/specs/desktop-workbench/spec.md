## ADDED Requirements

### Requirement: Desktop Workbench SHALL 提供可安装 bundle
`@yeisme/dsh-desktop-workbench` SHALL 通过 `dsh plugin --profile web add` 安装，并注册 Session/File/Terminal/Event/Multi-Pane 能力。bundle SHALL 只依赖 DSH 官方发布 surface、现有 `@yeisme/dsh-*` workspace 包与 React；MUST NOT 依赖社区插件包或私有 `ctx.betterSidebar` API。

#### Scenario: 安装到 web profile
- **WHEN** 用户执行 `dsh plugin --profile web add ./packages/bundle/dsh-desktop-workbench`
- **THEN** `dsh --profile web --dump-config` SHALL 包含 `dsh-desktop-workbench` 贡献
- **AND** 移除 bundle 后 SHALL 无 DOM/配置残留

### Requirement: Session Manager SHALL 提供安全会话管理投影
Session Sidebar SHALL 展示会话标题、工作区、运行状态、未读、归档状态与标签；支持搜索、工作区分组、继续/暂停/fork、归档/恢复/删除。所有 mutation SHALL 通过 DSH owner API 并返回 receipt；客户端 MUST NOT 乐观推断成功。

#### Scenario: 归档并恢复会话
- **WHEN** 用户归档一个会话
- **THEN** 该会话 SHALL 从活跃列表移除并保留在归档区
- **AND** 用户恢复后 SHALL 回到原工作区

#### Scenario: 打标签
- **WHEN** 用户为会话添加标签
- **THEN** 标签 SHALL 写入 log-backed `session/labels` 事件
- **AND** 全局搜索 SHALL 可按标签命中该会话

### Requirement: File Host SHALL 提供安全文件树与预览投影
File Host SHALL 通过 `FileEntryV1` 暴露目录树与文件条目；客户端 SHALL 只接收 opaque ref、有界摘要、mediaType 与 capabilities。MUST NOT 传递 raw path、凭据、无界文本或任意 URL。

#### Scenario: 打开文件预览
- **WHEN** 用户在目录树选择文件
- **THEN** 工作台 SHALL 在 Content Pane 打开 preview tab
- **AND** 预览 SHALL 使用 Host 授权的安全 ref

### Requirement: Terminal Host SHALL 提供终端投影
Terminal Host SHALL 通过 DSH terminal seam 暴露终端流；客户端 SHALL 支持多 Tab、detach/reconnect/replay。关闭面板 MUST NOT 终止 PTY，除非用户显式 terminate。

#### Scenario: 关闭终端面板后重连
- **WHEN** 用户关闭终端 Pane
- **THEN** PTY 进程 SHALL 保持运行
- **AND** 重新打开该终端 SHALL 恢复输出流

### Requirement: Event Notify SHALL 监听关键 DSH 事件
Host SHALL 监听 `turn/end`、`approval/asked`、`agent/turn-stopping`、`subagent/end`、`workflow/end` 与后台任务完成事件，并聚合为通知队列。通知 MUST NOT 包含 raw prompt、provider payload、private tool arguments 或完整思维链。

#### Scenario: 审批事件通知
- **WHEN** DSH 发出 `approval/asked`
- **THEN** 通知中心 SHALL 新增一条待处理审批提醒
- **AND** 用户标记已读后 SHALL 不再重复提醒

### Requirement: Multi-Pane Shell SHALL 复用 Pane Workbench
Desktop Workbench SHALL 使用 `@yeisme/dsh-client-ui-pane-workbench` 的 reducer 与 `@yeisme/dsh-workbench-core` 的 registry 组装 Right/Bottom 区域；支持 Tab 拖拽、分栏、resize、键盘/菜单等价操作与布局恢复。

#### Scenario: 打开终端到 Bottom
- **WHEN** 用户打开终端
- **THEN** 终端 SHALL 默认进入 Bottom Utility Pane
- **AND** 文件预览 SHALL 默认进入 Content Pane，不抢占 Navigator/Terminal

### Requirement: Source Independence SHALL 禁止社区包依赖
所有新 package 的 source、manifest、lockfile 与 build output SHALL 不包含社区插件包名、私有 API 或复制源码 marker。仅允许在文档中记录社区来源。

#### Scenario: 源码独立性检查
- **WHEN** 扫描 `packages/host/dsh-session-manager`、`packages/client/ui-desktop-workbench` 与 `packages/bundle/dsh-desktop-workbench`
- **THEN** SHALL 不包含 `dsh-session-manager` 原包依赖、`dsh-codex-ui` 依赖或 `ctx.betterSidebar`
- **AND** `THIRD_PARTY_NOTICES.md` SHALL 记录所有复制来源
