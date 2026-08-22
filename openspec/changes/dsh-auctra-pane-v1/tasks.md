## 1. Owner contract dependency

- [x] 1.1 [Owner: Auctra；Scope: `cli/auctra/internal/app/pane.go`；Dependencies: none] 核对 project/unit/review 的脱敏 snapshot、负向状态与 owner action descriptor。验收：无正文全量、raw prompt、凭据；timeout 不自动 accept。验证：`go test ./internal/app -run Pane -count=1`（在 `cli/auctra` 执行）。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 1.1] 注册 `workspace.auctra`，复用统一 Domain Pane view、snapshot normalization、action admission 与 ArtifactIntent builder。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.1] 将 Auctra Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [ ] 2.3 [Owner: Harness Plugins；Scope: Auctra Host bridge；Dependencies: 1.1, 2.2] 挂载正式 `domain.auctra` owner source，消费 snapshot + push event，处理 stale revision、gap、offline，禁止 timer polling。
- [ ] 2.4 [Owner: Harness Plugins；Scope: Auctra action gateway；Dependencies: 2.3] 接通 create candidate、review accept/partial、version/export 与 owner receipt；unknown/timeout 不提升 canonical text。

## 3. 验证

- [ ] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.3, 2.4] 覆盖 candidate/canonical diff、review queue、permission_denied、offline 与 scene handoff；证据写入 `temp/integration-test-runs/<run-id>/`。
- [ ] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-auctra-pane-v1 --strict --no-interactive`。
