## Why

已有 Text Development 规划包含 Ordo Team 接入，但它服务特定领域。新的独立 Ordo 后台产品需要在既有 Workbench 主壳内提供通用工作概览与受控动作，同时避免两份 adapter、第二 scheduler 和重复执行。

## What Changes

- 新增通用 managed work consumer、注册 Pane、共享概览/关系/时间线语义与候选交接。
- 复用现有 WorkbenchClient、BFF、ProposalAuthority、TaskService 和主壳。
- 接收 Text Development 中通用 Ordo adapter 的实施责任；领域 Team deck、Auctra/Canon 保持原 change。
- 映射旧 Team control 与新 managed contract，保留 exact plan 审批和只读权限。
- 本 change 只提供规格和任务，不宣称真实 provider 接通。

## Capabilities

### New Capabilities

- `workbench-ordo-managed-consumer`: 既有主壳中的 typed Ordo 消费、双入口一致性与兼容。

### Modified Capabilities

无。通过新增 registered Pane/capability 集成，不改变旧 Task/Proposal/Team 协议。

## Impact

Owner: Workbench SDK/BFF/owner adapter、registered Pane 与对应 tests/docs。依赖 Ordo provider，不依赖安装独立网页。Browser 只访问同源 BFF，不能持有 Ordo credential、直接访问 owner 或重建调度状态。
