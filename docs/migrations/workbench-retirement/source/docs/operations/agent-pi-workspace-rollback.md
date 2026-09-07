# Agent PI Workspace Rollback Drill（任务 8.6）

> Kill switch 与 rollback drill：逐层禁用 capability，返回旧 conversation workspace，
> 保留所有 projection/presentation/cursor，不删除 Task/attempt/receipt/proposal/evidence/unknown outcome。

## 当前真实的 capability 控制面

| 层 | 当前 server 控制 | 禁用效果 | 数据保留 |
| --- | --- | --- | --- |
| Proposal/tool-action canary | PA 独立使用 `WORKBENCH_AGENT_PROPOSAL_{READ,DECISION,RECONCILE,TOOL_ACTION}_COHORT` 精确 principal cohort；PI 本身不能提升这些状态 | 清空 decision/tool cohort 后新 proposal decision/execute 停止；read/reconcile 可独立保留 | proposal/attempt/Task/receipt 与 PI projection/presentation 全保留 |
| Follow Pi | `WORKBENCH_AGENT_FOLLOW_PI_COHORT=` (empty)，且 capability 只对同时进入 read-only 与 presentation-suggestions cohort 的同一精确 principal 开启 | 临时 Follow Pi 不可启用；suggestion cards 仍按独立 capability 工作 | presentation metadata 保留 |
| Presentation suggestions | `WORKBENCH_AGENT_PRESENTATION_SUGGESTIONS_COHORT=` (empty) | suggestion cards/intents 停止显示；base safe output 与 canonical proposal 保留 | 已保存的安全 projection 不变 |
| Directory stream | `WORKBENCH_AGENT_DIRECTORY_STREAM_COHORT=` (empty) | directory SSE 停止，fallback 到 bounded query | cursor 保留 |
| Unified read-only shell | `WORKBENCH_AGENT_PI_WORKSPACE_READ_ONLY_COHORT=` (empty) | capability discovery 返回 disabled，`/agent` 回到 legacy conversation route | 所有 additive 表保留 |

不存在 `WORKBENCH_AGENT_TOOL_ACTION_ENABLED`、`WORKBENCH_AGENT_FOLLOW_PI_ENABLED`、
`WORKBENCH_AGENT_PRESENTATION_ENABLED` 或 `WORKBENCH_AGENT_PI_WORKSPACE_ENABLED`
这四个 boolean 环境变量。Presentation suggestions 使用精确 principal cohort 而非 boolean；
Follow Pi 同样使用 `WORKBENCH_AGENT_FOLLOW_PI_COHORT` 精确 principal cohort，并额外要求
read-only 与 presentation-suggestions cohort 交集。Proposal/tool action 属 PA 控制面，只有
PA global flag、真实 Owner contract 与同一 exact principal 的 read→decision→tool cohort 交集
同时满足才可晋级；PI route/query/localStorage/build flag 均不能提升。

## Rollback 不变量

1. **不删除 additive data**：projection/presentation/cursor 表是 additive schema，flag off 只隐藏可见性。
2. **不取消下游 Task**：accepted proposal 的 linked Task 独立继续（Task lifecycle 由 TaskService 拥有）。
3. **不回退 fixture/Owner 直连**：flag off 回到旧 shell（非 fixture），不恢复浏览器直连 Owner。
4. **重新启用兼容**：flag on 后 projection 从 durable cursor 恢复，不丢历史。

## Drill 步骤

1. 清空 `WORKBENCH_AGENT_FOLLOW_PI_COHORT`，受控重启 owning `workbenchd` 实例；验证 Follow Pi capability 返回 `disabled`、当前 session 的临时 consent 被清除，而 suggestion cards 与 base safe output 保留。
2. 清空 `WORKBENCH_AGENT_PRESENTATION_SUGGESTIONS_COHORT`；验证 suggestion cards/intents 消失、Follow Pi 因交集前提自动关闭，而 base safe output 与 canonical proposal 保留。
3. 清空 `WORKBENCH_AGENT_DIRECTORY_STREAM_COHORT`，验证 directory SSE 停止且 bounded query fallback 可用。
4. 清空 `WORKBENCH_AGENT_PI_WORKSPACE_READ_ONLY_COHORT`，重启受控实例并验证 `/agent` 返回 legacy conversation route；Follow Pi 因交集前提关闭。
5. 按 `agent-proposal-authority-canary-rollback.md` 清空 PA decision/tool cohort；验证 PI 不能恢复 accept/execute，且首批 Follow Pi 只自动打开 `open_pane/show_evidence`；`focus_safe_ref` 保持 suggest-only。
6. 验证旧 conversation workspace 可用（/agent 不 crash），且 managed legacy list/turn 仍按 canonical principal 隔离。
7. 验证 projection/presentation/cursor 表数据完整（SELECT count 不变）。
8. 验证 accepted Task 状态不受影响（Task status 独立于 shell capability）。
9. 恢复三个相关 cohort，验证 projection 从 durable cursor/rebuild 恢复（session timeline 不丢），并由当前 session 再次明示开启临时 Follow Pi。

## 当前状态

- read-only unified shell、directory、presentation-suggestions 与 narrow Follow Pi cohort 控制已实现；本地 component/browser canary 覆盖精确 principal 交集、flag-off 回退、`open_pane/show_evidence` 自动跟随、focus safety 与 reduced motion。
- `focus_safe_ref` 尚未晋级为自动跟随；PA cohort/Owner contract 不完整时 tool-action 保持 disabled/unavailable/needs_contract。
- staging drill 仍需要 running app + managed session，目前没有 staging、deployment 或 production 证据。
