---
name: grill-me
description: Use when the user explicitly asks for a high-intensity, dependency-aware interview to stress-test a product, business, technical, writing, or general plan before planning or implementation; route drama, novel, story, adaptation, and creative-production ideas to creative-grill-me when available.
---

# Grill Me

通过分轮追问把模糊方案变成用户真正做出的决策。只有用户明确说 `$grill-me`、质询、挑战、压力测试、逐问或等价表达时运行；普通 PRD、架构或实现请求不得隐式启动。

## 责任边界

- 事实由 Agent 查：仓库现状、文件、现有合同、官方文档和可验证环境信息。
- 决策由用户做：目标、范围、风险、优先级、体验、成本和停止条件。
- 未经当前用户明确授权，不创建子 Agent；可查事实由当前 Agent 内联完成。
- 默认不写文件、不修改代码、不进入实现。用户确认达成共同理解后，仍需单独授权后续动作。
- 漫剧、小说、故事、改编或创作生产优先使用 `$creative-grill-me`，不要同时运行两个主访谈流程。

## 决策树与 Frontier

把主题维护为一棵概念性的决策树。每个决策可以解锁后续决策；`frontier` 是所有前置条件已经确定、当前可以诚实回答的问题集合。

按轮工作：

1. 根据现有上下文重建决策树。
2. 只提出当前 frontier 中彼此不依赖的问题。
3. 每个问题给出一个可反驳的推荐答案。
4. 等待用户回答整轮，不替用户做决定。
5. 用新答案重算 frontier，再进入下一轮。

同一轮中，如果问题 B 的答案依赖问题 A，就只问 A，把 B 留到下一轮。

## 提问格式

```text
❓ Q1 - <问题标题>：<问题正文和必要选项>

➡️ <推荐答案及简短理由>

---

❓ Q2 - <问题标题>：<问题正文和必要选项>

➡️ <推荐答案及简短理由>
```

问题应允许用户按编号回答。推荐答案是待挑战立场，不是代替用户决定。

## 范围控制

- 用户说“不知道”是有效答案。若问题需要真实使用、视觉感受或运行证据才能判断，停止纯讨论，建议先做可丢弃 prototype、调研或实验。
- 会话过长时先缩小主题，再继续子问题；不要用固定问题数量制造虚假完整性。
- 用户明确要求收尾时，总结已确定决策、未决问题、验证缺口和下一步，不继续扩张树。
- 不因用户连续同意推荐答案就假设理解充分；必要时用反例或失败路径验证关键选择。

## 完成条件

只有同时满足以下条件才结束：

1. 当前决策树的 frontier 为空，或剩余问题已明确转为调研、prototype、实验或延期项。
2. 用户确认双方已经达成共同理解。

结束时在对话中给出精简决策摘要：结论、关键选择、非目标、风险、验证缺口和建议下一步。除非用户明确要求保存，否则不创建文档。

## 来源

本 Skill 是 Yeisme 维护的自包含适配，吸收 Matt Pocock `grill-me` / `grilling` 的 design tree、frontier 和 round 机制，并调整为 Yeisme 的显式调用、权限和无自动实现边界。维护来源与差异见 [references/upstream.md](references/upstream.md)。
