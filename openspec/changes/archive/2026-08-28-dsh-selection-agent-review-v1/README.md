# dsh-selection-agent-review-v1

文本选区、页面截图与桌面截图统一为可锚定的 Agent 协作对象：任意位置提问/
评论/要求修改，逐位置批准 Agent 变更建议，版本围栏应用 + owner receipt。

- Owner 决策：`split-owner`（见 proposal.md 与 docs/design）。
- 合同：`specs/dsh-selection-agent-review/spec.md`（ADDED-only，13 条
  requirement）。
- 交付：`@yeisme/dsh-selection-host`（合同+内存参考实现）、
  `@yeisme/dsh-client-ui-selection-annotation`（交互）、
  `@yeisme/dsh-selection-annotation`（bundle）。
- V1 不含：系统窗口/完整桌面截图（Desktop Client owner）、评论跨会话恢复
  （V2 committed）、多人实时协作（exploratory）、无审批自动修改（rejected）。

安装：`dsh plugin --profile web add @yeisme/dsh-selection-annotation`。
