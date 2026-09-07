## Context

依据 2026-09-07 创作台程序。五个专业 Pane 各自独立交付；组合验收只验证跨 owner 行为一致，不重复单 owner 验收。

## Goals / Non-Goals

目标：定义并执行代表性完整旅程与故障恢复演练，形成证据索引与真实 readiness。

不做新实现、不为旅程改 owner 合同、不把单 owner fixture 当组合证据。

## Decisions

1. 旅程矩阵以程序 §1 能力行与 §3 工作流语法为源；每条旅程列出成员 change、必备 owner capability 与断言点。
2. 故障演练至少覆盖：上游修改、版本冲突、保存 unknown、订阅 gap/迟到事件、seam 缺席、Pane 禁用与重装、项目/会话切换中的迟到结果。
3. 组合断言点：scope 身份不串线（project/session/node ref/revision 冻结）、已确认保存零丢失、禁用 Pane 不删项目草稿、unknown 只对账。
4. 证据引用成员 change 的 run-id；本 change 不新建证据类型，复用现有 evidence runner 六件套。
5. readiness 按旅程行分别标注：未执行/fixture/real；real 需真实 owner capability 在场。
6. 性能样本沿用合同 §6（300 节点固定样本、60 分钟无泄漏）只在真实旅程执行，不作为规格交付前置。

## UI Contract

本 change 无新 UI；矩阵与索引为文档交付物。旅程断言中涉及的 UI 行为由成员 change 的 UI Contract 约束。

## Validation

矩阵文档过 doc 结构检查；旅程执行任务用现有 runner 产出六件套并脱敏。规格任务只验证矩阵、链接与文档一致性，不运行真实模型或媒体生成。
