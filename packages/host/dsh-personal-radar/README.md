# @yeisme/dsh-personal-radar

DSH Personal Drama Radar host 合同包：typed `/drama radar` intent、capability probe、lane 交集校验、receipt reconcile、badge/Pane reducer、Workbench handoff 与诚实降级。

本包只做 DSH 侧的安全投影与 typed intent；Radar Profile、反馈 ledger、机会簇、Edition 与运行状态归 `cli/short-drama-radar` owner 独有。意图经固定 argv `mcp --transport stdio --lane <reader|curator|operator>` 收敛；operator 交集只剩 `edition_build`，`collect`/`daily_run` 永不从插件发出。

## 验证

```bash
pnpm --dir packages/host/dsh-personal-radar run typecheck
pnpm --dir packages/host/dsh-personal-radar run test
pnpm --dir packages/host/dsh-personal-radar run integration:evidence
```
