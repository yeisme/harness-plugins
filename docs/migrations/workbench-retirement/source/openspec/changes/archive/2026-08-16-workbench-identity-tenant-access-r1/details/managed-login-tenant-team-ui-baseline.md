# Managed Login / Tenant / Team UI Baseline

## 结论

R1 4.4 已完成 managed login、tenant 与 Team 的最小完整操作面。浏览器继续通过同源 BFF 持有 opaque session，Tenant 切换必须等待服务端返回新 authority，Team invite/accept/remove/role change 仅通过 Workbench Task control plane 提交，不直接调用 Identity，也不乐观修改 Team projection。

## 实现范围

- 新增 `/team` 管理路由，并加入 Workbench rail 与 command palette。
- 展示当前 session profile、actor、membership version、expiry、refresh 与 sign-out 操作。
- 展示 active tenant membership；当前 tenant 明确标记，其他 tenant 通过 `switchTenant` 原子切换，切换确认前不改变 UI authority。
- Team projection 只展示选中 tenant 的安全 member 字段，并覆盖 loading、empty、unavailable、degraded、needs-contract 与 current 状态。
- Team mutation 使用服务端 `AllowedAction` 决定呈现；permission/approval gate 不再导致前端错误禁用，提交后仍由 Task gate 决定执行。
- mutation 对话框只接收 protected `inputRef` 与 expected Identity version；raw email、provider profile、role payload 与 credential 不进入浏览器持久化或 Task input。
- Task 返回后只显示 task/status/gate 结果并提供 Task 深链；成员列表等待 Identity owner projection/event 后再更新。
- `/team` 已加入 login `returnPath` allowlist；session expired/revoked/signed-out 继续复用 AuthorityGate login rescue。
- 使用现有 Tailwind token 与 Radix Dialog，没有新增页面 CSS 或新的组件原语系统；交互包含 keyboard focus、dialog close、disabled、loading、error、desktop/mobile 与 reduced-motion 状态。

## 验证

- `bun run web:test`
  - Web Vitest 全量通过。
  - Bun server auth/session/Identity 测试：124 pass，6 skip，0 fail。
- `bun run typecheck`
  - 根 TypeScript 与 `apps/web` TypeScript 均通过。
- `bun run web:build`
  - Vite production build 通过。
- `bun run web:e2e -- --grep "identity|tenant|team"`
  - Chromium 2/2 通过：managed tenant switch + Identity Task；mobile degraded diagnostics。
  - Axe critical violations：0。
  - evidence：`temp/integration-test-runs/20260729043359-bf18a8d8-09fa-4483-844b-d10db9b1d71e/`
  - redaction：0，passed。

## Failure Recheck

- reduced motion：Authority bootstrap spinner 使用 `motion-reduce:animate-none`。
- two-tab：既有 BroadcastChannel / authority signal tests 继续覆盖跨 tab stale、changed 与 signed-out 清理。
- deep link：`/team` 同时进入客户端 current-path 与 BFF login return-path allowlist。
- refresh / revoke / expiry：Team session controls 与 AuthorityGate terminal rescue 共用既有服务端 session revision、SSE 与 cleanup 状态机。
- offline / needs-contract：Team readiness 显示 bounded safe diagnostic，高风险 mutation 不绕过服务端 allowed action 与 Task authorization。
- 403 / 404 / 409：既有 auth client、request policy 与 Task error envelope tests 保持 fail-closed；UI 不显示 provider 原始 payload。
- `unknown_accept`：Team submission 显示 Task authoritative status 并只提供 Task 深链，不自动重试 Identity mutation。

## 运行时边界

真实 Identity mutation gateway 未接入时，服务端 operation/capability 必须继续保持 unavailable 或 fail-closed。该 UI 不创建本地 Identity 真源，也不把 local-session 证据表述为 managed identity 证据。
