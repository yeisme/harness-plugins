# creator-studio-host-projection Specification

## Purpose
TBD - created by archiving change dsh-creator-studio-v1. Update Purpose after archive.
## Requirements
### Requirement: Creator Studio Host SHALL freeze a complete server context

Host SHALL 在 `CreatorStudioGateway` 构造时严格验证、脱离复制并冻结 tenantRef、workspaceRef、sessionRef、principalRef、revision、membershipRevision、installationRef、pluginDigest、policyRevision 和 runtimeGeneration。缺失或非法 context SHALL 返回不含 owner 事实的 `contract_mismatch`，且后续 Context key replacement MUST NOT 改变已捕获绑定。

#### Scenario: Expected context is missing
- **WHEN** Creator Studio Remote 在没有完整 server-injected expected context 时读取 snapshot
- **THEN** Remote SHALL 返回 `context_unavailable` 和六个不含资源或动作的 contract fallback

#### Scenario: Context changes after gateway construction
- **WHEN** Host 在 gateway 构造后替换 expected context service
- **THEN** gateway SHALL 继续按构造时冻结的 context 校验 owner snapshot 与动作请求

### Requirement: Host SHALL compose six bounded owner projections

Host SHALL 为 Eikona、Scaena、Sonora、Auctra、Pinax 和 Anatomia 各返回一个确定位置的 owner projection。每份 owner snapshot MUST 通过 strict schema、owner、transport、context、refs、数量和安全字段验证；读取异常、非法响应或缺失 adapter SHALL 降级为不含 owner 事实的 bounded fallback。

#### Scenario: One owner is ready
- **WHEN** Eikona 返回 fresh/ready 的有效 snapshot，而其他 owner 没有 adapter
- **THEN** aggregate SHALL 为 `partial`，Eikona 事实 SHALL 可见，其他五个 owner SHALL 为不含资源和动作的 offline fallback

#### Scenario: Owner projection violates the contract
- **WHEN** owner snapshot 包含未知字段、unsafe value、漂移 context 或错误 owner/transport
- **THEN** Host SHALL NOT 将该 snapshot 的资源、动作、生产、审阅或队列事实传给浏览器

### Requirement: Owner transport selection SHALL be deterministic

Directory SHALL 支持 `local`、`service` 与按 owner 覆盖的 transport policy。`auto` SHALL 仅在 service adapter 显式 configured 时优先 service，否则优先 local；一个操作选定 transport 后 MUST NOT 因错误切换到另一个 transport。

#### Scenario: Configured service is available
- **WHEN** 同一 owner 同时注册 local 与 configured service adapter，且 policy 为 auto
- **THEN** directory SHALL 为读取和动作选择 service adapter

#### Scenario: Selected service has uncertain settlement
- **WHEN** policy 选择 service 且 service dispatch 抛出 transport error
- **THEN** Host SHALL 返回 unknown/reconcile 语义，并且 MUST NOT 调用 local adapter

### Requirement: Cross-owner production aggregation SHALL remain Scaena-owned

只有 Scaena snapshot SHALL 能发布 composed production、review 和 job projection。其他 owner 携带这些字段 SHALL 被视为 contract mismatch。

#### Scenario: Non-Scaena owner publishes production
- **WHEN** Eikona、Sonora、Auctra、Pinax 或 Anatomia snapshot 包含 production、reviews 或 jobs
- **THEN** Host SHALL 拒绝该 owner snapshot，并且 SHALL NOT 合并这些字段

### Requirement: Media access SHALL be short-lived and safe

Snapshot SHALL 只携带版本化 artifact ref。`resolveArtifact` SHALL 只接受已知 owner artifact，并只返回通过 schema 验证的短期 `http(s)` 或 `blob` URL 与 expiry；file、data、javascript URL、凭据与 raw provider payload MUST NOT 跨出 Host。

#### Scenario: Owner returns an unsafe media URL
- **WHEN** owner adapter 返回 file、data、javascript 或非法 media access URL
- **THEN** Remote SHALL 返回 null，并且 SHALL NOT 将该 URL 传给浏览器

### Requirement: Host mutations SHALL revalidate current owner state and execute once

Dispatch SHALL 在调用 owner mutation 前重新读取当前 fresh/ready snapshot，并核对 descriptor ref、owner/action、expected target/version、完整 context、字段约束与 expiry。stale、漂移、过期或改变的 descriptor SHALL 返回 `reconcile_required`；transport 或 settlement 不确定 SHALL 返回 `unknown`。每个请求 MUST 最多调用选定 adapter 一次。

#### Scenario: Descriptor target changed
- **WHEN** 浏览器提交的 expected target/version 与最新 owner descriptor 不一致
- **THEN** Host SHALL 返回 `descriptor_changed` reconcile receipt，并且 SHALL NOT 调用 owner dispatch

#### Scenario: Owner dispatch settlement is uncertain
- **WHEN** owner dispatch 抛出异常或返回不可验证 receipt
- **THEN** Host SHALL 返回 `unknown` 与 `settlement_unknown`，并且 MUST NOT 自动重试

