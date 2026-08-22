## 1. Owner contract dependency

- [x] 1.1 [Owner: Sonora；Scope: `cli/sonora/internal/workspace/pane.go`；Dependencies: none] 核对 take/job/waveform/subtitle/rights/cost 的脱敏 snapshot、负向状态与 owner action descriptor。验收：无音频字节、凭据、raw SSE、绝对路径；验证：`go test ./internal/workspace -run Pane -count=1`（在 `cli/sonora` 执行）。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 1.1] 注册 `workspace.sonora`，复用统一 Domain Pane view、snapshot normalization、action admission 与 ArtifactIntent builder。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.1] 将 Sonora Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [ ] 2.3 [Owner: Harness Plugins；Scope: Sonora Host bridge；Dependencies: 1.1, 2.2] 挂载正式 `domain.sonora` owner source，消费 snapshot + push event，处理 duplicate/gap/expired cursor/offline，禁止 timer polling。
- [ ] 2.4 [Owner: Harness Plugins；Scope: Sonora action gateway；Dependencies: 2.3] 接通 cost/rights preview、render、accept 与 receipt；unknown/timeout 进入 reconcile，不乐观成功。

## 3. 验证

- [ ] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.3, 2.4] 覆盖 waveform/subtitle/take/review/rights/cost、approval_required、offline 与跨 Pane handoff；证据写入 `temp/integration-test-runs/<run-id>/`。
- [ ] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-sonora-pane-v1 --strict --no-interactive`。
