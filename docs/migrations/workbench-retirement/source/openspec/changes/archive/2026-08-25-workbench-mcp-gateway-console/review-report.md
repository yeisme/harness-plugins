# Gateway Console 最终审查

日期：2026-07-28

## 结论

**GO（本地交付）**。稳定 diff 经正确性与安全复核后，P0=0、P1=0。Gateway owner consumer canary 已于 2026-08-12 通过；该结论仍不得用于声明远程、staging 或 production 可用。

## 审查范围

- typed `WorkbenchClient.gateway` 查询边界与同源 BFF 路径；
- Overview、Backends、Approvals、Activity 路由与响应式布局；
- Task 控制面 mutation、revision、idempotency 与 fail-closed 行为；
- 浏览器 credential、generic proxy、raw payload、private URL 与 console/network 泄漏；
- unknown acceptance 的 adapter 映射、无自动重放与 reconcile 投影；
- 测试证据 runner 的 PNG artifact 收集、签名、大小和摘要校验。

## 发现与修复

- 已修复 P1：刷新期间旧投影曾可能保留 mutation callback。现在刷新先清空投影，只有 `capabilityState=available` 且 `freshness=fresh` 的 authoritative projection 才启用操作；stale 测试验证不提交 Task。
- 已修复可访问性缺口：审批确认取消或提交后恢复到原 approve/reject trigger，E2E 验证键盘焦点。
- 已修复证据缺口：E2E 三个 viewport PNG 现在由 evidence runner 写入本次 `artifacts/`，并进入 SHA-256 摘要。

## 证据

- Integration：`temp/integration-test-runs/20260728040016-74c35a93-6108-4cad-b906-feed63ef2bef/`，完整 Gateway adapter、registry 与 conformance 包通过。
- E2E：`temp/integration-test-runs/20260728035920-1314696c-a62b-4614-90b3-0bd49ac90b5c/`，3 tests PASS，含 1440×900、768×1024、390×844 三张 PNG artifact。
- Full Web E2E：`temp/integration-test-runs/20260728040223-55351c9a-8ba1-4315-9334-ebc54bb309b0/`，31 tests PASS，Gateway artifacts 同步进入完整回归证据。
- Web focused：Gateway 组件 46 tests PASS；Gateway Console fail-closed 回归后相关 25 tests PASS；typecheck 与 Vite build PASS。
- SDK focused：Gateway contract/client/fixture 110 tests PASS。
- Evidence runner：`tests/evidence/run.test.ts` 16 tests PASS，覆盖安全 PNG 收集与非法 artifact 拒绝。

## 剩余风险

- Gateway owner 归档证据记录了 checked-in Workbench adapter 对 built Gateway binary 的本地 loopback canary：`gateway.runtime.reload` 成功，receipt `receipt:8ab77a0bebfa16d2`。这关闭 `8.3` 的 owner-consumer 依赖，但 remote Gateway、public ingress、staging 与 production readiness 仍未验证。
