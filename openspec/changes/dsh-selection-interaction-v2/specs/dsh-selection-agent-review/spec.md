## MODIFIED Requirements

### Requirement: 选区触发必须以稳定且明确的上下文为前提
用户完成文本/源码、图片区域、表格范围或允许接管的编辑控件选择后，系统 MUST
先等待选区稳定并通过 viewport、敏感区域和宿主 opt-out 检查，再由全局 singleton
interaction layer 显示 Actions 入口；普通 selectionchange MUST NOT 自动打开
Compact Agent Composer。Composer 只能在用户明确激活需要 Composer 的动作后打开。
Actions MUST 使用 V2 的 1 个 primary、最多 2 个 secondary 与 More 密度，且保持
键盘导航、Esc、窄面板与滚出视口降级。

#### Scenario: 阅读时的普通选中
- **WHEN** 用户在普通文本上短暂选中、复制后立即重新选择或选区未稳定
- **THEN** 系统 MUST NOT 打开 Composer
- **AND** 未通过稳定性检查前 MUST NOT 渲染完整 Actions 浮层

#### Scenario: 稳定文本选区
- **WHEN** 用户在可交互文本上保持选区稳定至少 120ms 且不在敏感/opt-out 区域
- **THEN** 系统 SHALL 显示一个全局 Actions 表面
- **AND** SHALL 只显示 context-aware primary、最多两个 secondary 和 More

#### Scenario: 用户明确发起询问
- **WHEN** 用户点击或用键盘激活 Actions 的“问 Agent”
- **THEN** 系统 SHALL 打开 Compact Agent Composer 并把焦点移到输入区
- **AND** MUST 保留 anchor context、preview-first 与原会话 owner 语义

#### Scenario: 选区失效
- **WHEN** 用户滚动、重新选择、按 Esc 或点击浮层外部
- **THEN** 临时 Actions MUST 关闭或退化为短暂边缘入口
- **AND** MUST NOT 自动 Pin 或保留可执行的陈旧 context

### Requirement: 编辑控件接管必须有安全排除和宿主退出
系统 SHALL 默认支持 input、textarea、contenteditable 和代码编辑器的选区接管，
但 MUST 排除密码/敏感字段、interaction layer/Composer 自身以及带宿主 opt-out
标记的区域。宿主/editor 可以显式禁用接管；禁用时原生编辑器选择、快捷键和焦点
语义 MUST 保持不变。

#### Scenario: 密码字段
- **WHEN** 用户在 password input 中选择或聚焦
- **THEN** selection interaction layer MUST NOT 读取、渲染或提交该内容
- **AND** 原生编辑行为 MUST 保持可用

#### Scenario: 宿主 opt-out
- **WHEN** 选择位于带 `data-dsh-selection-optout` 的编辑器根节点
- **THEN** 系统 MUST 不显示 Actions
- **AND** 不得阻止宿主已有快捷键或选择事件

### Requirement: 新合同必须允许 V2 行为替代并提供一个 release 的 V1 兼容窗口
V2 MUST 通过 capability probe 协商；新 bundle 默认使用 V2。仅支持 V1 的旧宿主
MAY 由 compatibility adapter 获得 V1 行为一个正式 release，但 adapter MUST 标记
deprecated、不得伪造 V2 capability，且必须能通过 policy/kill-switch 回滚。V1
兼容窗口结束后，移除 V1 runtime 前 MUST 完成浏览器、键盘、触控、HMR/dispose、
宿主集成与回滚证据；安装包名和既有 action id alias MUST 保持不变。

#### Scenario: V2 宿主
- **WHEN** host capability 包含 `selection.interaction.v2`
- **THEN** bundle SHALL 注册 singleton interaction layer
- **AND** selectionchange SHALL 不再自动打开 Composer

#### Scenario: 旧 V1 宿主
- **WHEN** host 只提供 V1 selection capability 且仍处于 compatibility window
- **THEN** bundle SHALL 使用 V1 adapter 并显示 deprecated evidence marker
- **AND** 原 V1 submit/add-to-batch owner 事件语义 MUST 保持兼容

#### Scenario: 兼容窗口结束
- **WHEN** removal release 已满足 V2 完成门且 policy 不再允许 V1
- **THEN** bundle SHALL 移除 V1 adapter/runtime
- **AND** 不得通过 client polyfill 伪造 V1 行为
