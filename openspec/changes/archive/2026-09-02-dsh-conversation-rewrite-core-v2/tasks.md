## 0. Specification baseline

- [x] 0.1 Create `dsh-conversation-rewrite-core-v2` with the OpenSpec CLI and record schema/goal metadata
- [x] 0.2 Freeze package owner, host-neutral boundary, typed outcomes, staged controller, V1 facade and cross-surface fixture contract
- [x] 0.3 Add the ADDED `conversation-rewrite-core` delta spec with compatibility, privacy and recovery scenarios
- [x] 0.4 Record additive compatibility, no-deprecation posture, pack/publish gate and rollback plan in design.md
- [x] 0.5 Add the shared-core design document and update docs/package README links as specification-frozen and implementation-pending

## 1. Pure package scaffold

- [x] 1.1 Create `packages/client/conversation-rewrite-core` as ESM strict TypeScript package `@yeisme/dsh-client-ui-conversation-rewrite-core@0.1.0-rc.1`；Evidence: packages/client/conversation-rewrite-core（ESM strict TS，零 production dependency）。
- [x] 1.2 Export `.`, `./testing` and `./package.json` with tsdown/types output and no production dependency；Evidence: package.json exports `.`, `./testing`, `./package.json`；tsdown 双入口 ESM 输出 lib/index.js + lib/testing.js。
- [x] 1.3 Add source/private-import checks proving no React, DOM, DSH runtime/private module or absolute-path dependency；Evidence: tests/package.spec.ts 逐文件断言无 React/DOM/@deepseek-ai/绝对路径 import，且 dependencies 缺席。
- [x] 1.4 Add package README with V2 boundary/controller usage, privacy rules, compatibility and real validation commands；Evidence: packages/client/conversation-rewrite-core/README.md（V2 boundary/controller/fixtures 用法、隐私规则与验证命令）。

## 2. Host-neutral boundary V2

- [x] 2.1 Implement immutable snapshot/message/content/capability/target/decision types；Evidence: src/types.ts（snapshot/message/content/capability/target/decision 全部 immutable readonly）。
- [x] 2.2 Implement `computeUserTurnTargetV2` for Edit/TUI Retry and nearest preceding stable `turn/end`；Evidence: src/boundary.ts computeUserTurnTargetV2：Edit/TUI Retry 共同入口，nearest preceding turn/end。
- [x] 2.3 Implement `computeRetryTargetV2` for an adapter-resolved assistant key without Web-specific heuristics；Evidence: src/boundary.ts computeRetryTargetV2：仅接受 adapter 精确解析的 assistant key，无 Web 启发式。
- [x] 2.4 Preserve V1 disable reason vocabulary and add stale/stable-boundary/settlement reasons only in V2；Evidence: V1 五 reason 原样保留；V2 新增 stale/stable-boundary-unavailable/settlement-pending 只在 V2 API 出现。
- [x] 2.5 Add pure tests for completed, first-round, running, non-text, removed, stale, missing-boundary and immutable input cases；Evidence: tests/boundary.spec.ts（completed/first-round/running/settlement/non-text/removed/missing-boundary/immutable 输入）。

## 3. Typed outcomes and controller

- [x] 3.1 Implement `accepted`, `rejected` and `unknown` values plus bounded safe-summary normalization；Evidence: src/outcome.ts accepted/rejected/unknownOutcome + 256 单行 safe summary 规范化。
- [x] 3.2 Implement `RewriteMutationHostV2`, request/state/store and `ConversationRewriteControllerV2`；Evidence: src/controller.ts RewriteMutationHostV2 / RewriteRunRequestV2 / store + ConversationRewriteControllerV2。
- [x] 3.3 Execute fork/forkBeforeMessage → prompt → activate → optional hydrate once with operation/stale/dispose guards；Evidence: fork(or forkBeforeMessage)→prompt→activate→hydrate? 单次顺序执行，operation token 守卫迟到结果。
- [x] 3.4 Preserve known child ID for every post-fork failure and never auto-delete, auto-resend or auto-retry unknown outcomes；Evidence: child ID 经 accepted value 或 unknown partial 保留；无 auto-delete/auto-resend/auto-retry。
- [x] 3.5 Keep prompt text outside observable state/receipts/errors and add sentinel serialization tests；Evidence: state/receipt 不含 prompt；tests/controller.spec.ts sentinel 序列化测试。
- [x] 3.6 Add single-flight, duplicate run, late result, dispose and every rejected/unknown stage test；Evidence: tests/controller.spec.ts 覆盖 single-flight、duplicate run、dispose late result 与全部 rejected/unknown 阶段。

## 4. Web compatibility facade

