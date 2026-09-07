## Why

已归档的 Spatial Runtime V1 完成了界面和基础合同，但独立审查发现 Board change-set 的接受链仍可绕过 ProposalAuthority/TaskService，且 production 装配、watch、owner/runtime projection、桌面 capability 与 tile index 没有形成可验证闭环。本 change 以兼容方式修复这些跨层缺口，使「可展示」变为「可由权威链路提交并恢复」。

## What Changes

- 将 spatial change-set 接受收敛为 ProposalAuthority decision → TaskService task → board executor → atomic Board receipt；浏览器不再直接触发 Board commit。
- 扩展（不替换）spatial apply/watch、owner/runtime projection 和 layout proposal 合同，使四 transport 与旧 SDK shim 保持可用。
- 将 <=2k 与 >2k layout proposal 都注册为冻结的 canonical facts；所有可接受 proposal 均进入同一 authority 链。
- 接通 runtime board event watcher、safe owner/runtime ports、Agent output spatial intent 透传、desktop envelope 和 renderer capability probe。
- 将 GORM tile/density projection 接入 Board commit invalidation/rebuild 与 viewport 查询，并以 50k fixture 验证索引路径。

## Capabilities

### New Capabilities

- `workbench-spatial-authority-remediation`: 定义 spatial proposal 接受、Task/receipt 回放、layout canonicalization 和 Board atomic executor 的权威闭环。

### Modified Capabilities

- `workbench-agent-spatial-interaction`: Agent spatial intent 和 change-set Review 必须走真实 session/authority 路径，且自动效果保持 presentation-only。
- `workbench-spatial-runtime-control`: spatial apply、watch、runtime projection 和未知结果必须在 TaskService/WorkflowService 权威下恢复。
- `workbench-spatial-surface`: desktop envelope、renderer capability、owner/runtime projection 和 tile index 必须在 production composition 中可用。

## Impact

- Service：`internal/spatial`、`proposalauthority`、`core`、`boards`、runtime bootstrap、GORM projection 与 HTTP/gRPC/JSON-RPC transports。
- SDK/Web：additive spatial response/watch union、旧 watch shim、Agent output→route→Surface、desktop gate、Review steps。
- Stable surfaces：仅增加 versioned optional field、operation handler、watch event union 和 migration/index；既有 Board/Workflow/Show API 不删除。旧 SDK API 在至少一个发布周期作为 shim 保留，回滚可关闭 remediation authority wiring 并保留旧读取合同；不得回滚已归档 change。
