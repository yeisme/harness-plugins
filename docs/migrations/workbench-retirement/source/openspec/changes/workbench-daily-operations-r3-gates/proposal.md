# Workbench Daily Operations R3 验证门禁提案

## Why

`workbench-desktop-daily-operations-r3` 已完成 47/51 项任务并归档，capability spec（`workbench-daily-operations`、`workbench-pane-desktop`）已随归档合入正式 specs。剩余 4 项是依赖 disposable CI/staging 环境的验证与晋级门禁：real dependency integration/system（8.2）、browser/a11y/security E2E（8.3）、performance/capacity/soak（8.4）、rollback 与 R4 handoff closeout（8.5）。本 change 承接这些门禁任务，release selector 中原 `workbench-desktop-daily-operations-r3:8.5` 引用由本 change 的 8.5 承接。

## What Changes

- 承接归档 change 的未完成任务 8.2、8.3、8.4、8.5，任务编号与验收口径保持不变。
- 在 `workbench-daily-operations` capability 上新增验证门禁要求：真实依赖集成证据、浏览器/无障碍/安全 E2E、性能容量与 soak、独立 kill switch 与 rollback dry-run。
- 任一数据/权限/receipt/performance/rollback gate 缺失不得关闭 R3，也不得以 fixture 替代真实依赖。

## Impact

- Affected specs: `workbench-daily-operations`（新增验证门禁要求）。
- Affected code: `service/cmd/workbench-release/**` canonical change 引用、`Taskfile.yml` selector `--require` 指向本 change。
- 依赖：disposable PostgreSQL CI、Identity test tenant、至少一个真实 Owner、staging 环境。
