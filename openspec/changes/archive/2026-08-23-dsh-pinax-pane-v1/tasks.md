## 1. Owner contract dependency

- [x] 1.1 [Owner: Pinax；Scope: `cli/pinax/internal/app/pane.go`；Dependencies: none] 核对 vault/note/backlink/graph/history 的脱敏 snapshot、负向状态与 owner action descriptor。验收：无绝对路径、凭据；手写 metadata fail closed。验证：`go test ./internal/app -run Pane -count=1`（在 `cli/pinax` 执行）。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 1.1] 注册 `workspace.pinax`，复用统一 Domain Pane view、snapshot normalization、action admission 与 ArtifactIntent builder。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.1] 将 Pinax Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [x] 2.3 [Owner: Harness Plugins；Scope: Pinax Host bridge；Dependencies: 1.1, 2.2] 挂载正式 `domain.pinax` owner source，消费 snapshot + push/change event，处理 gap/offline/permission drift，禁止 timer polling。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test` 66/66 绿（pinax.spec.ts：note/backlink/graph/history 投影、封闭 ref allowlist、失败投影→offline、permission_denied；owner-source.spec.ts 的 gap/offline/禁轮询由共享 bridge 承担并经 conformance 用例锁定）。
- [x] 2.4 [Owner: Harness Plugins；Scope: Pinax action gateway；Dependencies: 2.3] 接通 capture/import/search/edit/link/sync；所有结构化 mutation 经 Pinax CLI/service，unknown/timeout 不乐观成功。验证：pinax.spec.ts + pinax-pane-integration.spec.ts 全绿——inbox.capture/sync.run 只以 owner command descriptor 发布（preview summary 指明 pinax inbox capture / pinax sync run）、手写 metadata 键在触达 owner 前被拒、timeout/unknown → reconcile_required（共享 DomainActionGateway，不乐观成功）。

## 3. 验证

- [x] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.3, 2.4] 覆盖 inbox/note/backlink/graph/history、非法 metadata、offline 与 note handoff；证据写入 `temp/integration-test-runs/<run-id>/`。验证：tests/pinax-pane-integration.spec.ts 全绿（host mount + 真实 apply() + live push + 非法 metadata 双面 fail closed + note→Auctra handoff + teardown）；证据在 temp/integration-test-runs/dsh-pinax-pane-v1-20260823T081658Z-3785522/（summary.json/artifacts/脱敏日志）。
- [x] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-pinax-pane-v1 --strict --no-interactive`。验证（2026-08-23，全部 exit 0）：typecheck 无错误、66/66 绿、build 成功、openspec validate 输出 valid。
