## 1. Owner contract dependency

- [x] 1.1 [Owner: Eikona；Scope: `cli/eikona/internal/workspaceprojection/pane.go`；Dependencies: none] 核对 gallery/run/artifact/review 的脱敏 snapshot、负向状态与 owner action descriptor。验收：无 path、token、raw prompt、provider payload；默认模型为 `openai/gpt-5.4-image-2`。验证：`go test ./internal/workspaceprojection -run Pane -count=1`（在 `cli/eikona` 执行）。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 1.1] 注册 `workspace.eikona`，复用统一 Domain Pane view、snapshot normalization、action admission、ArtifactIntent builder 与 Eikona default model normalization。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.1] 将 Eikona Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [ ] 2.3 [Owner: Harness Plugins；Scope: Eikona Host bridge；Dependencies: 1.1, 2.2] 挂载正式 `domain.eikona` owner source，消费 snapshot + push event，处理 duplicate/gap/expired cursor/offline，禁止 timer polling。
- [ ] 2.4 [Owner: Harness Plugins；Scope: Eikona action gateway；Dependencies: 2.3] 接通 generate preview、accept/reject/export 与 owner receipt；unknown/timeout 进入 reconcile，不乐观成功。

## 3. 验证

- [ ] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.3, 2.4] 覆盖 gallery/compare/generate/review/export/handoff、permission_denied、offline 与大 gallery bounded activation；证据写入 `temp/integration-test-runs/<run-id>/`。
- [ ] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-eikona-pane-v1 --strict --no-interactive`。
