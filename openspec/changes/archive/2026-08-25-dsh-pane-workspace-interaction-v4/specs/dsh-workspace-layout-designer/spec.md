## ADDED Requirements

### Requirement: Workspace Designer SHALL 是唯一 Pane reducer 上的本地 Core View
Workbench SHALL 注册本地受信任 singleton `dsh.workspace-designer`，通过 Rail Customize 或 Pane menu 打开并默认最大化。Designer SHALL 编辑 draft 而不是创建第二 canonical layout/store；远端 provider MUST NOT 注册、替换或注入 Designer component。

#### Scenario: 打开 Workspace Designer
- **WHEN** 用户选择 Customize Workspace
- **THEN** Workbench SHALL 打开或聚焦唯一 Designer view并从当前 generation创建 draft
- **AND** live Pane layout SHALL 在用户 Apply 前保持不变

### Requirement: Designer SHALL 提供 Palette、Canvas、Inspector 和 Validation
桌面 Designer SHALL 提供 provider palette、布局 canvas、selection inspector、header scope/preset/actions 与 validation summary。Canvas SHALL 使用 safe placeholders 表示 Main、Right、Bottom、group、provider placement 和 Tab policy，MUST NOT activate真实 terminal、media、browser或domain view。

#### Scenario: 拖入 Terminal provider
- **WHEN** 用户把 Terminal 从 Palette 放入 Bottom draft group
- **THEN** Canvas SHALL 增加一个 placeholder placement并在 Inspector显示 capability/role/region约束
- **AND** Apply 前 MUST NOT spawn PTY 或打开真实 Terminal Tab

### Requirement: Draft SHALL 绑定 base generation 并可撤销
`PaneWorkspaceDraftV1` SHALL 携带 base generation、scope、regions、split/group、provider placements、rail order、Tab policy、motion preference 和 validation digest。Designer SHALL 支持 bounded Undo/Redo、Discard 和 Reload/Rebase；draft MUST NOT 包含 resource body、absolute path、terminal output、credential 或 provider payload。

#### Scenario: 编辑期间 live layout 变化
- **WHEN** 用户在 Designer 中调整 split，而外部 action 打开新 Pane 使 generation 增长
- **THEN** Designer SHALL 标记 draft out-of-date并提供 Rebase/Reload
- **AND** MUST NOT 以旧 base generation覆盖新 layout

### Requirement: Apply SHALL 校验并原子提交一个 batch intent
Apply SHALL 校验 max depth 2、最多 4 个可见 group、minimum size、region capability、locked/core views、provider compatibility、dirty/deny close 和 view lifecycle。校验通过后 SHALL 以 expected generation提交一个 `apply_workspace_draft` 或等价 atomic intent；失败 MUST 不部分修改 layout。

#### Scenario: Draft 会关闭 deny Tab
- **WHEN** validation发现一个目标变更会移除 closePolicy=deny 的 Tab
- **THEN** Apply SHALL 被阻塞并聚焦该问题，提供 Keep in Place或修改 draft
- **AND** 其他无冲突布局变化 SHALL 不被部分应用

### Requirement: Designer SHALL 默认保留 live views 和用户工作
调整 preset 或 group结构时，Designer SHALL 优先移动/保留现有 views；不得因为 provider placement 改变而自动关闭 dirty、attention、running 或 approval_required Tabs。只有用户显式选择关闭且 owner preflight 允许时才可移除。

#### Scenario: 应用 Focus preset 时存在运行终端
- **WHEN** Focus preset 不包含 Terminal group，但当前 Terminal 正在运行
- **THEN** validation SHALL 提议保留/隐藏/移动而不是 terminate
- **AND** Apply MUST NOT kill PTY 或丢弃 terminal ref

### Requirement: Preset SHALL 通过 application/settings service 管理
Preset create/update/delete/reset SHALL 通过 `PaneWorkspacePresetServiceV1` 或等价 DSH application service执行。Client/agent MUST NOT 手写 canonical JSON/YAML/config。Preset SHALL 只保存安全布局、provider placement、rail、Tab和motion偏好，不保存当前文件、具体 terminal、credential或领域内容。

