# C2-A1 Identity Safe Model Contract 实现记录

## 状态

`C2-A1` provider-independent safe model baseline 已实现并通过生成/漂移/类型/安全门禁。该状态只证明 Schema、Proto、generated Go 与 TypeScript SDK 的模型一致，不代表任何 Identity endpoint、BFF session、tenant switch、revoke 或 policy 已可用。

## 合同版本

```text
workbench.identity.v0.1
```

当前模型：

- `IdentityPrincipal`：opaque subject/session/tenant/membership ref、decimal membership version、actor、scopes、auth methods 与安全时间。
- `IdentityTenantSummary`：opaque tenant/membership ref、decimal version、safe display name 与 active/suspended state。
- `IdentityMembershipSummary`：opaque membership/tenant/subject ref、safe display name、roles、version 与 active/invited/suspended/revoked state；不包含 email/provider profile。
- `IdentityAllowedAction`：action id、server-computed allowed、stable reason code 与 required gates。
- `IdentitySessionSnapshot`：profile/state/revision/authority key、principal、tenant list、allowed actions 与 safe diagnostic。
- `IdentityReadiness`：promotion/readiness state、低基数 checks 与 diagnostic。
- `AuthorizationDecision`：allow/deny、reason、membership version、required scopes/gates、decision ref 与 expiry。

共享模型明确禁止 access/refresh/provider token、cookie、CSRF proof、email 授权键、raw profile 与 provider payload。CSRF proof 属于 managed BFF auth transport header，不进入通用 identity model。

## 生成链

```bash
task identity:models:generate
task identity:models:test
```

生成入口：

- JSON Schema：`go run ./service/cmd/schema-export --output api/schema`
- Proto：`bun scripts/contract-assets.ts identity-proto`
- generated Go：`buf generate`

只读漂移检查：

- `go run ./service/cmd/schema-export --output api/schema --check`
- `bun scripts/contract-assets.ts identity-proto --check`
- `buf lint`

## 资产与验证

- `api/schema/workbench/identity/v1alpha1/identity.schema.json`
- `api/proto/workbench/identity/v1alpha1/identity.proto`
- `service/gen/workbench/identity/v1alpha1/identity.pb.go`
- `packages/task-sdk/src/identity-models.ts`
- `packages/task-sdk/test/identity-models.test.ts`
- `tests/identity-safe-contract.test.ts`
- `tests/contract-assets.test.ts`

SDK normalization 对 unsupported contract/state、缺失 active binding、无 tenant selection、错误 authority digest、越界 decimal revision、malformed scopes/auth methods 和 secret-shaped unknown fields fail-closed。local profile 固定投影为 `local_session` + `authorityKey=local-session`，不会伪装 managed tenant authority。

## 下一步

1. `C2-A2`：只读 baseline 已实现，见 `details/c2-a2-identity-read-operations.md`；下一步接入 live Provider adapter，并在 BFF session foundation 后实现 tenant select/switch 原子事务。
2. `C2-A3`：定义 managed BFF HTTP contract、auth-only CSRF header client 与 MSW contract fixtures。
3. provider 出现后，用 live contract digest 验证这些模型；未有真实 provider evidence 前 capability 最高保持 `contract_validated`。
