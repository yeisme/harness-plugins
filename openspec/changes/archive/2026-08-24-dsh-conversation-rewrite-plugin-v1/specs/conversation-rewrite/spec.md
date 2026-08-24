## ADDED Requirements

### Requirement: 用户消息 SHALL 通过 user-actions slot 提供 Edit 入口
`@yeisme/dsh-client-ui-conversation-rewrite` SHALL 在 `conversation.chat.user-actions` slot 上注册 Edit 动作；该 slot SHALL 由 `client/deepseek-harness` 以 additive seam 方式提供。Edit 入口 SHALL 只在已发送且可寻址的用户消息上显示，且 MUST NOT 出现在 pending steering、上下文注入或未知 surface 节点。

#### Scenario: 用户气泡出现 Edit 按钮
- **WHEN** DSH Web 渲染一条已发送用户消息
- **AND** `conversation.chat.user-actions` slot 已注册
- **THEN** 用户气泡 SHALL 显示 Edit 动作
- **AND** 点击后 SHALL 进入内联编辑状态

#### Scenario: 非用户节点不显示 Edit
- **WHEN** 当前节点是 Assistant、context、compaction 或 unknown 节点
- **THEN** SHALL 不显示用户消息 Edit 动作

### Requirement: Edit SHALL 以分支派生而非原地改写执行
保存编辑后，插件 SHALL 在目标用户消息之前的稳定边界派生 child session，再通过 `session.prompt` 提交编辑后内容；MUST NOT 修改已存在的 `SessionEvent`、替换旧消息或删除后续历史。

#### Scenario: 编辑非首轮用户消息
- **WHEN** 用户编辑一条非首轮用户消息并保存
- **THEN** 插件 SHALL 在最近的前置 `turn/end` 处 fork child
- **AND** child SHALL 使用编辑后内容作为新用户消息
- **AND** 原会话 SHALL 保持原样

#### Scenario: 编辑首轮用户消息
- **WHEN** 目标用户消息之前不存在 `turn/end`
- **THEN** 若 `session.forkBeforeMessage` 可用，SHALL 创建 `seedLength: 0` 的 child 并提交编辑后内容
- **AND** 若该 RPC 不可用，SHALL 禁用 Edit 并显示可理解的原因，MUST NOT 静默截断为“包含旧回答的分支”

### Requirement: Retry SHALL 以分支派生重发原用户 prompt
Assistant 消息动作条 SHALL 提供 Retry 动作；点击后 SHALL 定位触发该回答的用户 prompt，在该 prompt 之前的前置 `turn/end` 派生 child，并重发原 user content。父会话 MUST NOT 被替换。

#### Scenario: 重试非首轮 Assistant 回答
- **WHEN** 用户点击历史 Assistant 回答的 Retry
- **THEN** 插件 SHALL 创建 child
- **AND** child SHALL 只继承该轮次之前的稳定历史
- **AND** child SHALL 重发原用户 prompt
- **AND** 父会话 SHALL 保持原样

#### Scenario: 重试不可用状态
- **WHEN** 目标轮次仍在运行
- **OR** 找不到可安全重发的用户 prompt
- **OR** session 已归档/删除
- **THEN** Retry SHALL 禁用或返回 typed error，MUST NOT 自动重试未知/partial/stale 状态

### Requirement: Branch/Edit/Retry SHALL 共享统一分支派生语义
三个动作 SHALL 使用同一套 child 打开、标题继承、错误收敛和会话列表对账逻辑，避免各自实现不同边界语义。

#### Scenario: 三个动作产生可对比 child
- **WHEN** 用户分别执行 Branch、Edit、Retry
- **THEN** 每个动作 SHALL 生成带 `parentSession` 谱系的 child
- **AND** child SHALL 出现在会话列表中且可独立打开
- **AND** child 标题 SHALL 按既有 fork 标题递增规则处理

### Requirement: 插件 SHALL 保持 effect-scoped 生命周期
所有 slot 注册、controller 和事件订阅 SHALL 在插件卸载时 dispose；组件 MUST NOT 在卸载后提交 mutation 或更新状态。

#### Scenario: 插件热卸载
- **WHEN** 包含 `dsh-conversation-rewrite` 的 bundle 被卸载
- **THEN** Edit/Retry 按钮 SHALL 从界面消失
- **AND** 已创建的 controller SHALL dispose
- **AND** 未完成的 mutation SHALL 以 settled error 结束，不产生幽灵 pending

### Requirement: 实现 SHALL 不复制 DSH core 私有实现
`@yeisme/dsh-conversation-rewrite` 与 `@yeisme/dsh-client-ui-conversation-rewrite` SHALL 只通过公开 `@deepseek-ai/dsh-*` surface 和本项目声明的 additive seam 工作，MUST NOT import DSH core 内部模块、私有 DOM patch 或未发布 API。

#### Scenario: source-independence 扫描
- **WHEN** 扫描 source/manifest/build output
- **THEN** SHALL 不包含 DSH core 私有 import、私有 slot 假设或对内部 DOM 结构的依赖
