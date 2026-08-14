# dsh-ordo-command-interaction-v1

[English](README.md) | 中文

DSH 侧 `ordo` slash 命令交互面：read 子命令 + preview-before-mutate 的 gated action 子命令。

- [proposal.md](proposal.md)：Why / What Changes / 能力账本 / 首切片 / non-goals / impact。
- [design.md](design.md)：单命令语法、注册归属、read 四段式、action preview→CAS→receipt 状态机、popup/面板联动。
- [tasks.md](tasks.md)：commands-core / commands-actions / client-ux / verify 四 lane。
- [specs/dsh-ordo-command-surface/spec.md](specs/dsh-ordo-command-surface/spec.md)：host 命令合同（注册/语法/read/action/安全文本）。
- [specs/dsh-ordo-command-ux/spec.md](specs/dsh-ordo-command-ux/spec.md)：发现、popup、结果渲染、面板联动与 a11y。

数据源依赖：

- `openspec/changes/ordo-dsh-plugin-visualization-v1/`（snapshot remote、状态词汇表、action 分期）
- `openspec/changes/dsh-agent-composition-preview-v1/`（组合投影与资质）

Ordo 侧无新合同；qualify 远端动作面留待 `agent/ordo/openspec/changes/ordo-agent-qualification-v1/` 后续切片。
