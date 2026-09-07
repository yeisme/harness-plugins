## 1. Contract And Validation

- [x] 1.1 Add the V2 envelope types, closed-schema validator, unified `^[0-9a-f]{32}$` nonce check, epoch-ms expiry bounds, and canonical SHA-256 digest verification to `packages/task-sdk/src/harness/` as additive exports; leave the alpha deep-link validator untouched.
- [x] 1.2 Add the stable reason codes (`malformed`, `expired`, `denied`, `stale`, `replay_conflict`, `already_consumed`, `target_unavailable`, `legacy_bridge`, `contract_mismatch`, `reconcile_required`, `unknown`, `partial`) shared with the DSH contract.
- [x] 1.3 Reject raw route/URL/browser-composed input at ingress with `malformed`.

## 2. Server-Side Ingress

- [x] 2.1 Implement the launchRef/envelope ingress endpoint: revalidate schema, direction, target surface, expiry, nonce, and digest before any owner lookup.
- [x] 2.2 Implement the bounded replay record keyed by tenant+nonce+contractVersion: identical canonical payload returns the original result; a different payload returns `replay_conflict`.
- [x] 2.3 Reauthorize the principal against tenant/workspace/project/resource and refetch owner data; return `denied` without resource disclosure on failure.
- [x] 2.4 Compare `resourceVersion`/`contextRevision` with owner state; return `reconcile_required` (with the mismatch exposed) for behind/ahead/missing; never silently overwrite.
- [x] 2.5 Map intents to the `/agent` Creative Production / Review / Evidence lenses with the fixed focus; return `contract_mismatch` for unknown intents.
- [x] 2.6 Emit the stable bridge evidence categories (`bridge_consumed`, `bridge_denied`, `bridge_expired`, `bridge_contract_mismatch`, `bridge_reconcile_required`, `bridge_target_unavailable`) redacted to contract version, intent, surface, reason code, and opaque correlation ref — never the nonce or envelope.

## 3. Conformance And Rollout Gates

- [x] 3.1 Consume `@yeisme/dsh-ai-drama-director` fixtures (fixtureVersion `2026-08-29.1`) without importing DSH internal modules; run all consumer and both actor cases in CI.
- [x] 3.2 Record Workbench conformance evidence separately from DSH plugin-complete evidence under this repository's integration evidence convention.
- [ ] 3.3 After both sides pass the same fixture version, propose canary enablement through the release gate (product + security + both repo owners); rollback = disable V2 consumption and return to the alpha/legacy path without rewriting owner state. **Re-check (2026-09-03，仍不勾——外部签收门)**：本地半场当日复跑——`WORKBENCH_DSH_BRIDGE_FIXTURES_DIR=<harness-plugins>/fixtures/dsh-workbench-ai-drama-bridge-v2 bun test tests/conformance/bridge-v2-fixtures.test.ts` 1/1 pass（fixtureVersion 2026-08-29.1 双侧同版本 conformance 绿）；全量门禁同日绿（go CGO0 ✓ / bun 939/0 ✓ / contract 552/0 ✓ / integration 20260903152155 passed ✓）。3.3 的 action 本体是 release gate 上 product+security+双仓 owner 的 canary 提案与签收，属外部授权动作，本会话不可代行；rollback 支持（禁用 V2 消费回 alpha）已实现并测试。待双仓 owner 签收后勾选归档。
  - **Proposal artifact (2026-08-30)**：`details/v2-canary-enablement-proposal.md` 已产出（范围/观察窗/晋级 + 已实现回滚 + 四方签核表）；勾选待 product+security+双仓 owner 签核（外部门，不伪造）。
- [x] 3.4 Keep `workbench.harness.dsh_bridge.v1alpha1` compatible until the DSH-side removal change lands; do not change its field meanings.

## 收口（主代理统一验收 2026-08-29）

- 勾选依据（主代理独立复跑）：SDK `bun test packages/task-sdk/test/harness-bridge-v2.test.ts` 14/14 + task-sdk 全量 452/0（v1alpha1 零语义变更）；Go `CGO_ENABLED=0 go test ./service/internal/harnessbridge/... ./service/internal/transport/harnesshttp/` 双 ok；fixtures conformance 以真实 DSH 发布 fixtures（`agent/harness-plugins/.../dsh-ai-drama-director/fixtures/dsh-workbench-ai-drama-bridge-v2`，fixtureVersion 2026-08-29.1，34 用例）跑通——**3.1/3.2 证据 run `temp/integration-test-runs/20260829145013-ed2190bc/` passed（redaction 0）**，与 DSH 侧 plugin-complete 证据分开落盘于本仓 evidence 惯例下。
- 3.3 保持未勾：canary enablement 需 product+security+双仓 owner 同签（rollback=禁用 V2 消费回 alpha 路径，不重写 owner 状态——实现已支持）。
- 3.4 勾选依据：alpha 面 validator/types 零改动、452 用例含 alpha 全绿；V2 端点挂既有 mount 前缀，两合同面 contractVersion 门隔离；alpha 下线由 DSH 侧 removal change 追踪（保持兼容即可勾）。
- 报告：`details/implementation-report.md`（含 fixtures 真实位置发现与合同真值逐字节对齐记录）。
