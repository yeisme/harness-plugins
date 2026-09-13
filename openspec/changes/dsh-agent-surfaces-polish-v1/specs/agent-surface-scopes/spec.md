## ADDED Requirements

### Requirement: Session subagents SHALL preserve session scope

系统 SHALL 满足以下行为：会话 Tab 必须固定其所在会话，并显示真实子会话父子关系、状态及来源提供的指标。搜索、筛选与选择不得切换主会话。

#### Scenario: Two sessions remain isolated
- **WHEN** 并排会话 A 与 B 各自打开 Subagents，A 的读取或跟进晚于对象切换返回
- **THEN** B 的选区、草稿和反馈不变，返回结果仅对应原始目标

### Requirement: Subagent detail SHALL share the visible workspace

系统 SHALL 满足以下行为：树列表与详情必须在同一工作区域布局，宽容器顶部对齐，窄容器切换并提供返回入口。长名称、筛选无结果、无子会话与 API 不可用必须有明确呈现。

#### Scenario: One inactive subagent
- **WHEN** 打开仅有一个未活动子会话的 Tab 并选择该子会话
- **THEN** 详情靠近列表顶部，行内信息左对齐，显示真实状态而非成功或失败推断

### Requirement: Agent Team SHALL use user workspace navigation

系统 SHALL 满足以下行为：Agent Team Pane 必须列出本机用户配置的 Ordo 项目，项目内展示团队、计划、运行及依赖视图。Pane 不依赖当前聊天，项目与操作目标不能随聊天改变。

#### Scenario: Open without a current session
- **WHEN** 用户没有选择聊天而打开 Agent Team
- **THEN** 可以读取注册项目并显式进入项目；不会读取或推断任意聊天关联

### Requirement: Agent surfaces SHALL preserve owner actions and compatibility

系统 SHALL 满足以下行为：保留既有 Pane kind 与命令；新入口消费原 owner 合同，不生成第二份团队账本。离线、未知或未配置能力必须显示原因并限制动作。

#### Scenario: Runtime remains unavailable
- **WHEN** Ordo 尚未发布可执行启动能力
- **THEN** 美化后的 Team Pane 继续显示禁用原因，不把 UI 操作当成真实启动

### Requirement: Agent surfaces SHALL provide accessible visual navigation

系统 SHALL 满足以下行为：搜索、筛选、树操作、详情与返回必须有中英标签和键盘路径，在 360/560/960px 下无横向溢出。新事件不得移动阅读位置或抢焦点。

#### Scenario: Keyboard opens and returns from detail
- **WHEN** 用户以键盘选择树节点并返回
- **THEN** 详情标题和原节点分别接收焦点，草稿不丢失
