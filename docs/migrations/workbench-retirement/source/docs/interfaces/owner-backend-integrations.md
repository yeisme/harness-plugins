# Owner Backend Integrations

## Overview

Workbench discovers, reads, and observes multiple domain owners (Scaena, Eikona, Pinax, Sonora, and planned: Auctra, Ordo, Ordo, Quaestor) through a unified OwnerService. The browser never talks to owners directly; all requests go through the Bun BFF / `workbenchd`.

## Current Readiness

| Owner | Status | Read | Mutation | Events |
| --- | --- | --- | --- | --- |
| Scaena | `partial` | project/scene via `/api/v1` | `needs_contract` | not connected |
| Eikona | `partial + selected canary` | project/asset/handoff via `/api/v1` | exact `eikona.generation.submit` may be `ModeOwner` only under proposal-authority + Identity/JWKS + exact-principal cohort config；others `needs_contract` | component parity; real canary receipt/reconcile |
| Pinax | `partial` | project/note via `/v1` | `needs_contract` (write disabled by default) | not connected |
| Sonora | `partial` | voice-model/strategy via `/api/v1` | `needs_contract` (render not enabled) | not connected |
| Auctra | `implemented + real canary` | screenplay room via `/api/v1`（loopback token） | `selected operations approved`（2026-09-05 双半场 canary） | component parity；real canary receipt/reconcile |
| Ordo | `needs_contract` | offline | `needs_contract` | not connected |
| Ordo | `needs_contract` | offline | `needs_contract` | not connected |
| Quaestor | `needs_contract` | offline | `needs_contract` | not connected |

Read capability does not imply mutation availability. Mutation operations remain
`ModeUnavailable` until the owner provider delivers receipt/status/reconcile and
the Workbench consumer gate is complete. The only current exception is the
default-off, exact-cohort proposal-authority canary for
`eikona.generation.submit`; it does not promote any other Eikona or Owner action.

## Configuration

Owner connectors are configured via environment variables at startup. All URLs must be loopback (127.0.0.1 or localhost) unless explicitly allow-listed.

```bash
# P0 connectors
WORKBENCH_EIKONA_URL=http://127.0.0.1:8787   # Eikona /api/v1
WORKBENCH_SCAENA_URL=http://127.0.0.1:8788   # Scaena /api/v1
WORKBENCH_PINAX_URL=http://127.0.0.1:8789    # Pinax /v1
WORKBENCH_SONORA_URL=http://127.0.0.1:8790   # Sonora /api/v1
# Planned; keep unset until auctra-screenplay-room-v1 provider packet is approved.
WORKBENCH_AUCTRA_URL=http://127.0.0.1:8791  # Auctra /api/v1

# Proposal-authority selected Eikona canary (all cohorts default empty)
WORKBENCH_AGENT_PROPOSAL_AUTHORITY_ENABLED=1
WORKBENCH_AGENT_PROPOSAL_READ_COHORT=usr_canary
WORKBENCH_AGENT_PROPOSAL_DECISION_COHORT=usr_canary
WORKBENCH_AGENT_PROPOSAL_RECONCILE_COHORT=usr_canary
WORKBENCH_AGENT_PROPOSAL_TOOL_ACTION_COHORT=usr_canary
# Requires the approved Identity HTTP exchange/JWKS issuer configuration too.
```

Unset URLs leave the connector in `offline` state. The Workbench shell continues to start and serve other owners.

### Planned Auctra Screenplay Room connector

`workbench-auctra-screenplay-room-v1` 消费 Auctra `auctra.workbench.owner.v1` 中 additive 的 `auctra.screenplay_room.v1alpha1` capability。五项证据已于 2026-09-05 全部补齐（provider manifest/digest 交付、connector/SDK conformance 11/11、真实 loopback read/events、selected mutation 全链 receipt/reconcile、rollback 保留 owner state；消费侧 run `temp/integration-test-runs/20260905035934-804f088e-b8cc-4cd5-8821-36dfc462f472` exit 0），selected operations 晋级 `approved`（runtime 接线 `PacketContract()`）。原始晋级门槛清单保留如下供回滚审计：

1. Auctra provider manifest/OpenAPI/TypeScript、schema/event digest、stable errors 与 auth audience；
2. Workbench connector/SDK conformance 和 browser-safe projection；
3. 真实 loopback read/events；
4. selected mutation 的 expected revision、idempotency、receipt/status/reconcile；
5. rollback 关闭 dispatch 但保留 owner draft/receipt/Canon。

