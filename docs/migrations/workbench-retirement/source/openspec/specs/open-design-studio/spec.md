# open-design-studio Specification

## Purpose
TBD - created by archiving change open-design-studio-experience. Update Purpose after archive.
## Requirements
### Requirement: 图标优先导航

系统 MUST 默认只显示稳定图标，并在鼠标悬停或键盘聚焦时显示当前 locale 的 Tooltip。

#### Scenario: 中文 locale 悬停提示

- **Given** 当前 locale 为 `zh-CN`
- **When** 用户将指针停留在 Prompts 图标约 350ms
- **Then** 图标右侧显示“提示词”与可选快捷键
- **And** 界面不同时显示英文翻译

#### Scenario: 键盘聚焦

- **Given** 用户使用键盘导航
- **When** Prompts 图标获得 focus
- **Then** Tooltip 立即显示
- **And** focus ring 与当前选择状态可区分

### Requirement: 候选可追溯

系统 MUST 让候选设计追溯至安全的项目文件、提示词版本、参考图、Skill、Design System 和运行证据引用。

#### Scenario: 打开候选 Inspector

- **Given** 用户选择一个候选设计
- **When** Inspector 展开
- **Then** 显示安全来源引用和运行状态
- **And** 不显示 provider payload、credential、私有路径或隐藏提示

### Requirement: 能力状态真实

系统 MUST 区分 connected、running、partial、blocked、offline 和 unavailable，不得为缺失合同展示成功交互。

#### Scenario: 审查合同尚不可用

- **Given** Open Design 尚未提供 review decision 写合同
- **When** 用户查看候选审查区域
- **Then** 接受操作显示 unavailable gate
- **And** 用户可查看所需合同或复制真实诊断命令
- **And** 系统不播放成功动画或写入本地伪状态

### Requirement: 悬浮 Inspector

Inspector MUST 是与窗口边缘分离的上下文浮层，而不是全高贴边侧栏。

#### Scenario: 桌面宽屏选择候选

- **Given** 视口宽度至少 1440px
- **When** 用户选择候选
- **Then** Inspector 在右侧四周保留背景间隙
- **And** 显示独立圆角、阴影和底部拖拽把手

### Requirement: 减少动态

系统 MUST 尊重 `prefers-reduced-motion`。

#### Scenario: 减少动态开启

- **Given** 操作系统启用减少动态
- **When** 用户切换选择对象
- **Then** 空间位移被取消
- **And** 使用短淡入淡出和描边变化表达状态

### Requirement: Design projection 安全边界

系统 MUST 只通过配置的 Open Design owner URL 提供瞬时、只读、安全字段投影。

#### Scenario: 显式读取提示词文本

- **Given** 用户明确打开一个允许的文本文件
- **When** Workbench 收到 opaque `fileRef`
- **Then** 服务重新列举项目文件并匹配 hash
- **And** 仅返回不超过 512 KiB 的允许 MIME 文本
- **And** 响应、日志和持久化均不包含 owner 私有路径或 credential

#### Scenario: Owner 不可达

- **Given** 批准的 owner connector 未配置或 owner 请求失败
- **When** Web 查询 Design capabilities
- **Then** 对应能力返回 `offline`
- **And** Task 控制面与 Web shell 继续可用

### Requirement: 同源本机 Web Host

浏览器 MUST 只通过 Bun loopback BFF 访问 Workbench API，且不得获得 session token。

#### Scenario: 浏览器伪造 Authorization

- **Given** 浏览器请求携带自定义 `Authorization`
- **When** BFF 代理请求到 `workbenchd`
- **Then** BFF 丢弃该值并注入 token 文件中的服务端 token
- **And** token 不出现在 HTML、配置响应或日志中

### Requirement: 可恢复多 Pane 工作区

桌面工作区 MUST 支持 Tab 合并、边缘 Split、内部浮动、Divider resize、布局 preset 和 Panel Manager。

#### Scenario: 损坏布局恢复

- **Given** 本地布局 JSON 损坏、schema 过期或引用未知面板
- **When** 用户打开任一 Studio 路由
- **Then** 工作区回退到该路由默认 preset
- **And** 用户可以继续打开、停靠和关闭面板

#### Scenario: 移动端打开 Inspector

- **Given** 视口宽度小于 768px
- **When** 用户选择 Canvas 对象
- **Then** Inspector 使用底部 Sheet 展示相同 Panel 内容
- **And** 不开放自由 docking 或外部窗口
