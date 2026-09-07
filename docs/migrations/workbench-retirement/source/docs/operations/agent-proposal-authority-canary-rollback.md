# Agent Proposal Authority Canary / Rollback

本文记录 PA 8.4 的 capability-scoped 本地 canary 与回滚命令。它证明 Workbench 服务端精确 principal 门禁、真实 Eikona loopback consumer 与 durable restart 语义；不代表 staging、deployment 或 production ready。

## Server controls

`WORKBENCH_AGENT_PROPOSAL_AUTHORITY_ENABLED=1` 只构造 additive repository、transport 与 sealed executor。浏览器不能仅凭该 flag 获得 authority；同一 authenticated principal 还必须按顺序进入以下 exact cohort：

| Stage | Environment | Server effect |
| --- | --- | --- |
| read | `WORKBENCH_AGENT_PROPOSAL_READ_COHORT` | `getProposal/listEvents` 与 capability projection 可读 |
| decision | `WORKBENCH_AGENT_PROPOSAL_DECISION_COHORT` | 同时在 read cohort 时允许 reject/request-changes；accept 仍不可 dispatch |
| reconcile | `WORKBENCH_AGENT_PROPOSAL_RECONCILE_COHORT` | 同时在 read cohort 时只允许原 unknown attempt reconcile |
| selected tool | `WORKBENCH_AGENT_PROPOSAL_TOOL_ACTION_COHORT` | 同时在 read+decision cohort，且 exact action `action:eikona:generation-submit` 与 target `eikona.generation.submit` 的真实 Owner contract 为 `ModeOwner` 时，accept 才可进入 Task gates |

空列表/default、unsafe ref、decision-only、tool-only、route query、Vite variable、localStorage 或 UI state 都不能晋级 capability。非 selected tool 即使 target operation 相同也保持 `needs_contract`。

## Canary order

对 disposable `proj_canary`、approved Identity issuer/JWKS 与 Eikona loopback process：

1. 仅设置 read + reconcile cohort，受控重启 `workbenchd`；验证 proposal 可读、decision/tool disabled。
2. 加入 decision cohort并重启；验证 reject/request-changes 为 metadata-only，accept 仍被 tool cohort 门禁挡在 claim 前。
3. 加入 tool-action cohort并重启；验证 server catalog 只把 exact selected descriptor 晋级 ready，accept 创建一个 canonical `orbit.proposal.accept` Task，并通过 permission/cost/version/idempotency gate 委托 `eikona.generation.submit`。
4. 运行真实 consumer：

   ```sh
   task test:agent-proposal-authority-eikona-canary EIKONA_URL=http://127.0.0.1:<port> IDENTITY_URL=http://127.0.0.1:<port> TEST_PROJECT_REF=proj_canary
   ```

5. 运行 cohort/restart component gate：

   ```sh
   task test:agent-proposal-authority-cohort:component
   ```

## Kill switch and restart rollback

先清空 mutation cohorts，保留 read/reconcile：

```sh
export WORKBENCH_AGENT_PROPOSAL_DECISION_COHORT=
export WORKBENCH_AGENT_PROPOSAL_TOOL_ACTION_COHORT=
export WORKBENCH_AGENT_PROPOSAL_READ_COHORT=usr_canary
export WORKBENCH_AGENT_PROPOSAL_RECONCILE_COHORT=usr_canary
```

受控重启 owning `workbenchd` 后验证：

- 新 accept/reject/request-changes 在 repository claim 前返回 `capability_unavailable`；无新 decision attempt、Task 或 Owner receipt。
- accepted proposal/attempt/Task/receipt 继续可读，Task 生命周期继续由 TaskService/Owner 拥有。
- `decision_unknown` 只用原 decision/task/receipt/correlation reconcile；不 redispatch、不换 adapter/provider。
- proposal/additive tables 不删除；重启后 canonical status/revision/active decision ref 保留。
- 非 cohort principal 的 read/decision/reconcile/tool 全部 fail closed。

紧急 Owner kill switch 可同时关闭 Eikona `new_mutations_enabled`/canary mutation；已签发 receipt 仍由 Owner status/reconcile 合同读取。若需关闭整个 PA transport，可清空全部四个 cohort；不要 destructive down migration，也不要恢复 legacy browser accept。

## Evidence tiers

- focused component：exact cohort intersection、proto/schema/SDK capability parity、no-claim denial、SQLite close/reopen restart、unknown original-attempt reconcile。
- real loopback integration：Identity HTTP delegation exchange + JWKS → Eikona selected mutation → one canonical Task + safe Owner receipt。
- browser：server-authored projection consumption、reload/reconnect/a11y/rollback fail closed。
- staging/production：未执行，不能从上述本地证据推断。
