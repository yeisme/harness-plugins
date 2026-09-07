## 0. 追溯说明

本 change 为追溯性记录：下列任务对应的实现已于 2026-08-27 完成并验证（见 archive/2026-08-27-workbench-harness-bridge-completion-v1/design.md「后续任务」节的要求）。勾选依据均为既有真实证据，无补做事项。

## 1. 路由挂接

- [x] 1.1 `/harness` 路由以 `lazy` + `Suspense` 挂接 `HarnessConnectedRoute`，fallback 为诚实加载态；导航模型注册 Harness Studio 入口。**Evidence (2026-08-27)**: `apps/web/src/app.tsx:18,41`、`apps/web/src/workbench/navigation/model.ts:110`。
- [x] 1.2 `HarnessConnectedData` 实现 context → descriptors → projections connected 数据流：请求注册到 Authority cleanup 边界、context 四元组一致性比对、错误按 envelope code 映射为诚实 readiness。**Evidence (2026-08-27)**: `apps/web/src/workbench/harness/harness-route.tsx:78-156`；`harness-route.test.tsx` 16/16 pass（run `harness-route-wiring-20260827-r1`）。

## 2. 槽位门禁（fail-closed）

- [x] 2.1 五个组件按 surface 挂入真实槽位，全部经 registry 批准的 catalog descriptor 门禁；无批准 descriptor 时渲染 `needs_contract` 占位，不渲染任何供给数据。**Evidence (2026-08-27)**: `harness-route.tsx:332-426`；`harness-route-wiring.test.tsx` 用例「descriptor catalog 缺供给：五个槽位全部 needs_contract 占位」pass。
- [x] 2.2 descriptor 未批准不渲染：iframe descriptor 未过静态 registry 或非 `sandboxed-iframe` 种类时 iframe 宿主保持关闭；DSH handoff 需 closed 校验 + surface 绑定 + deep-link allowlist 三 gate，点击仅记录意图不导航；action 确认需 context 绑定 + `allowedActionRefs` + installation/surface/digest 精确绑定 + 批准 descriptor，默认 dispatcher 为 SDK fake seam，不伪造 receipt。**Evidence (2026-08-27)**: `harness-route-wiring.test.tsx` 7/7、`harness-action-confirmation.test.tsx` 6/6、`harness-contract-gates.test.tsx` 4/4 pass（同一 run）。

## 3. iframe bridge 时序机接线

- [x] 3.1 `HarnessSandboxedFrame` 接线 per-load `HarnessBridgeSession`：exact source window 校验、`acceptHarnessBridgeInbound` 时序校验、`sendHarnessViewResponse` 一次请求一次应答、任何漂移 fail-closed 卸载 iframe 并显示脱敏 blocked 状态；iframe 钉死 default-deny sandbox/referrerPolicy/csp/allow 属性。**Evidence (2026-08-27)**: `apps/web/src/workbench/harness/iframe-host.tsx`；`harness-iframe-host.test.tsx` 10/10 pass（同一 run）。

## 4. context 切换与周边回归

- [x] 4.1 context key 变化时 `reduceHarnessPresentation` 一次性重置 tab/聚焦/overlay/action preview，路由聚焦默认 tab。**Evidence (2026-08-27)**: `apps/web/src/workbench/harness/context-switch.ts`；`harness-context-switch.test.ts` 7/7、`harness-a11y.test.tsx` 4/4、`harness-asset-library.test.tsx` 6/6、`harness-anatomia-evidence.test.tsx` 8/8 pass（同一 run）。

## 5. 验收

- [x] 5.1 component 证据运行通过：**Evidence (2026-08-27)**: `temp/integration-test-runs/harness-route-wiring-20260827-r1/`（`bunx vitest run` 9 个测试文件、68/68 pass、exit 0；summary.json/command.txt/stdout.log/stderr.log/env.json/artifacts/ 齐全，脱敏已启用）。
- [x] 5.2 全量本地验证通过。**Evidence (2026-08-27)**: `bun test` 与 `bun run typecheck` 在实现完成时全绿（由主代理上一轮验证记录；本 change 不改代码，行为不变）。
- [x] 5.3 `openspec validate workbench-harness-route-wiring-v1 --strict` 通过。**Evidence (2026-08-27)**: valid。

## 后续任务（不在本 change）

- 真实 owner descriptor catalog 合同就绪后，connected 槽位数据流的生产验证与 owner handoff 证据；届时 `needs_contract` 占位应按合同逐步替换为真实供给。
