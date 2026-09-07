# Workbench Identity R1 验证门禁提案

## Why

`workbench-identity-tenant-access-r1` 已完成 21/26 项任务并归档，capability spec 已随归档合入正式 specs。剩余 5 项是依赖外部 Identity Platform owner 与 disposable/staging 环境的验证门禁：provider handoff 核验（0.1）、disposable Identity/PostgreSQL integration（6.2）、security/browser/system gate（6.3）、staging soak 与 rollback drill（6.4）、R1 closeout 与 R2 handoff（6.5）。本 change 承接这些门禁任务，release selector 中原 `workbench-identity-tenant-access-r1:6.5` 引用由本 change 的 6.5 承接。

## What Changes

- 承接归档 change 的未完成任务 0.1、6.2、6.3、6.4、6.5，任务编号与验收口径保持不变。
- 在 `workbench-identity-tenant-access` capability 上新增验证门禁要求：真实 provider 证据、跨租户安全门禁、staging SLO 与 rollback drill。
- 任一 provider、revoke、cross-tenant、security 或 rollback gate 缺失时不得宣布 R1 关闭。

## Impact

- Affected specs: `workbench-identity-tenant-access`（新增验证门禁要求）。
- Affected code: `service/cmd/workbench-release/**` canonical change 引用、`Taskfile.yml` selector `--require` 指向本 change。
- 依赖：`backend-server/identity-platform` 独立 submodule 与 provider change `identity-platform-google-lark-login-v1`、disposable CI/staging 环境。
