## 1. 合同与准入 spec

- [x] 1.1 交付 `specs/workbench-dsh-plugin-lane/spec.md`：三层车道（L0 深链 handoff / L1 server-authored descriptor 与 slash 命令目录 / L2 embedded iframe 门禁）的 ADDED Requirements 与 Scenario。**Owner**: 本 change；**Scope**: 仅 `openspec/changes/workbench-dsh-plugin-lane-v1/`；**验收**: `openspec validate workbench-dsh-plugin-lane-v1 --strict` 通过；**失败复验**: 按 validate 输出修正格式后重跑。
  - Evidence：spec.md 含 6 条 ADDED Requirements 覆盖 L0/L1/L2 与跨仓边界；2026-08-27 归档前复跑 strict validate 通过。
- [x] 1.2 交付 PRD `docs/product/workbench-dsh-plugin-lane.md`：含 `split-owner` 判定表、Required Capability Ledger（C1–C6）、三层车道、跨仓边界与证据要求。**Owner**: 本 change；**Scope**: 仅该 PRD 文件；**依赖**: 无；**验收**: PRD 含 ledger 与判定，且无 required 能力被静默降级为 non-goal。
  - Evidence：PRD §2 判定表（fit/split-owner/reject-now）、§3 ledger C1–C6、§5 三层车道、§4/§7 跨仓边界均在；C1–C3 保持 committed，无静默降级。
- [x] 1.3 spec 锚定 L0 既有冻结合同：引用 `HarnessDshDeepLink`（`workbench.harness.dsh_bridge.v1alpha1`，`packages/task-sdk/src/harness/types.ts:292`）closed 字段全集与 fail-closed 消费语义，不重解释、不扩字段；明确目标端 server 重新验证授权、handoff 字段不构成授权事实。**Owner**: 本 change；**依赖**: 1.1；**验收**: spec Requirement 与 types.ts 字段一致；既有 vitest（`harness-asset-library`/`harness-contract-gates` 的 DSH handoff 用例）不改动仍通过：`bun test`（聚焦 `apps/web/test/harness-contract-gates.test.tsx`、`apps/web/test/harness-asset-library.test.tsx`）。
  - Evidence：types.ts:292 `HarnessDshDeepLink` 字段集（contractVersion/targetRef/sourceSurfaceId/resourceRef/resourceVersion?/mode/embedded?/handoffNonce?）与 spec closed 字段一致；2026-08-27 聚焦 vitest 复跑 10/10 通过（contract-gates 4 + asset-library 6），未改动用例。
- [x] 1.4 spec 锚定 L1 目标方向：server-authored slash 命令目录合同取代 `apps/web/src/workbench/agent/conversation/composer.tsx:260-264` 硬编码（本期不实现、不改 composer.tsx）；closed schema、forbidden field、availability 永远 `server`、未知值归一 `needs_contract`、禁止回退硬编码清单。**Owner**: 本 change；**依赖**: 1.1；**验收**: spec 显式标注本期 spec-only 与过渡期并存纪律。
  - Evidence：spec「L1 slash 命令目录 MUST 是 server-authored 的版本化 closed 投影」Requirement 显式标注本期 spec-only、composer.tsx:260-264 为过渡实现且本 change 不修改；composer.tsx 硬编码确认保持原样。
- [x] 1.5 spec 写明 L2 reject-now 与解锁条件：逐项引用 `docs/design/plugin-ecosystem.md` §7.2 六前提，缺一保持 `needs_contract`；明确不为 iframe 预留任何执行口或 flag。**Owner**: 本 change；**依赖**: 1.1；**验收**: spec 含六前提清单与 reject-now 判定语句。
  - Evidence：spec L2 Requirement 逐项列出 §7.2 六前提并含 reject-now 判定语句；已核实 plugin-ecosystem.md §7.2 恰为对应六条（签名发布/content-addressed/digest-pinned allowlist/default-deny 执行面/kill switch/供应链审计）。

## 2. 边界与红线核对

- [x] 2.1 红线自查：本 change 不新增运行时安装/更新/卸载 API、不引入服务端下发可执行代码、无 fail-open 预留口、不改浏览器-owner 边界；确认 diff 仅含 `docs/product/workbench-dsh-plugin-lane.md` 与 `openspec/changes/workbench-dsh-plugin-lane-v1/`。**Owner**: 本 change；**依赖**: 1.1–1.5；**验收**: `git status --short` 确认无其他文件被本 change 触碰；不 revert/覆盖工作树既有未提交改动。
  - Evidence：`git status --short` 显示本 change 仅新增 PRD 与 change 目录（均为 untracked 新文件），types.ts/composer.tsx 及工作树既有改动未被触碰。
- [x] 2.2 跨仓边界确认：dsh 侧渲染与 Director Pack 明确归外部仓 `agent/harness-plugins`，本仓仅规定 handoff 证据要求（contract digest/version、schema fixtures、failure/tenant 隔离证据、release compatibility）。**Owner**: 本 change；**依赖**: 1.2；**验收**: PRD §4/§7 与 design Decision 4 一致表述。
  - Evidence：PRD §4/§7 与 design.md Decision 4 一致：渲染/Director Pack 归 `agent/harness-plugins`，handoff 证据为 contract digest/version、schema fixtures、failure/tenant 隔离证据、release compatibility。

## 3. 验证

- [x] 3.1 `openspec validate workbench-dsh-plugin-lane-v1 --strict` 通过。**Owner**: 本 change；**依赖**: 1.1–1.5；**预期**: `Change 'workbench-dsh-plugin-lane-v1' is valid`。
  - Evidence：2026-08-27 归档前复跑输出 `Change 'workbench-dsh-plugin-lane-v1' is valid`。
- [x] 3.2 纯 spec/文档交付确认无代码回归：本 change 不改代码，不跑全量测试矩阵；若评审要求可复跑 `bun run typecheck` 与聚焦 vitest 证明工作树既有状态不受本 change 影响。**Owner**: 本 change；**依赖**: 3.1。
  - Evidence：git status 确认零代码改动；聚焦 vitest（harness-contract-gates + harness-asset-library）复跑 10/10 通过，工作树既有状态不受影响。
