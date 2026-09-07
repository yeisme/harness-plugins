# Workbench Identity Provider HTTP 合同（消费端切片）提案

## Why

`workbench-daily-operations-r3-gates` 8.2 真实栈勘察（2026-08-28）钉死 R1 消费端授权的结构性根因：`service/internal/runtime/runtime.go` 的 `New()` 以 `identity.NewService(profile, auth, nil)` 构造 identity service——`identity.Provider` 合同（`service/internal/identity/service.go` 定义，五方法 CheckReady/Session/ListTenants/ListMembers/AllowedActions）在消费端从未接线，第三个参数恒为 `nil`。managed profile 下任何 project 授权 mutation（task submit、workitem、layout 等 identity-gated 操作）都 fail-closed 为 `needs_contract` → `identity_unavailable`，8.2 的 mutation 授权链被结构性阻塞。同时 workbench 侧没有任何 `Provider` 实现，identity-platform（sibling 仓）API 亦无 AllowedActions 端点。

## Owner fit 判定

| 能力 | 判定 | Owner | 边界 |
| --- | --- | --- | --- |
| Provider 五方法的 REST 端点（identity-platform 侧实现） | `split-owner` | identity-platform owner | 端点、DB、session/tenant 状态机、审计归其 change；本 change 只冻结消费端可接受的线上合同 |
| Provider HTTP 消费端 + runtime 接线 | `fit` | Workbench | 消费已验证 PrincipalContext 投影（opaque refs），不解析 token、不持有 tenant/membership canonical state、不伪造决策 |
| AllowedActions 决策语义（policy 计算） | `split-owner` | identity-platform owner | Workbench 只消费 allow/deny + requiredGates，不在本地复制 policy |

## 跨仓 owner 路由

identity-platform 侧端点实现属其 owner 的 change（`backend-server/identity-platform` 内新 OpenSpec change，当前该仓有 34 个未提交在制品文件，本 change 期间只读不写）。本 change 只做 Workbench 消费端切片，并在 design.md 冻结 `workbench.identity.provider.v1alpha1` 线上合同作为双方接口。

## What Changes

- 新增 capability `workbench-identity-provider-contract`：定义 Provider 五方法的 REST 端点、JSON envelope、contract version、fail-closed 错误映射、loopback-or-HTTPS URL policy、bounded response 与脱敏要求。
- 新增 `service/internal/identity/http_provider.go`：`Provider` 五方法的 HTTP 消费端实现（closed 解码、计数有界、contractVersion 必须匹配 `workbench.identity.v0.1`、任何漂移 → `ErrContractMismatch`）。
- runtime 接线（default-off）：managed profile 读取 `WORKBENCH_IDENTITY_PROVIDER_URL`；非空时构造 HTTP provider 注入 `identity.NewService`，为空时保持 `nil`（现状行为完全不变）；local profile 禁止配置该 URL。

## required-capability ledger

- 用户要求：R3 8.2 真实栈 mutation 授权链解锁（identity Provider 合同接线）。
- Ledger：`identity.Provider` HTTP 消费端（本 change）；provider REST 端点（identity-platform owner change，slice 2）；`task daily-ops-integration:real-stack:scenario` 转绿（slice 3，gated on slice 2）。无新增 UI/pane 能力。

## Impact

- Affected specs: `workbench-identity-provider-contract`（新增 capability）。
- Affected code: `service/internal/identity/http_provider.go`（新增）、`service/internal/identity/http_provider_test.go`（新增）、`service/internal/runtime/runtime.go`（最小接线：Config 字段、LoadConfig managed 分支 env、Validate 校验、New() provider 注入）。
- 依赖：slice 2（identity-platform 端点）未交付前，本切片保持 default-off，行为零增量。
