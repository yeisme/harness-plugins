# dsh-agent-composition-preview-v1

[English](README.md) | 中文

DSH 侧实现规格：Agent 组合事实投影与只读 Agent Preview（根 handoff：`openspec/changes/agent-composition-preview-v1/`）。

- [proposal.md](proposal.md)：Why / What Changes / DSH owner 切片 / 能力账本 / 首切片 / non-goals / impact。
- [design.md](design.md)：`AgentCompositionPreview` service、digest 规范、三层 health、CLI、picker 面板、lineage、失败注册表。
- [tasks.md](tasks.md)：projection-core / cli-surface / client-ui / verify 四 lane。
- [specs/dsh-composition-projection/spec.md](specs/dsh-composition-projection/spec.md)：投影 service、envelope、smoke 与 lineage 合同。
- [specs/dsh-agent-preview-experience/spec.md](specs/dsh-agent-preview-experience/spec.md)：picker Preview、maturity 槽位与 ToolView 合同。

消费方：`agent/ordo/openspec/changes/ordo-agent-qualification-v1/`。
