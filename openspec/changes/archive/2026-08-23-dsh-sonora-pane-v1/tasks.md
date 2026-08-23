## 1. Owner contract dependency

- [x] 1.1 [Owner: Sonora；Scope: `cli/sonora/internal/workspace/pane.go`；Dependencies: none] 核对 take/job/waveform/subtitle/rights/cost 的脱敏 snapshot、负向状态与 owner action descriptor。验收：无音频字节、凭据、raw SSE、绝对路径；验证：`go test ./internal/workspace -run Pane -count=1`（在 `cli/sonora` 执行）。

## 2. DSH 插件实施

- [x] 2.1 [Owner: Harness Plugins；Scope: `packages/client/ui-pane-domain/`；Dependencies: 1.1] 注册 `workspace.sonora`，复用统一 Domain Pane view、snapshot normalization、action admission 与 ArtifactIntent builder。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: `packages/bundle/pane-domain/`；Dependencies: 2.1] 将 Sonora Pane 纳入可安装 `@yeisme/dsh-pane-domain` bundle。验证：`pnpm --filter @yeisme/dsh-pane-domain run test`。
- [x] 2.3 [Owner: Harness Plugins；Scope: Sonora Host bridge；Dependencies: 1.1, 2.2] 挂载正式 `domain.sonora` owner source，消费 snapshot + push event，处理 duplicate/gap/expired cursor/offline，禁止 timer polling。验证：`pnpm --filter @yeisme/dsh-client-ui-pane-domain run test` 66/66 绿（owner-source.spec.ts 12 用例含 PANE_CONFORMANCE_CASES 全量折叠、read 恰一次+fake timer 无轮询、duplicate/gap/context/offline/重连重读一次；sonora.spec.ts 合同移植；bundle pane-domain 双面挂载冒烟 4/4，lib/host.js 经 cordis 实测 mount domain.sonora）。
- [x] 2.4 [Owner: Harness Plugins；Scope: Sonora action gateway；Dependencies: 2.3] 接通 cost/rights preview、render、accept 与 receipt；unknown/timeout 进入 reconcile，不乐观成功。验证：action-gateway.spec.ts 13 用例 + sonora.spec.ts channel 用例全绿——server-authored PaneActionDescriptorV1、字段只取 descriptor、requirePreviewFields 缺 rights/cost → approval_required、unknown receipt/timeout/owner error → reconcile_required、同 idempotencyKey 只打 owner 一次。

## 3. 验证

- [x] 3.1 [Owner: Harness Plugins；Scope: component/integration evidence；Dependencies: 2.3, 2.4] 覆盖 waveform/subtitle/take/review/rights/cost、approval_required、offline 与跨 Pane handoff；证据写入 `temp/integration-test-runs/<run-id>/`。验证：tests/sonora-pane-integration.spec.ts 全绿（host mount + 真实 apply() 视图 + push 事件 DOM 实时更新 + gate 全场景）；证据在 temp/integration-test-runs/dsh-sonora-pane-v1-20260823T081658Z-3785521/（summary.json/artifacts/脱敏日志）。
- [x] 3.2 [Owner: Harness Plugins；Scope: final gates；Dependencies: 3.1] 运行 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck && pnpm --filter @yeisme/dsh-client-ui-pane-domain run test && pnpm --filter @yeisme/dsh-client-ui-pane-domain run build && openspec validate dsh-sonora-pane-v1 --strict --no-interactive`。验证（2026-08-23，全部 exit 0）：typecheck 无错误、66/66 绿、build 成功、openspec validate 输出 valid。
