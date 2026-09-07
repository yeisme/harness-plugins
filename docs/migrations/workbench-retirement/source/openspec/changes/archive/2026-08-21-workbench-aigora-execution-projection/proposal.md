## Why

Workbench 需要把领域 Operation 的准入结果与 Aigora 的实际执行进度放在同一操作视图中，但两者由不同 owner 决定，不能互相推断成功。现在需要先固定一个最小、可撤回的投影合同，避免浏览器绕过 Workbench 或把 Aigora job 误当作领域 canonical state。

## What Changes

- 新增实验性的 Aigora execution 双状态投影：并列显示 domain operation/admission 与 Aigora execution，不合成为第三个 canonical job state。
- 定义只包含 `operation_ref`、`binding_ref`、`job_ref` 等 safe refs 的 typed facade DTO，以及 `unknown`、`reconcile_required`、`stale`、`offline`、`contract_mismatch` UX 状态。
- 将读取、reconcile、权限与 existence-hiding 固定在 Workbench service/SDK facade；浏览器不得调用 Aigora 私有 API、数据库或本地文件。
- 以默认关闭的 capability 发布；关闭或回滚时隐藏投影，不改变领域 Operation、Aigora job 或既有 Task canonical state。

## Capabilities

### New Capabilities

- `aigora-execution-projection`: Workbench 对 domain operation 与 Aigora execution 的安全双状态投影、reconcile 和可撤回能力边界。

### Modified Capabilities

- 无。

## Impact
