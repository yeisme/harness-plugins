# R1 全量质量门证据

## Gate

执行以下稳定 diff 全量门：

```bash
task spec:validate SPEC_CHANGE=workbench-identity-tenant-access-r1
buf lint
CGO_ENABLED=1 go test -race ./service/...
bun run typecheck
bun test
bun run test:contract
```

命令由 integration evidence runner 统一包装，保留原始退出码与脱敏输出。

## 首轮失败与归因

首轮 evidence：`temp/integration-test-runs/20260729050435-97916126-6df2-4fd6-b1b8-07addda419f0/`。

失败集中在 lifecycle catalog：migration `0019_board_owner_change_reconcile` 新增 `board_owner_changes` 与 `board_owner_change_applications`，但两个 safe metadata model 未登记 lifecycle class，导致 lifecycle inventory 与 repository coverage fail closed。Identity package、transport、runtime 与 observability 均已通过；该失败不是 Identity 行为回归。

最小修复将两个模型加入现有 `board_metadata` / `store:board-metadata` 分类。它们只保存 tenant-scoped digest、safe refs、version/state token、audit ref 与应用映射，不含 owner payload，符合既有 Board lifecycle 边界。

## 最终结果

最终 evidence：`temp/integration-test-runs/20260729051237-028dbe99-c9f4-4933-9080-2ee6f49c6f7f/`。

- status：passed
- duration：419710 ms
- OpenSpec strict validation：passed
- Buf lint：passed
- Go service race gate：passed
- Bun/TypeScript/Web tests：passed
- SDK/transport contract：passed
- redaction gate：passed

fixture 与 loopback capability 仍保持 consumer/test 边界，没有被标记为 production `available`。
