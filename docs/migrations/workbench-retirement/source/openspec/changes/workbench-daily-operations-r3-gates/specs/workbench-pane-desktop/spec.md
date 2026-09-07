# Delta for workbench-pane-desktop

## ADDED Requirements

### Requirement: Pane Desktop 恢复性验证门禁
Workbench SHALL 在 R3 晋级前通过真实浏览器 E2E 验证 pane desktop 的 layout restore、deep-link、back-forward、fullscreen、mobile/sheet 与键盘导航旅程，且 P0/P1 为零；layout 持久化 MUST 来自 backend canonical state 而非跨租户 localStorage。

#### Scenario: 恢复旅程回归
- **WHEN** restore/deep-link/keyboard 任一 critical journey 在真实浏览器 E2E 中失败
- **THEN** desktop 能力保持阻塞，固定 viewport/layout/tenant 重放并保留 screenshot 与 trace 证据
