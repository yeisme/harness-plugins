# DSH OPC 场景生产导演入口任务

## 1. Typed consumer

- [x] 1.1 增加 Scaena OPC summary typed adapter 与 redacted fixture；owner：host/sdk；依赖：Scaena owner change；验收：保留 refs/version/freshness/action/receipt，拒绝 raw prompt、provider payload、credential、signed URL、绝对路径；验证：package contract tests。
- [x] 1.2 增加 DSH-local exception view model；owner：client SDK；依赖：1.1；验收：只读、不持久化 domain state、不重算 readiness/action；验证：table tests。

## 2. DSH surfaces

- [x] 2.1 在 /drama 增加 context/Now/Why/Next、三 gate 状态、primary blocker、one primary action 和 Workbench 深链；owner：ui-ai-drama-director；依赖：1.2；验证：typed probe + component tests。
- [x] 2.2 复用 /drama review、/drama evidence、/drama delivery、/drama handoff 展示 owner action、receipt、manifest/checksum、grant 和 recovery；owner：ui-ai-drama-director；依赖：2.1；验证：surface contract tests。
- [x] 2.3 增加 partial/stale/offline/unknown/contract-mismatch exception cards；owner：ui-ai-drama-director；依赖：2.1；验收：原因可见、依赖动作 disabled、无自动 retry；验证：state transition tests。
- [x] 2.4 增加 9:16/16:9 reframe、balanced/cinematic upgrade 和 role-first Skill summary；owner：ui-ai-drama-director；依赖：2.1；验证：fixture snapshots。
- [x] 2.5 增加 copyable CLI/API action details 与 keyboard/focus/reduced-motion 行为；owner：ui-ai-drama-director；依赖：2.2；验证：accessibility assertions。

## 3. Conformance and evidence

- [x] 3.1 与 Workbench 建立同 package revision cross-entry fixture；owner：harness integration；依赖：Workbench owner adapter；验收：action/receipt/reconcile semantics 完全一致；验证：redacted fixture evidence。Evidence: `packages/client/ui-ai-drama-director/tests/opc-scene-cross-entry.fixture.ts`（可移植语义表：action id/target ref/expected version/side-effect class/confirmation/idempotency/receipt identity/reconcile identity 七字段，三 canonical 流）+ `opc-scene-cross-entry.spec.ts` DSH 侧执行 4/4 绿（含跨状态 identity 逐字节一致断言）；Workbench 侧同合同由其 `apps/web/test/opc-scene-package-view-model.test.tsx` 表测试锁定（源注释明示 identity 1:1 不重算不重命名），本仓对其仓交叉执行尝试因对方 workspace install 在途状态（task-sdk workspace 解析失败）无法代跑——如实记录，解锁条件=workbench 仓自身表测试绿即两侧一致成立。
- [x] 3.2 运行本仓 focused tests、build、bundle checks 和 strict OpenSpec；owner：harness-plugins；验证：
  - pnpm run typecheck
  - pnpm run test
  - pnpm run build
  - pnpm run check:bundles
  - openspec validate dsh-opc-scene-package-director-v1 --strict --no-interactive
  - evidence 写入 temp/integration-test-runs/<run-id>/
