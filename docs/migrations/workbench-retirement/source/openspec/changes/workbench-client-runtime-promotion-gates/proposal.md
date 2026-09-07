# Workbench Client Runtime 晋级门禁提案

## Why

`workbench-client-runtime-adapter` 已完成 47/50 项任务并归档，capability spec 已随归档合入正式 specs。剩余 3 项不是普通实现任务，而是 generate capability 晋级前的外部依赖与独立复核门禁：broker/owner 可验证依赖发布（3.1）、独立安全复核（4.2b）、Product/Compatibility 晋级验收（4.4b）。本 change 承接这 3 项门禁任务，保持 generate 默认关闭直到门禁全部通过。

## What Changes

- 承接归档 change 的未完成任务 3.1、4.2b、4.4b，任务文本与验收口径保持不变。
- 在 `workbench-client-runtime-adapter` capability 上新增晋级门禁要求：依赖 tag、独立安全复核签字、真实 Aigora owner 链路逐 capability 晋级与 rollback rehearsal。
- `WORKBENCH_RUNTIME_GENERATE_ENABLED` 保持默认关闭；任何门禁缺失时关闭 generate flag 并回到本 change 修复。

## Impact

- Affected specs: `workbench-client-runtime-adapter`（新增晋级门禁要求）。
- Affected code: 无直接代码改动；晋级通过后由 release 流程按 selector 验收。
- 依赖：`backend-server/client-runtime` broker tagged release、Aigora owner release gate、credentialctl 可验证版本。
