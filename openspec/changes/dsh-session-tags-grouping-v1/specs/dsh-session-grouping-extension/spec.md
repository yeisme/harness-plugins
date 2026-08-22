## ADDED Requirements

### Requirement: DSH SHALL 提供通用会话分组注册表
DSH `ui-workspace` SHALL 导出 experimental `SessionGroupingProviderV1Alpha1` 合同与 `ctx.sessionGroupings` Cordis 服务。合同 SHALL 只描述分组投影、搜索词和会话动作，MUST NOT 包含 tags、文件夹、收藏夹或其他具体领域类型。

#### Scenario: 社区插件注册分组提供者
- **WHEN** 一个 Client 插件向 `ctx.sessionGroupings.register(provider)` 注册唯一 provider id
- **THEN** 原生会话视图菜单 SHALL 增加该 provider 的本地化选项
- **AND** 插件 MUST NOT 替换 `sidebar.workspaces` 整块 slot

#### Scenario: provider id 冲突
- **WHEN** 两个活动注册使用相同 provider id
- **THEN** 后一个注册 SHALL fail loud 并指出冲突 id
- **AND** 已注册 provider SHALL 保持可用

### Requirement: Provider 注册 SHALL 遵循 effect-scoped 生命周期
`register()` SHALL 返回幂等 disposer，并归属调用插件的 Cordis fiber；provider 卸载、HMR 或注册失败后 MUST NOT 留下菜单项、订阅、动作或展示状态。

#### Scenario: 热卸载当前 provider
- **WHEN** 当前选中的外部分组 provider 被卸载
- **THEN** 菜单项和 provider 会话动作 SHALL 消失
- **AND** 浏览器 SHALL 自动切回 `workspace`
- **AND** MUST NOT 显示空白侧栏或死入口

### Requirement: Provider snapshot SHALL 是只读稳定投影
每个 provider SHALL 提供 `getSnapshot()` 与 `subscribe(listener)`；snapshot 在下一次通知前 SHALL 保持引用稳定，并包含唯一 group id、显示标签和 SessionId 列表。一个 SessionId MAY 出现在多个组，但同一组内重复 id SHALL 只渲染一次。

#### Scenario: 一个会话属于多个外部组
- **WHEN** provider snapshot 将同一 SessionId 放入两个不同 group
- **THEN** 原生侧栏 SHALL 在两个组中都显示该会话
- **AND** 两个条目 SHALL 打开同一 canonical Session

#### Scenario: snapshot 包含未知或归档会话
- **WHEN** provider 返回当前 Session 列表不存在或已归档的 SessionId
- **THEN** 浏览器 SHALL 忽略这些 id
- **AND** MUST NOT 让 provider 创建、恢复或伪造 Session

### Requirement: 外部分组 SHALL 复用原生会话行与排序语义
DSH SHALL 使用原生 Session 行渲染外部分组，保留打开、重命名、分支和归档动作。provider 只拥有组顺序与成员关系；`manual`/`updated` 的组内排序 SHALL 由浏览器执行。

#### Scenario: 按最近更新排序
- **WHEN** 用户在外部分组模式选择 `updated`
- **THEN** 每个组内会话 SHALL 按现有最近更新策略排序
- **AND** provider 数据变化 MUST NOT 修改 Session 的 `updatedAt`

#### Scenario: 手动排序外部分组
- **WHEN** 用户在外部分组模式选择 `manual` 并拖动会话
- **THEN** 排序 SHALL 只写入按 provider/group 命名空间隔离的浏览器 view account
- **AND** MUST NOT 调用 Workspace 的持久化重排 API

#### Scenario: 外部分组标题动作
- **WHEN** 浏览器渲染没有 Workspace backing 的外部分组标题
- **THEN** SHALL 隐藏 Workspace 新建、重命名、删除和拖动动作
- **AND** SHALL 保留展开/折叠能力

### Requirement: Provider MAY 贡献安全的会话管理动作
Provider MAY 声明带唯一 action id、本地化标签和 `open(sessionId)` 回调的会话动作。回调 SHALL 只启动 provider 自有 UI 或 typed intent；DSH MUST NOT 替 provider 执行领域 mutation。

#### Scenario: 从任意分组打开 provider 编辑器
- **WHEN** provider 声明一个会话动作且用户从 Session 行选择该动作
- **THEN** DSH SHALL 将该行的 canonical SessionId 传给 provider
- **AND** provider SHALL 负责 modal、错误和写入生命周期

### Requirement: 搜索 SHALL 合并 provider 的安全搜索词
Provider MAY 为 SessionId 提供有界、纯文本 `searchTerms`。原生本地搜索 SHALL 将其与 Session 标题和 Workspace 标签合并；Remote 内容搜索语义和结果上限 MUST NOT 改变。

#### Scenario: 通过外部标签找到会话
- **WHEN** 查询只匹配 provider 提供的搜索词
- **THEN** 对应会话 SHALL 出现在搜索结果
- **AND** 结果 SHALL 使用原生 Session 搜索行

### Requirement: 扩展 seam SHALL 保持兼容并诚实降级
该公开 TypeScript surface SHALL 标记 `v1alpha1`/experimental，作为 additive export 发布；既有 `SessionGroupBy` 的 `workspace`/`flat` 输入与持久化值 SHALL 继续工作。插件 MUST 先探测 capability，禁止 DOM patch 或整块侧栏 fallback。

#### Scenario: 旧 DSH 不提供分组服务
- **WHEN** 插件运行在没有 `ctx.sessionGroupings` 的 DSH 版本
- **THEN** 插件 SHALL 不注册“按标签”或管理动作
- **AND** Host sidecar MAY 保持可加载
- **AND** UI SHALL 不出现死按钮或伪成功提示

#### Scenario: 现有用户升级 DSH
- **WHEN** 用户已有 `workspace` 或 `flat` 的持久化视图状态并升级到包含 seam 的版本
- **THEN** 原分组和排序选择 SHALL 保持不变
- **AND** 新 provider SHALL 仅作为新增菜单项出现

### Requirement: DSH SHALL 提供社区接入与 conformance 证据
上游 seam SHALL 配套最小 provider 示例、生命周期说明、snapshot 不变量、capability probe 和 focused conformance tests；示例 MUST NOT 要求导入 DSH 私有模块。

#### Scenario: 第三方作者按公开文档接入
- **WHEN** 第三方插件只依赖发布的 `@deepseek-ai/dsh-client-ui-workspace/client` surface
- **THEN** 其 provider SHALL 能通过注册、选择、卸载和搜索 conformance tests
- **AND** 源码扫描 SHALL 不发现私有路径或 DOM selector 依赖
