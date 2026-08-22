## 1. Owner contract dependency

- [x] 1.1 [Owner: Anatomia；Scope: `agent/anatomia/internal/application/pane.go`；Dependencies: none] 核对 source/job/timeline/evidence 的脱敏 snapshot、负向状态与 owner action descriptor。验收：partial 与 complete 可区分，无 raw prompt、provider payload、完整思维链。验证：`go test ./internal/application -run Pane -count=1`（在 `agent/anatomia` 执行）。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 1.1] 注册 `workspace.anatomia`，复用统一 Domain Pane view、snapshot normalization、action admission 与 ArtifactIntent builder。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.1] 将 Anatomia Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [ ] 2.3 [Owner: Harness Plugins；Scope: Anatomia Host bridge；Dependencies: 1.1, 2.2] 挂载正式 `domain.anatomia` owner source，消费 snapshot + push event，处理 partial/gap/expired cursor/offline，禁止 timer polling。
- [ ] 2.4 [Owner: Harness Plugins；Scope: Anatomia action gateway；Dependencies: 2.3] 接通 analyze、inspect evidence、revision 与 owner receipt；partial 不得提升为 complete，unknown/timeout 进入 reconcile。

## 3. 验证

- [ ] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.3, 2.4] 覆盖 source/job/timeline/shot/scene/transcript/OCR/observation/evidence、permission_denied、offline 与 evidence handoff；证据写入 `temp/integration-test-runs/<run-id>/`。
- [ ] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-anatomia-pane-v1 --strict --no-interactive`。
