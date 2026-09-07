# Mission Brief Security Review（任务 8.2）

> 基于 2026-08-11 代码状态的 read-only 安全审查。本报告审查 trust boundaries、tenant isolation、
> injection、credential/tool absence、SSRF、idempotency/replay、redaction。
> 当前 rules-only degraded surface；approved provider 保持 needs_contract。

## 1. Trust Boundaries

| 边界 | 防线 | 证据 | 状态 |
| --- | --- | --- | --- |
| Browser → BFF | BFF generic proxy 剥离 browser Authorization，注入 server-side token | `apps/web/server/handler.ts` + BFF test 6.5 | ✅ |
| BFF → Backend HTTP | missionbriefhttp authority 派生自 identity.CurrentPrincipal，未认证→401 | `missionbriefhttp/handler.go` 4 test | ✅ |
| BFF → Backend gRPC | missionbriefgrpc authorize，未认证→PermissionDenied | `missionbriefgrpc/server.go` 5 test | ✅ |
| Backend → Repository | authority-first query（server-derived Authority.Scope），cross-tenant→ErrNotFound | `service/read.go` + 3.2 repository tests | ✅ |
| Service → Generator | rules-only generator 只接收 typed MissionContextV1，无 prompt 字段 | `generator/rules/` + 4.4 security suite | ✅ |
| Service → Approved Adapter | 4.2 adapter contract gate，8 项缺失→needs_contract，绝不发送 | `adapters/missionbrief/approved/` 6 test | ✅ |

## 2. IDOR / Tenant Isolation

- ✅ Repository authority-first query：无全局 Get 后鉴权，所有 query 带 tenant/workspace/project scope（3.2）。
- ✅ Transport authority 派生：HTTP/gRPC/JSON-RPC 都从 identity.CurrentPrincipal 派生 Authority，tenant 必须匹配 principal tenant（cross-tenant→denied）。
- ✅ Web reducer scope isolation：reduceBriefEvents 忽略跨 briefRef event（7.1 test）。
- ✅ Document key tenant-bound：composeMissionBriefDocumentKey 绑定 tenant，cross-tenant key 校验 fail-closed（7.5 test）。

## 3. Prompt Injection / Untrusted Input

- ✅ Rules-only generator 不接收 prompt（typed context only）。
- ✅ Validation `validSafeExplanation` 拒绝 XSS/URL/credential/format char（4.4 security suite 12 test）。
- ✅ `unsafeContentPattern`：HTML 标签/URL scheme/`${}`/`{{`/`javascript:` 全拒。
- ✅ `secretLikePattern`：Bearer/sk-/PRIVATE KEY/Authorization:/ghp_/github_pat_/xox/AKIA/.ssh/id_rsa 全拒。
- ✅ Unicode Cf 字符（U+202E RTL override / U+200B zero-width）拒绝。
- ✅ Schema smuggling：unknown JSON 字段（tool_call/system_prompt/raw_output）strict reject。

## 4. Tool / Credential Absence

- ✅ Rules-only generator：无 tool/mutation client。
- ✅ ContextActionPayload：closed union，无 raw JSON/map 逃逸。
- ✅ Approved adapter：无 tools/Owner credential/mutation client（4.2）。
- ✅ BFF：browser Authorization 剥离，token 只从 server-side 注入。

## 5. SSRF / Dynamic URL

- ✅ Approved adapter EndpointAllowed：endpoint 必须在 allowlist（https only），arbitrary base URL 拒绝（4.2 test）。
- ✅ No dynamic Owner URL in transport（generic proxy 不接受 X-Owner-URL 类注入头——既有 BFF 边界）。
- ✅ Identity authority adapter 不构造 endpoint（只读 CurrentPrincipal）。

## 6. Idempotency / Replay

- ✅ Generation request idempotency：server-derived ref+payload/input digest + durable lease（3.3）。
- ✅ Decision CAS：expected-version + idempotency key（5.4 accept/reconcile）。
- ✅ Web actions：每次 submit 生成唯一 idempotencyKey（crypto.getRandomValues，7.4 test）。
- ✅ Event reducer：eventRef + sequence 双去重（7.1 test）。
- ✅ unknown_accept reconcile-only：零自动重发（5.4 + 4.4 policy test）。

## 7. Logs / Traces / Evidence / Redaction

- ✅ Observability RecordMissionBrief：低基数枚举 label + domain-scoped sha256 ref digest（5.6 test）。
- ✅ raw prompt/output/token/path 不落 metric/span/log（5.6 sentinel scan test）。
- ✅ Transport error：低基数 stable code，不回显 raw internal message。
- ✅ 4.4 corpus sentinel scan：evil.example/169.254.169.254/.ssh/id_rsa/MIIEpAIBAAKCAQEA/sk-proj-/Bearer eyJ/PRIVATE KEY/ghp_/Authorization: Basic/DROP TABLE/__import__/<script>alert/onerror=/system_prompt/tool_call/raw_output 全部不泄漏。

## 8. 供应商配置 / Supply Chain

- ✅ Approved provider 合同 8 项 gate（provider id/version/digest/endpoint allowlist/no-training/retention/residency/service identity audience）。
- ✅ Contract digest 防 drift（4.2 ContractDigest test）。
- ⚠️ 当前无 approved provider（0.2 blocked）——supply chain gate 待 provider 批准后激活。

## P0/P1 发现

- **P0：0**（无 critical）
- **P1：0**（无 high）

## P2 观察（有 mitigation）

1. **5 source adapters 仍 OfflineSources**（task/daily/workflow/release/owner）：generate 在 source 接好前返回 unavailable（诚实降级）。Mitigation：identity authority bridge 已建（managed 可用），其余 source 待各自 owner 接线。
2. **Web copy 是 hardcoded 中文**（非 i18n key）：Mitigation——后续 i18n sweep 注册 key，当前不影响安全。
3. **events.watch SSE/long-poll 未实现**：events.list bounded pagination 可用。Mitigation——6.6 parity 子项。

## 结论

rules-only degraded surface 的 trust boundary、tenant isolation、injection defense、credential absence、SSRF防护、idempotency、redaction 全部由 focused test 证明。approved provider supply chain gate 就位但未激活（0.2 blocked）。**P0/P1 = 0**。raw prompt/output/secret/path scan 全绿。