#### Scenario: 保存 Workspace preset
- **WHEN** 用户选择 scope=workspace并执行 Save As
- **THEN** service SHALL 校验名称、scope、draft digest并返回 receipt
- **AND** persistence中 MUST 不出现 live resource refs或敏感内容

### Requirement: Scope SHALL 明确区分 session、workspace 和 profile
Session scope SHALL 只影响当前 session；workspace scope SHALL 是默认并通过 settings owner 持久化；profile scope SHALL 仅在 owner返回 allowed action时可用，并显示影响范围与恢复方式。Scope 不可用 MUST 显示原因而不是静默降级到其他 scope。

#### Scenario: 用户无 profile 写权限
- **WHEN** 用户选择 Profile scope但 settings owner返回 permission_denied
- **THEN** Designer SHALL 禁用 Save/Apply Profile并说明可用的 Workspace scope
- **AND** MUST NOT 把 profile intent静默保存为 localStorage

### Requirement: Built-in presets SHALL 只读且可复制
V4 SHALL 提供 Focus、Code、Review、Media 四个只读内置 presets。用户 SHALL 可 Preview、Apply 或 Save As 自定义副本；内置 preset更新 MUST NOT覆盖同名用户 preset或删除现有布局。

#### Scenario: 从 Code preset 创建副本
- **WHEN** 用户选择 Code并执行 Save As `My Code`
- **THEN** service SHALL 创建独立用户 preset并保留 built-in Code
- **AND** 后续 built-in升级 MUST NOT改写 `My Code`

### Requirement: Designer SHALL 提供 Apply 前 diff 和风险摘要
Validation summary SHALL 列出将创建/移动/隐藏/关闭的 groups/views、尺寸约束、缺 capability providers、dirty/deny blockers、scope、preset和motion变化。高风险或profile-wide动作 SHALL 明确 target和approval requirement。

#### Scenario: Apply 会移动两个 views 并隐藏一个 region
- **WHEN** draft校验完成
- **THEN** Designer SHALL 在 Apply 前显示精确变更摘要和阻塞/警告数量
- **AND** 用户 SHALL 能定位到对应 Canvas/Inspector对象

### Requirement: Designer SHALL 支持响应式三步投影
在 `<=600px` viewport，Palette、Canvas、Inspector SHALL 作为可导航三步 Sheet；Apply/Discard SHALL 固定可达，validation error SHALL 可跳转到对应步骤。Responsive projection MUST NOT 改写 draft结构或 preset scope。

#### Scenario: 390px 配置 split ratio
- **WHEN** 用户在 Canvas步骤调整 Right/Bottom ratio并进入 Inspector
- **THEN** draft SHALL 保留同一 ratio和selection，Apply footer保持可达
- **AND** UI MUST NOT 横向溢出或挂载真实 Pane content

### Requirement: Designer SHALL 可访问且本地化
Palette SHALL 使用 listbox或tree语义，Canvas objects SHALL 可通过 keyboard选择/移动，split ratios SHALL 使用 separator/slider语义，Inspector/validation SHALL 有明确 labels与错误关联。所有固定 copy和announcements SHALL 使用 `paneWorkbench` locale namespace。

#### Scenario: 键盘创建 Bottom group
- **WHEN** 用户通过 Add Group command选择 Bottom并确认
- **THEN** draft SHALL 添加合法 group，focus SHALL 移到新 Canvas object并宣布结果
- **AND** 该操作 SHALL 与 pointer palette/drop 使用同一 draft mutation

### Requirement: Designer unavailable SHALL 有兼容回退
如果 host缺少 required Core View、settings或draft capability，Workbench SHALL 隐藏或禁用 Customize入口并提供版本/capability说明。它 MUST NOT 使用私有 router、DOM selector、`shell.overlay` monkey patch或手写 config模拟页面。

#### Scenario: 旧 Pane controller 不支持 draft apply
- **WHEN** bundle检测到旧 controller只有 V1 intents
- **THEN**现有 Pane、Explorer、Git 和 Tab功能 SHALL 继续工作，Customize SHALL 显示升级要求
- **AND**旧 layout persistence SHALL 保持可读