- [x] 4.1 Keep DSH-specific messageId/turn-tail addressing in `ui-conversation-rewrite` adapter and map normalized data to V2 core；Evidence: ui-conversation-rewrite src/client/boundary.ts toV2Snapshot 映射，DSH addressing 留 adapter。
- [x] 4.2 Keep existing `computeEditTarget`/`computeRetryTarget` signatures, return shapes and legacy reasons unchanged；Evidence: computeEditTarget/computeRetryTarget 签名、返回形状与 legacy reason 不变（tests/unit/boundary.spec.ts 58 例全绿）。
- [x] 4.3 Reimplement or wrap `ChatRewriteController` over V2 while preserving `idle | submitting | opened | error`, store and dispose semantics；Evidence: src/client/controller.ts facade：V2 阶段投影 submitting/opened/error，旧 store 与 Promise 汇合保持。
- [x] 4.4 Preserve all existing root/client export paths, React component props, slot registration, locale keys, lineage and seam behavior；Evidence: root/client export paths、React props、locale keys、lineage/seams 未改动（diff 仅 boundary/controller 内部）。
- [x] 4.5 Add compile/runtime compatibility fixtures for existing consumers before accepting the adapter migration；Evidence: 既有 58 个 unit + 4 个 integration fixture 全绿，新增 tests/unit/contract-parity.spec.ts 执行共享表。

## 5. Shared fixtures and TUI handoff

- [x] 5.1 Publish synthetic `RewriteContractCaseV2[]` through `@yeisme/dsh-client-ui-conversation-rewrite-core/testing`；Evidence: src/testing.ts 导出 rewriteContractCasesV2（25 case）经 `./testing` 子路径。
- [x] 5.2 Cover boundary cases, all mutation stages/outcomes, known/unknown child, duplicate run and dispose late result；Evidence: 覆盖 boundary 全类别、全 mutation 阶段、known/unknown child、duplicate run 与 dispose late result。
- [x] 5.3 Run Web adapter against the shared expected table without copying the expectations；Evidence: tests/unit/contract-parity.spec.ts 以 Web consumer 身份执行 shared expected 表（27 例）。
- [x] 5.4 Produce a `pnpm pack` canary and verify package files, exports, type declarations and tarball integrity；Evidence: run-integration.mjs 内 pnpm pack canary：tarball files/exports 校验 + sha256。
- [x] 5.5 Hand the exact package version/tarball digest and fixture command to `client/dsh-tui` without committing `link:` or copied source；Evidence: evidence summary.json 记录 0.1.0-rc.1 + sha256 b8ce64b568fae5bd7b3be566af12cdda64c79842c23df7cfbccbd1867d03cc12；tarball 副本在 evidence artifacts。
- [x] 5.6 Add an evidence-producing integration entrypoint that always writes redacted success/failure artifacts under `temp/integration-test-runs/<run-id>/`；Evidence: packages/client/conversation-rewrite-core/scripts/run-integration.mjs → temp/integration-test-runs/conversation-rewrite-core-v2-20260902125803Z-806734/（passed）。

## 6. Documentation, release gate and verification

- [x] 6.1 Update the existing Web package README to explain V1 facade vs V2 core and first-round capability behavior；Evidence: packages/client/ui-conversation-rewrite/README.md「Shared Core V2（已实施）」段落。
- [x] 6.2 Record compatibility verdict: public TS additive/unchanged, OpenSpec id, no deprecation, rollback to old Web internals；Evidence: 兼容 verdict 见 design.md §10 与本 README：public TS additive/unchanged，无 deprecation，Web 可回滚旧 V1 内部实现。
- [x] 6.3 Keep publish as an explicit root/operator external action; do not publish from implementation/test automation；Evidence: 发布保持显式 operator 动作；README/设计均注明 pack canary 仅本地验证。
- [x] 6.4 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run typecheck`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run typecheck ✅。
- [x] 6.5 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run test`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run test ✅（60/60）。
- [x] 6.6 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run build`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite-core run build ✅（lib/index.js + lib/testing.js）。
- [x] 6.7 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run typecheck`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run typecheck ✅。
- [x] 6.8 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test ✅（85/85）。
- [x] 6.9 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test:integration`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run test:integration ✅（4/4）。
- [x] 6.10 Run `pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run build`；Evidence: pnpm --filter @yeisme/dsh-client-ui-conversation-rewrite run build ✅。
- [x] 6.11 Run `pnpm run typecheck`（2026-09-02 复跑 exit 0：此前记录的 `dsh-semantic-file-editor` 缺 `@yeisme/dsh-file-host/node` 红灯已由 file-document lane 前置修复，根级 typecheck 全绿。）
- [x] 6.12 Run `pnpm run test`（2026-09-02 复跑 exit 0：全部有测试包绿（87 包 Done）；首次跑中 `dsh-rich-media` 大文本渲染 1 例 5s 超时，隔离复跑 135/135 绿（单例 1426ms），判定为高并发负载 flake，非本 change 引入。）
- [x] 6.13 Run `pnpm run build`（根级 build ✅（BUILD_EXIT=0）；typecheck/test 归因见 6.11/6.12。）
- [x] 6.14 Run `pnpm run check:bundles`；Evidence: pnpm run check:bundles ✅（27/27 PASS）。
- [x] 6.15 Run `openspec validate dsh-conversation-rewrite-core-v2 --strict --no-interactive`；Evidence: openspec validate dsh-conversation-rewrite-core-v2 --strict --no-interactive ✅ valid。
- [x] 6.16 Run `openspec validate --all --strict --no-interactive` only after the owned slice is stable and entering final verification；Evidence: 2026-09-02 `openspec validate --all --strict --no-interactive` → 120 passed, 0 failed。
