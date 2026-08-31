# next-step-suggestions Specification

## Purpose
TBD - created by archiving change dsh-next-step-suggestions-v1. Update Purpose after archive.
## Requirements
### Requirement: 建议 SHALL 在 composer dock 渲染为可点击 chips
当会话存在至少一个下一步建议时，Web composer SHALL 在 `conversation.input.dock` 渲染建议 chips；无建议时 SHALL 不渲染任何建议区域。每个 chip SHALL 显示安全 label，并 MAY 显示推荐徽标。

#### Scenario: 有建议时显示 chips
- **WHEN** 会话存在 `plan-options` projection 或其他已注册建议来源
- **THEN** composer 上方 SHALL 渲染建议 chips
- **AND** 每个 chip SHALL 显示 `label`
- **AND** 推荐项 SHALL 显示推荐徽标

#### Scenario: 无建议时零布局
- **WHEN** 会话不存在任何建议来源
- **THEN** 建议区域 SHALL 渲染为空
- **AND** 不占用 composer 布局空间

### Requirement: 点击建议 SHALL 只写入 composer draft，不执行
点击建议 chip SHALL 通过 `inputActions.setDraft()` 写入草稿；SHALL NOT 调用 `submit()`、`command.execute()` 或 `session.prompt()`。空草稿 SHALL 替换为建议 prompt；非空草稿 SHALL 默认在新行追加。

#### Scenario: 空草稿点击
- **WHEN** 用户点击建议且当前草稿为空
- **THEN** `setDraft(suggestion.prompt)` SHALL 被调用
- **AND** 消息 SHALL NOT 被发送

#### Scenario: 非空草稿点击
- **WHEN** 用户点击建议且当前草稿非空
- **THEN** `setDraft(current + "\n" + suggestion.prompt)` SHALL 被调用
- **AND** 消息 SHALL NOT 被发送

### Requirement: 多选与并行组合 SHALL 由纯函数生成提示词
用户 SHALL 能选择多个建议；选择后 SHALL 能按顺序追加到草稿，或生成“并行执行”组合提示词。非 `parallelSafe` 建议在并行模式 SHALL 被禁用。

#### Scenario: 多选追加
- **WHEN** 用户启用多选并选择多个建议
- **AND** 点击「应用到输入框」
- **THEN** 所有选中建议的 prompt SHALL 按选择顺序追加到草稿
- **AND** 消息 SHALL NOT 被发送

#### Scenario: 多选并行
- **WHEN** 用户启用多选并选择多个 `parallelSafe` 建议
- **AND** 点击「并行执行」
- **THEN** 草稿 SHALL 写入包含所有选中方案标题与 prompt 的并行执行提示词
- **AND** 消息 SHALL NOT 被发送

#### Scenario: 非并行安全建议禁用
- **WHEN** 用户启用并行模式
- **AND** 某建议的 `parallelSafe` 为 false
- **THEN** 该建议 chip SHALL 被禁用
- **AND** 无法被选入并行组合

### Requirement: plan-options 来源 SHALL 转换为建议
当 `plan-options` projection 存在且状态为 `proposed` 时，每个 `PlanOption` SHALL 转换为一个 suggestion；prompt SHALL 是有效的 plan 选择命令或等价自然语言指令，并保留 plan/option 标识用于并行组合。

#### Scenario: plan-options 转建议
- **WHEN** `plan-options` 投影存在且 `status` 为 `proposed`
- **THEN** 每个 option SHALL 生成一个建议 chip
- **AND** chip label SHALL 为 option title
- **AND** prompt SHALL 包含 `optionId`
- **AND** 推荐 option SHALL 标记为推荐

#### Scenario: 非 proposed 状态不显示
- **WHEN** `plan-options` 投影缺失
- **OR** `status` 为 `selected` 或 `superseded`
- **THEN** 不生成 plan-options 建议

### Requirement: 建议数据 SHALL 保持安全与可访问
建议只携带安全展示文本和 prompt；SHALL NOT 携带 raw path、secret、provider payload 或完整思维链。建议组 SHALL 支持键盘操作，并使用 `aria-pressed` 表达多选状态；多选应用后焦点 SHALL 返回 composer textarea。

#### Scenario: 安全投影
- **WHEN** 建议来源返回数据
- **THEN** 客户端只消费 `label`、`prompt`、来源标识、顺序和 `parallelSafe`
- **AND** 不渲染 raw path、secret、provider payload

#### Scenario: 键盘可访问
- **WHEN** 用户使用键盘聚焦建议 chip
- **THEN** Enter/Space SHALL 触发与鼠标点击相同的动作
- **AND** 多选状态 SHALL 通过 `aria-pressed` 暴露
- **AND** 应用多选后焦点 SHALL 返回 composer textarea

### Requirement: 实现 SHALL 不复制 DSH core 私有实现
`@yeisme/dsh-next-step-suggestions` 与 `@yeisme/dsh-client-ui-next-step-suggestions` SHALL 只通过公开 `@deepseek-ai/dsh-*` surface 工作，MUST NOT import DSH core 内部模块、私有 DOM patch 或未发布 API。

#### Scenario: source-independence 扫描
- **WHEN** 扫描 source/manifest/build output
- **THEN** SHALL 不包含 DSH core 私有 import、私有 slot 假设或对内部 DOM 结构的依赖

### Requirement: 完成态 fallback 提供 Conversation recap 与三项建议

当当前 Session 不在 running、没有 pending interaction、存在已完成 turn，且 Plan/client source 没有更具体建议时，Web dock SHALL 从该 turn 的 finalized assistant text 生成有界 Conversation recap，并 SHALL 展示恰好三项通用建议。recap SHALL NOT 包含 raw reasoning、tool payload 或 provider payload。

#### Scenario: 普通 Agent 轮次完成且没有具体 source
- **WHEN** 最近 turn 已完成、Session idle 且合并后的 Plan/client suggestions 为空
- **THEN** dock SHALL 显示 Conversation recap 和三项 fallback chips
- **AND** 点击或批量应用 SHALL 只更新 Composer draft，不自动发送

#### Scenario: 存在 owner 具体建议
- **WHEN** Plan projection 或 client source 提供至少一项建议
- **THEN** dock SHALL 优先显示这些具体建议
- **AND** SHALL NOT 混入通用 completion fallback

### Requirement: 多选建议支持可退出的键盘轮转

多选模式 SHALL 支持 Tab/Shift+Tab 与 ArrowLeft/ArrowRight 在可用 chips 间取模轮转；Escape SHALL 清空 selection 并退出多选。单选模式 SHALL 保持浏览器原生 Tab 导航。

#### Scenario: 多选键盘轮转
- **WHEN** 多选已启用且焦点位于任一 suggestion chip
- **THEN** Tab/ArrowRight SHALL 聚焦下一项，Shift+Tab/ArrowLeft SHALL 聚焦上一项，并在首尾取模

#### Scenario: Escape 退出多选
- **WHEN** 多选模式中用户按 Escape
- **THEN** dock SHALL 清空已选建议、退出多选并保留当前 Composer draft
