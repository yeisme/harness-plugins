## 1. Public Contracts

- [x] 1.1 Add additive mutation intent/proposal/receipt/reconcile/undo types and typed disabled reasons
- [x] 1.2 Add chunked upload/import and one-time download ticket contracts
- [x] 1.3 Add shared fixtures for conflicts, redirects, drift, unknown, rollback and transfer expiry

## 2. Local Resource Owner

- [x] 2.1 Implement session/workspace/generation/lease/revision/idempotency fencing and serialized execution
- [x] 2.2 Implement create file/directory, rename, move, copy and import commit with conflict decisions
- [x] 2.3 Implement owner-managed trash/restore outside the workspace with seven-day configurable retention
- [x] 2.4 Implement reconcile, undo, rollback/degraded receipts and oldRef-to-newRef redirects

## 3. Transfer Owner

- [x] 3.1 Implement session-bound staging, binary chunk validation, cancellation, expiry and quota cleanup
- [x] 3.2 Implement import handoff to mutation preflight/execute
- [x] 3.3 Implement short-lived one-time download tickets and streaming responses
- [x] 3.4 Keep Hosted mutation/transfer typed disabled without Control Plane authorization evidence

## 4. Explorer File Management UI

- [x] 4.1 Add create/rename/move/copy/trash/restore proposal actions while keeping primary and checked state separate
- [x] 4.2 Add same-name cancel/keep-both/replace review and dangerous confirmation Modal
- [x] 4.3 Convert internal/external drag-and-drop and Import into reviewable proposals
- [x] 4.4 Reconcile receipts, redirects, undo and stale references atomically
- [x] 4.5 Cancel already in-flight browser requests immediately when the workspace owner switches；Evidence: file-host `ExplorerFileHostOptions.signal`（per-request AbortSignal 传入全部 `/yeisme-files/api` fetch）；desktop-workbench apply owner-scope AbortController 在会话切换时 abort+重建，mutation execute/upload 中止如实返回 `owner-switched`（execute 结果未知走幂等键 reconcile）；treeV2 roots/listChildren 的 legacy 回退不再吞 AbortError（真 bug 修复：原实现把 owner 切换中止误判为旧宿主回退并二次发请求）。Tests: file-host.spec 2 例（signal 逐请求注入/AbortError 穿透）+ desktop-workbench apply.spec 1 例（切换前后 signal 中止与换新）。

## 5. Verification and Rollout

- [x] 5.1 Add integration coverage for every resource action, conflicts, drift, unknown/reconcile and trash restart restore
- [x] 5.2 Add transfer coverage for chunk cancellation, digest/offset attacks, expired/replayed tickets and non-preview download
- [x] 5.3 Emit redacted integration evidence under `temp/integration-test-runs/<run-id>/` while preserving exit codes
- [x] 5.4 Run focused and final typecheck/tests/build/bundle/OpenSpec gates
- [x] 5.5 Record the required local Phase B canary counters before default enablement；Evidence: `FileResourceMutationCanaryCountersV1`（operations/trashRestore/conflictReconcile + 四零容忍计数）additive 挂 mutation capability；本地 owner 在 trashRoot 外原子持久化（tmp+rename，best-effort），execute 成功/drift/degraded-rollback/undo 全路径记录；`canaryCounters()` 快照读取。Test: node.spec canary 用例（累计+跨实例持久化+drift 计数）。默认启用仍按 design §Migration 阈值门（≥50/≥10/≥5 且零容忍=0）。
