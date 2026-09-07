## 1. Server-side Radar adapter

- [x] 1.1 实现固定命令 adapter：binary/lane 来自服务端配置，固定 argv `mcp --transport stdio --lane <lane>`；浏览器传入 binary/argv/cwd/env/未注册 method 一律 fail closed 不启动子进程；验证：adapter 单测覆盖拒绝路径。
- [x] 1.2 实现 lane/operation/capability/scope 交集校验与稳定 reason codes（unknown_operation、permission_denied、contract_mismatch、action_pending、reconcile_required 等）；验证：table-driven 交集矩阵测试。
- [x] 1.3 实现 reader 投影（active profile/latest edition/opportunity/evidence/source status/capabilities）与 compact 响应、freshness/observed_at 标注；验证：消费 `radar.mcp.handoff.v1` fixtures 的 contract tests。
- [x] 1.4 实现 curator `feedback_add`/`opportunity_review`：idempotency key、receipt 为唯一成功真源、timeout/断线进入 `action_pending|reconcile_required` 并按 key 对账，不自动重放；验证：kill/reconnect 与 duplicate 提交测试。
- [x] 1.5 实现 operator `edition_build`（仅此一项）：确认提示、active profile revision 与 source freshness 展示、build outcome unknown 时按 run/edition ref 对账；验证：collect/daily_run 以未知 operation 拒绝的负例测试。

## 2. SDK operations 与 registry 接线

- [x] 2.1 在 `service/internal/registry` 注册 Personal Radar typed operations，自动投影到 SDK/HTTP/gRPC/JSON-RPC；验证：四种调用面 parity 测试。
- [x] 2.2 在 `packages/task-sdk` 新增 `WorkbenchClient` Personal Radar typed client（reader/curator/operator 三组 operation）；验证：SDK 单测 + typecheck。

## 3. Personal Radar Lens 四视图

- [x] 3.1 For You：latest Edition、active profile revision、freshness、机会卡（≤3 reason + 1 风险）、source status、`profile_required` 三步 CLI setup；验证：组件测试 + snapshot。
- [x] 3.2 Opportunity Detail：三分分数（market/personal fit/evidence confidence）、reason codes、风险、证据条目、跨平台差异、known limitations 与七个动作；验证：高热度低适配、证据降级两类 fixture 测试。
- [x] 3.3 My Projects：proposal/downstream receipt 真源、deep-link、仅 `used` 时标记 “reported as used”；验证：receipt 缺失场景测试。
- [x] 3.4 Taste & Feedback：Profile 安全摘要、revision、近期反馈、排序解释，编辑只渲染 CLI suggestion；验证：无 mutation 调用的静态/行为断言。
- [x] 3.5 状态模型：ready/empty/degraded/stale/offline/permission_denied/contract_mismatch/action_pending/reconcile_required 文本+图标双表达与安全 next action；profile switch 清理 scoped cache；验证：状态矩阵组件测试。
- [x] 3.6 响应式/a11y：desktop 列表+inspector、Compare 双栏、<768px sheet/stack、键盘等价、可见焦点、SR label、成功后焦点恢复；验证：a11y 测试 + 窄屏 snapshot。

## 4. Handoff 与证据

- [x] 4.1 生成/消费 `PersonalRadarOpportunityHandoffV1`，deep-link 只携带 refs 并重新向 owner 读取 projection、校验 digest/freshness；验证：stale revision 分支测试。
- [x] 4.2 Draft proposal 走 proposal control plane 创建 pending review 草稿，accept 后才交给目标 owner；验证：proposal/accept 分离测试。
- [x] 4.3 browser evidence：Vitest 组件测试 + Playwright 关键路径（For You → Detail → Save → receipt；offline → 只读标记）；integration/e2e 证据写入 `temp/integration-test-runs/<run-id>/`；验证：`bun run test:integration` 绿且 evidence 完整。

## 5. 质量门

- [x] 5.1 `bun run typecheck`、`bun test`、`CGO_ENABLED=0 go test ./service/...` 全绿；失败归因 introduced/pre-existing/environmental 后再修。
- [x] 5.2 `openspec validate personal-radar-lens-v1 --strict --no-interactive` PASS。