读 capability 通过不代表 mutation 通过。Workbench 不按 endpoint 存在或 HTTP 200 推断 available，也不读取 `.auctra/**`、SQLite、connection file 或 browser-supplied owner URL/token。UI 设计见 [Auctra Screenplay Room](../ui/auctra-screenplay-room.md)。

### Eikona local preflight

Workbench 不负责安装 Eikona、保存 Eikona provider credential 或读取 `~/.eikona`。在本地启动 Eikona owner 并设置 `WORKBENCH_EIKONA_URL` 前，operator/Agent 应先检查已安装 CLI 的自描述结果：

```bash
eikona setup --agent
# Only with local-write authority; follow action.next exactly.
eikona setup --yes --agent
eikona auth check openai --agent
eikona doctor --channel openai --model openai/gpt-5.4-image-2 --probe --agent
```

`setup` 默认不写本地状态；`--yes` 只创建缺失的公开安全用户配置，并从 `yeisme-dist` 安装与 CLI 版本精确匹配的 Agent Skills。不得回退到私有仓库、`latest` Skills 或 shell credential 脚本。凭据只能由用户在 Eikona 边界内通过 `eikona auth set <provider> --api-key-stdin` 写入。该预检不启动服务、不修改 Workbench 配置、不执行付费生成。

## API Surface

### REST

```
GET /v1alpha1/owners                                    # List all owners
GET /v1alpha1/owners/{ownerId}                          # Get owner
GET /v1alpha1/owners/{ownerId}/capabilities             # Capabilities
GET /v1alpha1/owners/{ownerId}/projects                 # List projects
GET /v1alpha1/owners/{ownerId}/projects/{projectRef}    # Get project
GET /v1alpha1/owners/{ownerId}/projects/{projectRef}/resources  # List resources
GET /v1alpha1/owners/{ownerId}/resources/{resourceRef}  # Get resource
GET /v1alpha1/owners/{ownerId}/events/watch             # SSE event stream
GET /v1alpha1/owners/{ownerId}/diagnostics              # Diagnostics
GET /v1alpha1/owners/{ownerId}/operations               # List operations (needs_contract)
GET /v1alpha1/owners/{ownerId}/receipts/{receiptRef}    # Get receipt (needs_contract)
GET /v1alpha1/owners/{ownerId}/operations/{ref}/status   # Get status (needs_contract)
```

### gRPC

`workbench.owner.v1alpha1.WorkbenchOwnerService` with all REST methods plus receipt/status reads.

### JSON-RPC

Namespace `workbench.owner.v1alpha1` with methods: `ListOwners`, `GetOwnerCapabilities`, `ListOwnerProjects`, `GetOwnerProject`, `ListOwnerResources`, `GetOwnerResource`, `WatchOwnerEvents`, `GetOwnerDiagnostics`, `ListOwnerOperations`, `GetOwnerOperation`, `GetOwnerReceipt`, `GetOwnerOperationStatus`.

Mutation, reconcile, and cancel are NOT exposed as browser-callable Owner methods. They go through the Task control plane.

## Security Model

- Browser only accesses the Bun BFF; no owner token/session/URL crosses to the browser.
- Owner connectors only accept loopback URLs (no userinfo, query, fragment, or redirect).
- Content-Type must be `application/json` or `application/*+json`.
- Responses are limited to 1 MiB (read) / 4 MiB (explicit resource read).
- DTO sanitizer strips forbidden fields (token, credential, rawPayload, filePath, etc.).
- Opaque refs use `base64url(sha256(ownerId + NUL + canonicalRef))`; no path or URL accepted as ref.
- Log values are redacted (token, secret, key, password, credential, bearer, private paths).

## Limitations

- No real owner process is connected by default; connectors return `offline` until configured.
- Mutation operations return `needs_contract` unless their exact provider and
  Workbench consumer contract, server cohort, receipt/status/reconcile, and
  rollback evidence have passed. Currently only `eikona.generation.submit` has
  that local real-loopback selected-operation canary; staging/production are not
  claimed.
- Event streaming uses a bounded Workbench safe-event adapter when an approved owner source is configured; an unbound source remains a heartbeat, and cursor expiry/gap/unsafe projection fails closed. Provider SSE reconnect/tombstone/offline evidence is still required before event canary promotion.
- Eikona mutation canary (Task 4.4) and real conformance (Task 1.3b) require a running Eikona process.
