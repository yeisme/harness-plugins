## ADDED Requirements

### Requirement: Canonical Explorer entry point
系统 SHALL 将 `dsh.explorer` 作为唯一可发现的文件导航视图，并让旧入口和路由打开同一 canonical runtime。

#### Scenario: Legacy File Tree button
- **WHEN** 用户从旧 File Tree 按钮、`/explorer`、`/files` 或旧 view kind 请求打开文件导航
- **THEN** 系统打开或聚焦 `dsh.explorer`，且旧 provider 不再出现在 picker 中

#### Scenario: Persisted legacy view
- **WHEN** Release 1 加载包含 `file.tree`、`workspace.explorer` 或 `desktop.files` 的持久化布局
- **THEN** shim 使用 canonical Explorer runtime 渲染并记录弃用诊断，而不是创建独立文件树状态

### Requirement: Paginated owner-authored tree projection
系统 SHALL 通过 `FileTreeProjectionCapabilityV2` 的 `roots`、`listChildren`、`search` 和 `reveal` 返回 owner-authored 分页投影。

#### Scenario: Enumerate every entry
- **WHEN** 当前 workspace 包含普通、hidden、ignored、sensitive、未知类型和 symlink 条目
- **THEN** Host 返回所有可枚举名称及 typed availability，不因点文件、ignore 规则、扩展名或 MIME 隐藏条目

#### Scenario: Page fence
- **WHEN** 客户端请求 roots、children、search 或 reveal 页面
- **THEN** 页面包含 `workspaceRef`、`generation`、`revision`、`nextCursor` 和 `truncated`，节点只包含 opaque ref

#### Scenario: Revision drift during pagination
- **WHEN** 后续页请求的 generation 或 revision 已过期
- **THEN** Host 返回 typed stale/drift 结果，且客户端重新加载受影响父节点而不拼接不一致页面

### Requirement: Lazy and virtualized navigation
系统 SHALL 逐层懒加载目录并虚拟化已加载行，全仓搜索 SHALL 由 Host 分页执行。

#### Scenario: Expand directory without preview
- **WHEN** 用户单击任意可枚举目录
- **THEN** Explorer 展开或折叠目录，即使目录自身没有 preview rendition

#### Scenario: Large repository
- **WHEN** workspace 的匹配节点超过单页或可视窗口
- **THEN** Host 返回分页结果，客户端只渲染虚拟窗口且不在浏览器递归遍历仓库

### Requirement: Strict owner preview gate
系统 MUST 仅在 owner inspect/openRendition 成功返回 usable `ready` 或 `partial` 内容后打开或引用文件。

#### Scenario: Unsupported visible file
- **WHEN** 文件可枚举但 owner 无法产生 usable rendition
- **THEN** 文件名称保持可见，行显示不可打开原因，单击、双击和引用动作均不打开内容

#### Scenario: Partial preview
- **WHEN** owner 只返回 `partial` rendition
- **THEN** Explorer 只展示 owner 已检视窗口，引用只能覆盖该窗口或明确 selection anchor

#### Scenario: Legacy open flag
- **WHEN** 节点只有旧 `open` capability、扩展名或 MIME 猜测而没有 owner proof
- **THEN** 系统拒绝打开和引用

### Requirement: Sensitive and symlink safety
系统 SHALL 显示敏感文件和 symlink 名称，同时将正文揭示与目标跟随置于 owner 验证之后。

#### Scenario: Sensitive reveal expires
- **WHEN** 用户为敏感资源确认 reveal 后切换 session 或资源 version 变化
- **THEN** reveal 授权失效，后续正文访问需要重新确认

#### Scenario: Broken or escaping symlink
- **WHEN** symlink 断链、循环或目标位于 workspace 外
- **THEN** 节点仍可见但 reveal typed disabled，且浏览器得不到目标路径

#### Scenario: Safe symlink reveal
- **WHEN** 用户显式 reveal 且 owner 证明目标仍在当前 workspace 且无循环
- **THEN** Explorer 导航到 owner 返回的 opaque target ref

### Requirement: Deterministic pointer keyboard and touch interactions
系统 SHALL 让 primary preview、checked set、pinned Tab、metadata card 与 responsive navigation 具有独立且可测试的状态。

#### Scenario: File click and pin
- **WHEN** 用户单击文件后再双击，或在 primary file 上按 Enter
- **THEN** 第一次动作打开临时 preview，第二次动作固定内容 Tab，checked set 不被隐式修改

#### Scenario: Stable hover or focus
- **WHEN** fine-pointer hover 或 keyboard focus 在行上稳定约 350ms
- **THEN** Explorer 请求 metadata-only inspect，并在原行和锚定卡同步显示 pending/ready/error

#### Scenario: Coarse pointer
- **WHEN** 设备为 coarse pointer
- **THEN** hover 不触发卡片，用户可通过显式 Info/More 打开相同 metadata surface

#### Scenario: Narrow viewport
- **WHEN** 视口进入窄屏且用户打开文件
- **THEN** 内容页替换 navigator，并提供返回 Explorer 和焦点恢复；宽屏仍锁定 navigator 并在相邻 group 打开内容

### Requirement: Exact session owner resolution
V2 inspect、tree、reference 和 rendition 请求 MUST 解析到精确 session owner，且无效 session MUST NOT 回退 `process.cwd()`。

#### Scenario: Unknown session
- **WHEN** V2 请求携带不存在、过期或不属于当前 principal 的 session
- **THEN** Host 非枚举地拒绝请求，不读取进程工作目录，也不返回绝对路径

### Requirement: Two-release compatibility window
系统 SHALL 以 additive alias 完成两个 release 的迁移，当前 change MUST NOT 删除旧 kind 或 V1 合同。

#### Scenario: Rollback
- **WHEN** operator 关闭 canonical Explorer policy
- **THEN** 系统恢复 legacy Explorer 行为并禁用结构化引用发送，同时保留布局和引用快照
