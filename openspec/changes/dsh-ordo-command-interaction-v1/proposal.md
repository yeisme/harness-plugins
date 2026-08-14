## Why

Ordo 的事实面（run/task/approval/qualification/evidence）已有两个消费路径：DSH 侧栏 Agent Ops 面板（`ordo-dsh-plugin-visualization-v1`）与 Workbench Studio，以及我们刚冻结的组合预览/资质（`dsh-agent-composition-preview-v1`）。但对话中的高频操作没有命令入口：用户想「看当前 run」「预览一个 preset」「触发资质」「处理 reconcile」时，必须离开输入行去点面板。

DSH 的 `dsh-commands` 是官方 human-command 缝：单名命令 + 自有语法 + `command/run|done` 生命周期事件 + 结果永不进模型；`ui-commands` 提供 fuzzy 发现、`leadingInput` 参数提示与 popup 贡献（`decorate`/`popupSelect`）。本 change 为 Ordo 设计一个 `ordo` slash 命令面：**read 子命令直接返回安全摘要，action 子命令一律 preview-before-mutate**，复用已冻结的 `ordo.agent_ops.*` 状态词汇表、reason codes 与 `harness.action.v1alpha1` 分阶段动作，把对话输入行变成 Ordo 事实与动作的类型化入口，同时不建第二调度器、不绕过 owner 动作门。

## What Changes

- 新增 `packages/host/ordo-commands`：注册单一 `ordo` host 命令（registry 只支持单名，子命令语法由插件自有），仅在至少一个数据源（`ordoAgentOps` snapshot remote 或 `agentCompositionPreview`）已 mount 时注册。
- 子命令分类：
  - **read**：`/ordo`（摘要）、`/ordo status [<run-ref>]`、`/ordo preview <preset-id>`、`/ordo approvals`、`/ordo evidence <ref>`、`/ordo capacity`、`/ordo help [<sub>]`。
  - **action**：`/ordo qualify <preset-id>`、`/ordo reconcile <run-ref>`、`/ordo approve <decision-ref>`；`/ordo run launch|cancel|redispatch` 为 retain-next，durable reservation 前一律返回 typed `not_available`。
- 交互合同：action 一律先返回 exact target/effect/owner/expiry 的 preview，`approve` 以 server-minted `decision-ref` 做 CAS；digest/context revision 漂移即 stale。V1 只有 `reconcile` 有已开放远端动作（`ordo.reconcile.request`）；`qualify` 在 Ordo 动作面开放前退化为 preview + 精确 owner CLI 行（`ordo agent qualify <preset> --approve --events`）。
- Client：`ui-ordo-agent-ops` 通过 `CommandUiContract.decorate('ordo', spec)` 提供裸调用 popup 菜单；监听 `command/executed` 联动打开/聚焦 Agent Ops 面板；面板内「以命令运行」popup 提交精确行。
- 错误与状态全部复用 `ordo-dsh-plugin-visualization-v1` 冻结的状态词汇表与 reason codes；结果文本只含安全摘要、refs 与一个 next action。

## Admission Decision

结论：`fit`（DSH owner 切片）。命令语法、生命周期与 UI 渲染属于 DSH；命令背后的 canonical 事实与动作资格仍属于 Ordo（经既有 projection/action 合同）。DSH 不得从命令结果推导或改变任何 run/task/lease/approval/qualification 状态。

## Required Capability Ledger

| 能力 | 状态 | Canonical owner | 可见宿主 | 交付切片 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| `ordo` host 命令与子命令语法 | required | DSH | DSH Web | deliver-now | 合法/非法 ref 的语法正负测试；未知子命令 typed error |
| read 子命令（status/preview/approvals/evidence/capacity/help） | required | DSH | DSH Web | deliver-now | 结果与 snapshot remote 语义一致；owner 不可用显示 needs_contract |
| action preview-before-mutate 与 `approve` CAS | required | DSH | DSH Web | deliver-now | digest/context 漂移拒绝；无 preview 不得 mutate |
| `reconcile` typed dispatch | required | DSH | DSH Web | deliver-now（仅 owner 动作面已开放） | 复用 `ordo.reconcile.request`，unknown 只 reconcile |
| `qualify` preview + 精确 CLI 行 handoff | required | DSH | DSH Web | deliver-now | 动作面开放前不伪造远端调用 |
| popup 菜单 / 面板联动 / result 渲染 a11y | required | DSH | DSH Web | deliver-now | keyboard/focus/screen reader/reduced motion 证据 |
| `/ordo run launch|cancel|redispatch` | retained | DSH + Ordo | DSH Web | retain-next | durable reservation 验收前一律 `not_available` |
| 模型可见 `ordo` 工具 | retained | DSH | DSH 会话 | retain-next | 若实现需独立 session event（model-visible ⟺ logged） |

## Narrow First Delivery Slice

1. `ordo` 命令注册 + 语法校验 + `help` / 摘要 / `status` / `preview` / `capacity` read 子命令。
2. `qualify` 与 `reconcile` 的 preview-before-mutate 流 + `approve <decision-ref>` CAS。
3. `decorate('ordo')` popup 菜单 + `command/executed` 面板联动 + 结果渲染 a11y。
4. `run launch|cancel|redispatch` 注册为禁用态（typed `not_available`），不隐藏。

## Non-Goals

- 不建第二调度器/lease/资质账本；不改 Ordo canonical 状态；不从命令结果推导状态。
- 不解释任意 shell、URL、executable、env 或 host path；args 只接受安全 ref 模式。
- 不做模型可见 `ordo` 工具（若后续实现需独立 spec 与 session event）。
- 结果文本不含 raw prompt、provider payload、private tool args、token、absolute path 或完整思维链。
- 不在 DSH 内重实现 Ordo 风险分类或四维成熟度计算。

## Impact

- 数据源依赖：`ordo-dsh-plugin-visualization-v1`（snapshot remote、状态词汇表、action 分期）与 `dsh-agent-composition-preview-v1`（组合投影/资质）。
- 涉及包：新 `packages/host/ordo-commands/`；`packages/client/ui-ordo-agent-ops/`（additive：popup 装饰、result 联动）。
- Ordo 侧无新合同；qualify 远端动作面（`ordo.agent_qualify.request`）留待 `agent/ordo/openspec/changes/ordo-agent-qualification-v1` 后续切片开放。
