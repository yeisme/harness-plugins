## ADDED Requirements

### Requirement: 单壳项目与成果姿态

启用 `projectContinuityDesktopV1` 后 `/agent` MUST 优先打开最近合法成果或注册的项目续接 document，复用唯一 Chat/composer、document dock 与 Context rail；既有 Pane 限制和稳定深链保持可用。

#### Scenario: 首次打开与恢复项目
- **WHEN** 用户首次进入无历史项目，或恢复已有合法历史的项目
- **THEN** 分别显示紧凑续接视图或最近成果及保存状态，Agent 会话保持可达，页面打开不执行工具

#### Scenario: 重复打开和 Pane 达到上限
- **WHEN** 用户重复打开同一 document，或已有四个可见 Pane
- **THEN** 分别 focus 原 document 或显示 limit_reached，由用户明确关闭/替换，不静默覆盖

#### Scenario: 新能力关闭
- **WHEN** 新 server capability 缺失、未知或关闭
- **THEN** 原 `/agent` 行为、已有 Project 数据视图、Chat/Spatial 与旧深链语义保留

### Requirement: 显式上下文、成果审阅与运行反馈

工作台 MUST 清晰展示项目、成果保存状态、选定上下文、当前步骤和一个下一动作；对象选择不自动发送或授权，候选接受不自动晋级领域正式版本。

#### Scenario: 选择对象后提出问题
- **WHEN** 用户选择文本或对象并使用 Add to context
- **THEN** 经现有 pending/authorize/attach 流程展示 exact refs/revisions，Agent submission 使用经确认上下文

#### Scenario: 候选与新事件同时出现
- **WHEN** 用户正在比较候选时有新运行事件
- **THEN** 保留当前焦点、滚动和比较对象，用 owner 状态更新运行反馈，不自动接受或更换成果

### Requirement: 桌面适配与可访问性

UI MUST 按有效 CSS 宽度适配：≥1440 成果+Chat 和按需 Context，1024–1439 双区与互斥 Sheet，<1024 单内容与 Chat/Review；支持键盘、中文 IME、200% zoom 和 reduced-motion。

#### Scenario: 窄屏与放大
- **WHEN** 用户在 1280 宽度或 200% zoom 下打开 Context/目录
- **THEN** 主成果可读、关键动作可达，互斥 Sheet 有标签/Escape/focus restore，不强行挤压三栏

#### Scenario: 中文输入与键盘移动
- **WHEN** IME composition 中按 Enter，或用户只用键盘操作目录与审阅
- **THEN** 不误发送消息，目录/Tab/动作有等价路径，桌面 complementary Pane 不锁焦点

### Requirement: 共享状态与恢复

所有新增 surface MUST 复用设计系统与就地状态，区分 loading、empty、ready/running、error/offline、partial/stale、permission/cost 和 unknown；不以网络错误显示空项目。

#### Scenario: 断线或权限撤销
- **WHEN** 连接失败或服务确认权限被撤销
- **THEN** 连接失败保留仍授权的最后确认内容并标 stale，权限撤销清除对应敏感缓存；两者均提供匹配恢复说明

#### Scenario: 关闭运行 Pane
- **WHEN** 用户关闭 Pane 或浏览器页面
- **THEN** UI 关闭不取消后台任务，恢复后先同步原状态，未确认取消不显示 cancelled
