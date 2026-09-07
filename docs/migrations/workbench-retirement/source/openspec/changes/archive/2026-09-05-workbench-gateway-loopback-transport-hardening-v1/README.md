# workbench-gateway-loopback-transport-hardening-v1

修复 Gateway adapter loopback URL、redirect 与 Bearer 转发边界。

## Rollout 说明

- 本 change 收口时，`allowedOperations` 处于 fail-closed hold（空集）：在本地凭据集完成轮换、且经 reviewed owner contract 显式重新启用 controlled-tenant allowlist 前，所有 Gateway mutation 保持关闭（见 `service/internal/gateway/adapter.go` 的 Security hold 注释）。
- 测试通过 per-test `allowOperationForTest` 注入 allowlist，不放宽生产行为。
- 解除 hold 属于后续 owner contract 工作，不在本 change 范围内。
