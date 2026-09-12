## ADDED Requirements

### Requirement: 市场入口必须提供真实 Web 快读与深看
Pane MUST 使用统一 Surface/locale/视觉 tokens 展示变化、关注、对照、回顾；市场变化优先于分数与技术参数，文本帧不得作为新 Web face 完成证据。

#### Scenario: 首次打开
- **WHEN** 用户首次进入且存在已完成市场简报
- **THEN** 不先要求创作 Profile，显示变化、证据等级、截止时间与覆盖缺口

#### Scenario: 没有重大变化和没有数据
- **WHEN** owner 返回 empty 或 absent
- **THEN** 分别表达“未发现重大变化”和“尚无可读版次”，不能混为同一空态

### Requirement: 补看与深看必须保持阅读上下文
系统 MUST 区分未读修订与完整版次，详情/对照返回保留原引用、筛选和位置；后台新版本只提示，不替换正在阅读的内容。

#### Scenario: 详情中收到新版
- **WHEN** 用户正在读 revision 1 的证据而 owner 发布新 brief
- **THEN** 当前内容保持稳定并提示更新，用户选择后才切换

### Requirement: 已读与关注必须显式且相互独立
已读 SHALL 只提交当前实际显示的 refs/revisions；预读、滚动和提问不记已读；关注不写旧 saved/dismissed。

#### Scenario: 用户标记当前页面已读
- **WHEN** 列表只显示第一页且后页尚未加载
- **THEN** 只提交当前显示项，后页及随后更正保持未读

### Requirement: 对照和回顾必须呈现证据限制
对照 MUST 保留各侧地区、时间、指标和原名，不可比时解释原因；回顾 MUST 区分持续、消退、更正和无法判断。

#### Scenario: 指标不同的跨市场对照
- **WHEN** 一侧是榜单名次另一侧是互动量
- **THEN** 分列展示，不能画统一热度轴

### Requirement: 证据问答必须绑定当前会话和信号修订
问答 SHALL 创建可编辑的安全引用草稿，用户显式发送后进入所选当前会话；旧请求响应不得发送到新会话。缺 composer seam 时诚实 disabled。

#### Scenario: 准备问题期间切换会话
- **WHEN** 证据请求尚未返回，用户从会话 A 切换到 B
- **THEN** 旧结果不注入 B；用户须明确重新绑定，A 的内容不跨会话泄露

### Requirement: 响应式和无障碍不得裁掉能力
界面 MUST 覆盖 design 的状态矩阵和360/560/960px、zh/en/pseudo、长标题与200%缩放；核心路径全键盘可用，焦点可恢复，reduced-motion 和44px触控目标生效。

#### Scenario: 窄屏对照
- **WHEN** Pane 宽度不超过420px
- **THEN** 两侧上下排列且指标说明、证据、返回和提问仍可操作，不隐藏能力
