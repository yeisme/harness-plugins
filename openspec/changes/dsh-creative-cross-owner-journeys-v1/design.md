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

## 已编写的场景与故障矩阵

[正式矩阵](../../../docs/qa/dsh-creative-studio-journeys.md)覆盖五个专业路径、一个跨领域路径、续接与性能，以及12项故障演练。当前全部未运行；不得从文档推导成功索引。任务1.1/1.2只交付设计，2.x执行和3.1真实证据索引保持未完成。

综合真实验收必须覆盖五个专业正常/恢复路径加至少一个跨领域制作闭环；允许引用同环境/版本/范围下的成员直接证据，避免重复收费调用。不能以任意两个owner通过替代全部required范围。每个专业Pane可独立晋级；综合change不反向阻塞其发布。

本change不创建UI、测试框架或运行时。无UI Contract例外；消费成员已验证的UI并检查组合路径。provider确认缺口由成员/owner change修复，本change仅引用配套任务，禁止局部绕过。
