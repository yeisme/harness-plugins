# agent-interaction-space Specification

(merged from archived change 2026-08-29-dsh-agent-interaction-space-v1)

## Purpose

定义 DSH 中以 Pane 承载的 Agent 交互空间、锚点、typed directive、审批与 owner receipt 边界，确保交互不会创建第二套布局、会话或领域状态权威。

## Requirements

### Requirement: 交互空间 SHALL 是 pane view 而非新侧栏
`interaction.space` view SHALL 注册进 pane-workbench（resourceKey `space:<owner>:<ref>@<version>`，retention snapshot），SHALL NOT 创建第二侧栏、第二布局 owner 或复制桌面工作台结构。同一工件 SHALL 支持从预览 view 升级为空间 view，预览 view 保留。

#### Scenario: 从预览升级为交互空间
- **WHEN** 用户在 `desktop.media` 预览某 CSV 并选择「升级为交互空间」
- **THEN** SHALL 打开 `interaction.space` view 且 resourceKey 指向同一工件
- **AND** 预览 view 与其布局 SHALL 不被删除

#### Scenario: 空间关闭重开
- **WHEN** 空间 view 关闭时存在审批中的提案
- **THEN** 重开后提案与审批状态 SHALL 从 snapshot 恢复

### Requirement: 锚点 SHALL 扩展 table-range 且不伪造坐标
`SelectionAnchorV1` SHALL additive 支持 `table-range`（sheetId 与单调行/列区间 + digest）；锚点 SHALL 存数据坐标（owner 行键/绝对行列），SHALL NOT 存视口坐标。渲染器无映射提示时 SHALL 降级 `dom-region` + `unmappedReason`，SHALL NOT 伪造行列号或坐标。

#### Scenario: 网格选区→锚点
- **WHEN** 用户在分页网格中选中 B3:D7
- **THEN** 锚点 SHALL 记录绝对行列区间与 digest
- **AND** 翻页或重开后同一锚点 SHALL 指向相同数据区域

#### Scenario: 无法映射的选区
- **WHEN** 选区所在渲染器无 `data-source-*` 提示
- **THEN** 锚点 SHALL 为 `dom-region` 并带 `unmappedReason`

### Requirement: 空间内对话 SHALL 保持主选择不变量
空间内 agent 对话 SHALL 只经 `ISessions.binding`（prompt/steer/queue/cancel）与 `fork`；SHALL NOT 调用 `open()/openSubagent()/clear()`，controller SHALL 不持有这些方法引用并以测试钉死。

#### Scenario: 空间内附着会话
- **WHEN** 用户在空间内 attach/fork 一个 session 并发送消息
- **THEN** 附着 session SHALL 收到 prompt
- **AND** 主对话区 current selection SHALL 保持不变

#### Scenario: sessions seam 缺席
- **WHEN** `ISessions.binding/fork` 不可用
- **THEN** 对话层 SHALL 显示 needs_contract
- **AND** 锚点栏与提案层 SHALL 不受影响

### Requirement: agent SHALL 只经 typed directive 驱动空间
agent→空间交互 SHALL 只走 `space/ref` typed directive（focus/highlight/propose/request-input/progress）；SHALL NOT 获得 DOM 操作能力。unknown kind、越界 anchor、超预算载荷 SHALL 丢弃并显示 typed 原因；高频 highlight/focus SHALL 节流合并。

#### Scenario: proposal directive
- **WHEN** agent 发出 `space.propose`（typed patch）
- **THEN** 空间 SHALL 渲染提案卡与 diff 投影并进入审批
- **AND** 渲染内容 SHALL 由空间决定而非 agent 载荷直接注入

#### Scenario: 非法 directive
- **WHEN** directive 校验失败（unknown kind 或引用不存在的锚点）
- **THEN** 该 directive SHALL 被丢弃
- **AND** 时间线 SHALL 显示 typed 丢弃原因

### Requirement: 提案应用 SHALL preview-before-mutate 且 receipt 回写
提案应用 SHALL 经 owner adapter dispatch（snapshot freshness 校验→descriptor 匹配→dispatch），receipt SHALL 回写空间时间线；unknown/partial/stale SHALL 要求 reconcile 且不自动重试。无 owner adapter 时 SHALL 降级为只读 diff 与复制 patch 文本出口。

#### Scenario: 应用成功
- **WHEN** 审批通过且 dispatch 返回 receipt
- **THEN** 时间线 SHALL 记录 receipt
- **AND** 工件 version bump 后空间 SHALL 重渲染

#### Scenario: owner adapter 缺席
- **WHEN** 工件 owner 未提供 dispatch adapter
- **THEN** 应用按钮 SHALL 禁用并给出 `owner-adapter-unavailable`
- **AND** diff 与复制出口 SHALL 可用

### Requirement: 版本围栏与预算 SHALL 强制
锚点与提案 SHALL 携带工件 version；version bump 后 digest 校验失败的锚点 SHALL 标记 `drifted` 并要求协调。空间 SHALL 施加预算：锚点 ≤200、directive 时间线 ≤200 条滚动、diff 载荷 ≤256KB、活跃提案 ≤16。

#### Scenario: 锚点漂移
- **WHEN** 工件更新后锚点 digest 不匹配
- **THEN** 锚点 SHALL 显示 drifted
- **AND** 依赖该锚点的提案 SHALL 阻断应用直至协调

#### Scenario: 时间线滚动
- **WHEN** directive 数超过 200
- **THEN** 最早条目 SHALL 滚出
- **AND** 最新 200 条 SHALL 保持可见
