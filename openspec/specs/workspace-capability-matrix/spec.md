# workspace-capability-matrix Specification

## Purpose
TBD - created by archiving change dsh-web-pane-experience-completion-v1. Update Purpose after archive.
## Requirements
### Requirement: Experience Tier 必须是一次性判定的运行时投影
Pane Workbench MUST 在 `apply()` 时根据 probe 结果集判定 `WorkspaceExperienceTierV1`（Tier 0 发布版 overlay / Tier 1 Core Pane docking / Tier 2 全 seam），tier 判定 MUST 是纯函数（输入 probe 结果、输出 tier 与 reasons）；seam 热插拔事件 MUST 触发重判并向订阅者广播。

#### Scenario: 发布版环境判定
- **WHEN** 官方发布版缺少 `workspace.core-pane.v1`
- **THEN** 判定结果为 Tier 0，`reasons` 含对应 seam 缺失的标准 reason key

#### Scenario: 运行期 seam 热插拔
- **WHEN** 会话运行中 command-experience seam 变为可用
- **THEN** tier 投影重判更新，依赖该 seam 的入口在不刷新页面的情况下启用

### Requirement: 能力矩阵投影内容必须受限
能力矩阵投影 MUST 只含 tier、各 seam 的 probe 布尔、标准 reason key 与文档锚点；MUST NOT 含绝对路径、URL、token、版本指纹以外的环境信息或任何用户内容。

#### Scenario: 渲染能力矩阵
- **WHEN** 用户打开 Workspace Capabilities 视图
- **THEN** 列表逐行展示 seam 名称、可用/禁用状态、reason 文案与"如何解锁"文档锚点，无路径与 URL

### Requirement: 每个禁用入口必须携带标准 reason 与解锁指引
所有因 capability 缺失而禁用的入口（命令、按钮、菜单项、tab 动作）MUST 展示来自 i18n namespace 的标准 reason 文案，并在能力矩阵中有对应解锁指引；MUST NOT 出现无解释的禁用或静默消失。

#### Scenario: 悬停禁用的 Split 按钮
- **WHEN** 用户在 Tier 0 悬停禁用的 Split 按钮
- **THEN** Tooltip 展示标准 reason 与能力矩阵入口指引

#### Scenario: 命令面板中的禁用命令
- **WHEN** /drama 命令组因命令 seam 全缺而禁用
- **THEN** 命令面板条目可见但禁用，附 reason 与解锁指引锚点

### Requirement: host 几何类能力禁用时控件必须可见而非隐藏
Split、move region、dock 等依赖 host 几何的控件在 Tier 0 MUST 以禁用态可见呈现（含 reason），MUST NOT 通过隐藏制造"功能不存在"的误解；插件自有能力的禁用可按上下文隐藏。

#### Scenario: Tier 0 的 group 工具条
- **WHEN** overlay 渲染 group 工具条
- **THEN** Split/Move 控件可见且禁用，More 菜单中对应项同样禁用并附 reason

### Requirement: 诊断证据事件必须脱敏
能力矩阵 MUST 发出脱敏诊断事件：tier 分布、disabled reason 类别、解锁指引点击类别；事件 MUST NOT 含 URL、token、路径、raw prompt、provider payload、私有工具参数或完整思维链。

#### Scenario: 用户点击解锁指引
- **WHEN** 用户在能力矩阵点击某 seam 的解锁锚点
- **THEN** 证据管道收到 `unlock_hint_clicked` 类别事件，payload 只有 seam 类别，无环境指纹

### Requirement: Tier 信息 MUST NOT 持久化
Tier 判定结果、probe 状态与 reasons MUST 每次会话重新判定，MUST NOT 写入 pane persistence、profile 或任何跨会话存储；持久化层只允许既有布局与安全资源引用。

#### Scenario: 跨会话环境变化
- **WHEN** 用户升级 DSH 使 workspace seam 可用后重启会话
- **THEN** 新会话直接判定为 Tier 1，不存在来自旧会话的过期 tier 状态

### Requirement: 残缺 seam 必须判定为不匹配而非部分可用
Tier 判定 MUST 区分"缺失"与"残缺"： seam 对象存在但合同不完整（如残缺 `workspaceLayout`）MUST 判定为 `contract_mismatch`，不计入更高 Tier，并在矩阵中给出区别于"未安装"的 reason。

#### Scenario: 残缺 workspaceLayout
- **WHEN** host 暴露 `ctx.workspaceLayout` 但缺 `workspace.core-pane.v1` 合同面
- **THEN** 判定保持 Tier 0，矩阵该行显示 `contract_mismatch` 类 reason 与所需合同版本，而不是显示可用

### Requirement: Probe 结果必须会话级缓存并由热插拔失效
Probe MUST 在会话内缓存结果，交互路径 MUST NOT 每次动作重复发起 probe RPC；缓存 MUST 在 seam 热插拔/owner 版本变化事件时失效重判。

#### Scenario: 连续交互不重复 probe
- **WHEN** 用户在一分钟内连续打开多个视图
- **THEN** 每个 seam 的 probe 只发生一次，视图打开路径不发起的新的 probe RPC

#### Scenario: owner 版本变化
- **WHEN** 某 owner 广播版本变化事件
- **THEN** 相关 probe 缓存失效，下一次判定使用新结果

### Requirement: Capability matrix SHALL declare Ordo Team V1 parity
workspace capability matrix SHALL 声明 `team_collaboration.v1` 及其 snapshot、events、actions、Room、Activity、surface control、graph/list 与 maturity capabilities。Web SHALL 仅在 Host 和 Ordo owner versions compatible 时宣称 available。

#### Scenario: Host supports read but not actions
- **WHEN** snapshot/events compatible但 action bridge 未注册
- **THEN** matrix SHALL 标记 read available、mutation unavailable，并提供真实 upgrade/fallback reason

### Requirement: Matrix SHALL distinguish Ordo Team and Session Agent coverage
Ordo Team V1 parity SHALL 与 Session Agents host-dependent capabilities 分开记录。一个 capability family available MUST 不推导另一个 family available。

#### Scenario: Ordo Team is fully available but Session action is missing
- **WHEN** Host 支持 Team V1 全部 actions但没有某 Session Agent action
- **THEN** matrix SHALL 只禁用 Session action，Ordo Team parity badge MAY 保持完整

### Requirement: Matrix SHALL reveal prototype and qualification maturity
matrix SHALL 区分 `experimental_fixture`、`fake_runtime`、`qualified_live` 与 `unavailable` 或等价稳定 states，并 SHALL 分开报告 requested/effective writer capability。fake 8-writer MUST 不显示为 live qualified。

#### Scenario: Eight-writer fixture is selected
- **WHEN** Delivery projection 标记 `simulation=true`、requested writers=8
- **THEN** UI SHALL 显示 fake/internal maturity，matrix MUST 不把 live writer capability提升为 8
