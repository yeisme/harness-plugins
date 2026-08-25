## Why

DSH 的 Agent Preset 决定一个会话的全部模型可见面（工具 schema、prompt sections、投影单元、权限档），但今天的 preset 健康检查只证明「shape 合法」（loader 方言可解析、有 named rows）。`mount()` 对 unscoped target、不可用 row、root-realm service 的拒绝只发生在会话创建时；`trust` 字段仅作展示；copy 出的 preset 没有 lineage，漂移不可见。用户在新建会话的 picker 里无法确定性回答三个问题：**这个 preset 实际 mount 出什么？它能干什么、权限多大？它是否经过真实 mount 证明？**

根 handoff `openspec/changes/agent-composition-preview-v1/` 已冻结 split-owner：组合事实属于 DSH，风险/成熟度/资质纪律属于 Ordo。本 change 是 DSH 侧实现规格：产出 mount 级的组合事实投影（带 digest），在 picker 提供只读 Agent Preview，并暴露机器可消费的 `dsh composition preview/smoke` 命令供 Ordo `agent preview` / `agent qualify` 消费。本 change 不做风险判断、不发 qualified、不建资质账本。

## What Changes

- 新增 `AgentCompositionPreview` service：复用 `ctx.agentPresets.standingKeyFor(id)` 与 `dsh-tools` / `dsh-system-prompt` / `dsh-scope` / permission-presets registries，在**无 agent、无 session、无 turn** 的前提下投影一个 preset 的 tools（name + schema digest + source）、prompt sections（id + section digest + source）、projection units、权限档与 capability digest，并输出三层 health（shape_ok / mount_ok / provable_mount_ref）与 drift/lineage。
- 新增机器命令 `dsh composition preview --preset <id> --json`：输出 `dsh.composition.preview.v0` envelope（`ordo.agent_composition.preview.v0` 的 composition/preset/health 段事实），供 Ordo 通过受审 adapter 消费。
- 新增 keyless 冒烟命令 `dsh composition smoke --preset <id> --json`：在真实进程里 boot + mount + 投影 + dispose，不调模型、不产生 token 成本；供 Ordo protected canary 证明「真实 mount」。
- 扩展 `packages/client/ui-agent-preset`：preset 选择器增加只读 Preview 面板（工具/权限/健康/drift/maturity 槽位，maturity 槽位只在 Ordo 投影可用时显示）与 ToolView 展示。
- `copy()` 增加 additive lineage 记录（copy 时冻结 source id 与 source 组合 digest），投影据此报告 drift；不自动覆盖用户 copy。

## Admission Decision

结论：`fit`（DSH owner 切片）。本 change 只拥有根 handoff 中属于 DSH 的行：组合事实投影、preview UI、机器命令与 lineage。风险分类、四维成熟度、qualified 状态与 effectiveness ledger 不属于 DSH，本 change 不实现、不自证。

## Required Capability Ledger（DSH 行）

| 能力 | 状态 | Canonical owner | 可见宿主 | 交付切片 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| 组合事实投影（mount 级、带 digest） | required | DSH | DSH / Ordo | deliver-now | 同一 preset 投影 digest 与 standing mount registrations 一致 |
| 三层 health（shape/mount/provable） | required | DSH | DSH / Ordo | deliver-now | broken row、不可解析 row 分别得到 typed 结果 |
| drift / lineage | required | DSH | DSH / Ordo | deliver-now | copy 与 source digest 差异可见且不自动修正 |
| `dsh composition preview --json` 机器命令 | required | DSH | Ordo adapter | deliver-now | envelope 通过 `dsh.composition.preview.v0` schema 校验 |
| `dsh composition smoke` keyless 冒烟 | required | DSH | Ordo canary | deliver-now | 真实进程 mount + dispose，无模型调用、无 token 成本 |
| picker 只读 Preview 面板 + ToolView | required | DSH | DSH Web | deliver-now | 无 agent/session/turn；redaction 与 a11y 证据齐全 |
| 模型可见 `agent_preview` 工具 | retained | DSH | DSH 会话 | retain-next | 若实现必须满足 model-visible ⟺ logged 并新增 session event |

## Narrow First Delivery Slice

1. `AgentCompositionPreview.project(id)`：无会话投影 + digests + 三层 health + drift。
2. `dsh composition preview --preset <id> --json` 与 `dsh composition smoke --preset <id> --json`。
3. picker 只读 Preview 面板（工具、权限、健康、drift、maturity 槽位占位）。
4. `copy()` lineage 记录（additive，旧 copy 无 lineage 时 drift 显示 `unknown`）。
5. 不做模型可见工具、不做 Ordo 数据回填、不做 bundle pack（属 harness-plugins retain-next）。

## Non-Goals

- 不判断风险、不发 qualified、不建 effectiveness ledger（Ordo owner）。
- 不 fork core，不读私有 React store；只用公开 seam（`agentPresets`、registries、`dsh.client`、slot、ToolView、CLI app）。
- 不在投影中输出 raw prompt 文本、完整 tool schema 正文、private tool args、absolute host path、PID 或 credential。
- 不自动覆盖、回滚或重建用户 copy；drift 只报告。
- 不改 `agent-presets` 现有 mounting/generation/blank-switch 语义；projection 是纯读消费方。

## Impact

- 依赖根 handoff：`../../../../openspec/changes/agent-composition-preview-v1/`。
- Ordo 消费方：`agent/ordo/openspec/changes/ordo-agent-qualification-v1/`。
- 涉及包：新 `packages/preset/agent-composition-preview/`、`packages/client/ui-agent-preset/`（additive）、`apps/cli/`（两命令）、`packages/preset/agent-presets/`（`copy()` lineage）。
- 本 change 不修改 Ordo/Workbench canonical 代码，不 commit/push/publish/deploy。
