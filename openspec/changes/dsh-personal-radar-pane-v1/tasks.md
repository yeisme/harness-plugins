## 1. Host adapter 与 capability probe

- [x] 1.1 实现固定命令 adapter：binary/lane 来自用户级配置，固定 argv `mcp --transport stdio --lane <lane>`；intent 携带 binary/argv/cwd/env/未注册 method 一律 fail closed；验证：负例单测。
- [x] 1.2 实现 capability probe（binary 可达 + contract version + `radar mcp capabilities` ready + 官方 Pane slot），缺失时 disabled + reason（`needs_radar`、`contract_mismatch`、`seam_unavailable`）；验证：probe fixtures 测试。
- [x] 1.3 实现 lane/operation/capability 交集校验与 stable reason codes；operator 交集只剩 `edition_build`，collect/daily_run 按未知 intent 拒绝；验证：交集矩阵测试。
- [x] 1.4 实现 receipt reconcile：feedback idempotency key、edition build run ref、unknown 不自动重放；验证：kill/reconnect 与 duplicate intent 测试。

## 2. Badge 与命令族

- [x] 2.1 Context badge：紧凑摘要 `Radar · N fits · M new · fresh Xm`；empty/degraded/stale/offline 文本+图标双表达；点击或键盘打开 Pane；验证：reducer + a11y 测试。
- [x] 2.2 `/drama radar` 命令族解析为 typed intent（open/save/dismiss/compare/proposal/workbench/refresh）；未知子命令与缺 ref 给出用法提示；验证：parser 单测。

## 3. 按需 Pane

- [x] 3.1 list/detail/compare 视图：可丢弃 UI projection，reload 从 Radar refs 恢复；detail 展示三分分数、reason、风险、known limitations；验证：reducer/lifecycle 测试 + 固定尺寸 snapshot。
- [x] 3.2 状态模型：ready/empty/degraded/stale/offline/permission_denied/contract_mismatch/action_pending/reconcile_required，各给安全 next action；验证：状态矩阵测试。
- [x] 3.3 a11y/窄屏：键盘可达、焦点恢复、aria/text label、窄屏 compare 降级；若存在 TUI renderer 则 update/render 可确定测试；验证：a11y + 窄屏 snapshot。
- [x] 3.4 Workbench handoff：deep-link 只携带安全 refs；proposal 草稿 pending review、stale 时要求 refresh/review；验证：handoff/proposal 契约测试。

## 4. Bundle 与证据

- [x] 4.1 bundle 行声明 `dsh.bundle.patch`，未安装时既有行为不变；验证：`pnpm run check:bundles`。
- [x] 4.2 fake Radar provider + 契约负例（未注册 intent、越 lane action、过期 ref）；验证：conformance 测试。
- [x] 4.3 integration evidence 写入 `temp/integration-test-runs/<run-id>/`，脱敏 secret/绝对路径/raw payload；验证：`pnpm run test` 与 evidence runner 绿。

## 5. 质量门

- [x] 5.1 `pnpm run typecheck`、`pnpm run test`、`pnpm run build` 全绿；失败归因 introduced/pre-existing/environmental 后再修。
- [x] 5.2 `openspec validate dsh-personal-radar-pane-v1 --strict --no-interactive` PASS。
