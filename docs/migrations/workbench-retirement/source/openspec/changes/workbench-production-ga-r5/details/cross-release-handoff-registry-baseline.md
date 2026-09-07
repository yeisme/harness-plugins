# Cross-Release INT Handoff Registry 基线

## 结论

R5 `0.3` 已建立 CLI-authored `INT-R0-01` 至 `INT-R5-01` handoff registry。每个包明确 producer、consumer、failure owner，并分别记录 contract、schema、SDK、auth、events、receipt 和 rollback 状态。Provider Ready、Consumer Done、Integration Passed 与 Rollback Passed 继续作为四个相互独立、需要直接 evidence/digest 的 gate。

当前 integration registry 为 0/6 ready；所有合同面均为 `missing`，四个 gate 均为 false，evidence map 为空。`release:handoff:validate` 对该资产返回 domain exit `5` 和 `handoff_incomplete`，证明结构有效但 production handoff 尚未成立。

## CLI 资产

```text
temp/release/handoff-mapped.json
```

```bash
task release:handoff:init \
  ENV=integration \
  HANDOFF_REGISTRY=temp/release/handoff-mapped.json

task release:handoff:validate \
  ENV=integration \
  HANDOFF_REGISTRY=temp/release/handoff-mapped.json
```

结构化状态只能通过 `workbench-release handoff init|record` 创建和推进。Markdown DAG 只定义包语义，不授权任何 gate。

## 包映射

| Package | Producer | Consumer | Failure owner |
| --- | --- | --- | --- |
| `INT-R0-01` | Workbench Foundation | Workbench R1-R4 | Workbench Foundation |
| `INT-R1-01` | Identity Platform | Workbench Identity | Identity Platform |
| `INT-R2-01` | Owner Providers | Workbench Owner Integrations | Workbench Owner Integrations |
| `INT-R3-01` | Workbench Daily Operations | Workbench Spatial Workflow | Workbench Daily Operations |
| `INT-R4-01` | Workbench Spatial Workflow | Workbench Release | Workbench Spatial Workflow |
| `INT-R5-01` | Workbench Release | Production Platform | Workbench Release |

每个 package 同时包含：

- `contract_state`
- `schema_state`
- `sdk_state`
- `auth_state`
- `events_state`
- `receipt_state`
- `rollback_state`

当前这些字段只允许 `missing`。真实 digest/range 与 gate evidence 必须由对应 provider/consumer owner 通过后续 CLI state transition 写入，不能由初始化器猜测。

## 验证证据

- Component：`temp/integration-test-runs/20260729071228-f3e923ba-961e-486c-84fd-4199a70d05ab/summary.json`
  - `release:gates:test` 通过，包括 Go release CLI、TypeScript release state 与 evidence runner 测试。
  - 覆盖 handoff CAS、四 gate evidence/digest、boolean-only ready 拒绝、unsafe producer mapping 拒绝、output/redaction 与 blocked readiness。
- 当前 registry validation：0/6 ready，按预期返回 `handoff_incomplete`。
- `git diff --check` 与 R5 strict OpenSpec validation 通过。

## 兼容与回滚

- 变更类型：`workbench.release_handoff.v1` 新增 optional mapping/state 字段；旧 v1 registry 没有这些字段时仍可读取和验证已有 gate evidence。
- OpenSpec owner：`workbench-production-ga-r5`，对应任务 `0.3`。
- 迁移窗口：无需强制迁移；重新运行 `handoff init` 才会生成完整映射。
- 回滚：停止初始化新增字段；现有 `handoff record|validate`、manifest 与 readiness consumer 继续使用原四 gate/evidence 语义。

## 后续边界

- `0.3` 关闭仅表示 registry 和责任路由已经建立，不表示任一 Provider Ready 或 Consumer Done。
- 当前 Identity Platform 缺失、Owner canary 未执行、R3/R4 production gates 未通过，因此所有 package 必须保持 blocked。
- 后续记录任何 gate 时必须同时提供安全 owner ref、evidence ref 与 SHA-256 digest；四个 gate 不得互相代签或从布尔值推断。
