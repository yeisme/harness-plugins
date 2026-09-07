# Tasks

## 1. Typed projection 消费

- [x] 1.1 实现 Anatomia 参考组件/gap/risk/时间码/动作投影的 typed client；schema 校验失败 fail closed。
  - **Evidence (2026-09-06)**: 合同源核对为 Anatomia owner 冻结 openapi（agent/anatomia `api/openapi.yaml` `ProductionReferencePackage/Component/Coverage/Gap/GapOutcome/Blocker/EvidenceTimeRange`，additionalProperties:false——设计风险注记"Anatomia 投影 schema 尚未实现"经核对已过时：production-reference API 面已冻结上述 schema）。消费侧落地 `packages/task-sdk/src/anatomia-reference-models.ts`——三类组件（kind=character_appearance|scene_prop|action_shot 冻结 enum）、gap（gap_ref/code/detail/resolution_action）、blocker（risk 面）、时间码（Coverage 携带 source_ref+media_clock_ref 锚定当前源时钟，µs ranges 有序校验 start>=0/end>=1/end>=start）与包级 GapOutcome 的 camelCase 投影 + fail-closed normalizer（未知字段拒绝对齐 openapi additionalProperties:false、敏感键递归拒绝、封闭 enum、safe ref 语法、数组上限、package_version>=1/required_open_gaps>=0）；`index.ts` 导出。单测 `packages/task-sdk/test/anatomia-reference-models.test.ts` 6/6（三类 kind 正例、未知字段/敏感键/enum 越界/乱序与负 µs range/缺必填负例全过）；evidence run `20260906082717-750ad678-cb5f-42a8-a245-8b37a460a754`（六件套，6 pass/0 fail/exit 0）；`bun run typecheck` 全绿；`bun run test:contract` 659 pass / 0 fail / 86 files（+6 全为本任务，零回归）。
- [x] 1.2 实现坐标变换一致性：覆盖层与当前播放源的时间轴/二维站位对齐；源切换或版本不匹配时重新解析或降级，不跨源外推。
  - **Evidence (2026-09-06 第二波)**: `resolveAnatomiaReferenceAlignment`（`anatomia-reference-models.ts`）——覆盖层对齐锚定当前播放源（source_ref+media_clock_ref 双精确匹配才返回 µs ranges）；源切换→`source_mismatch`、时钟不匹配→`clock_mismatch`、无覆盖→`no_coverage` 显式降级提示重新解析，绝不跨源外推；`playbackPositionInRanges` 提供当前位置判定。组件测试覆盖三种 mismatch 场景。
- [x] 1.3 保持无客户端真源：session 内 memoization 允许，durable 缓存禁止。
  - **Evidence (2026-09-06 第二波)**: `WorkbenchAnatomiaReferenceClient`（`anatomia-reference-client.ts`）——package 读取 session-scoped memoization（实例内 Map + `refetch` 显式覆盖 + `clearMemoizedProjections()`）；gap outcome/decision 不 memoize（动作面每次经 Task 控制面）；无 durable 存储，无第二参考真源。

## 2. 播放器与覆盖层

- [x] 2.1 实现播放器定位参考组件（三类）与时间码覆盖层。
  - **Evidence (2026-09-06 第二波)**: `apps/web/src/workbench/agent/anatomia-reference/reference-overlay.tsx`——播放器定位三类参考组件（character_appearance/scene_prop/action_shot 中文标签）+ 当前源对齐时间码 chip（µs→mm:ss.mmm 格式化）；positionUs 命中 range 时 active 高亮。组件测试断言三类渲染与 timecode 内容。
- [x] 2.2 实现 gap/risk 标注：缺证据区域显式 gap；不确定状态不只靠颜色表达；键盘可达。
  - **Evidence (2026-09-06 第二波)**: gap 标注 `⚠ 缺口 code：detail（恢复动作：resolution_action）` 文本+图标双表达；组件 state partial/unknown 渲染『证据不完整/状态未知』徽标（非仅颜色）；键盘可达（ul+button，aria-label 携带 ref/kind/state）。组件测试断言 gap 文本、state 徽标与 button role。
- [x] 2.3 实现 stale/degraded/owner 不可用的诚实状态与恢复动作提示。
  - **Evidence (2026-09-06 第二波)**: `ownerUnavailableReason` prop 渲染 owner 不可用诚实状态（role=status + 恢复提示『待 owner 可用后重新读取投影』，不渲染猜测数据）；source/clock/no_coverage 三类 mismatch 显式提示重新解析。Go adapter 侧 owner_not_configured/owner_unreachable/contract_mismatch honest unavailable 全测。

## 3. 审阅动作

- [x] 3.1 实现审阅动作走 owner-approved action surface（action identity、expected version、receipt/reconcile），目标 Anatomia 局部审阅/修正 operation。
  - **Evidence (2026-09-06 第二波)**: `workbench.anatomia_reference.claim.decide` mutation operation（RequiresIdempotency+RequiresPermission）→ Go adapter POST `/api/v1/evidence-claims/{claim_ref}/decisions`（owner-approved action surface，wire 形 `contract.ClaimReviewDecision`：claim_ref/disposition 五值封闭枚举/expected_version/reviewer_ref/idempotency_key）；响应只取 bounded envelope（kind/ref/status）作 owner receipt——审阅只形成 owner 侧 decision（pending/needs_adjudication 归 owner），Workbench 不替 owner 签收。SDK `decideClaim` 经 Task 控制面 + unknown 状态不自动重试。Go 测试断言 decision wire 形状与非法 disposition invalid_argument。
- [x] 3.2 边界测试：不读 owner 数据库/私有文件；审阅只形成 owner 侧 pending review；无第二参考真源。
  - **Evidence (2026-09-06 第二波)**: 边界三断言——①不读 owner 数据库/私有文件：adapter 只调三个 allowlisted HTTP route（ownersec URL 策略 loopback/HTTPS，unsafe ref 拒绝测试）；②审阅只形成 owner 侧 pending decision（响应 envelope 只取 kind/ref/status，不复制 owner case 状态机）；③无第二真源：overlay 组件纯 props 消费（模块无 fetch/localStorage 导出，组件测试断言）+ SDK 只 session memoization。
- [x] 3.3 组件测试覆盖三类组件视图、坐标变换与全部降级状态。
  - **Evidence (2026-09-06 第二波)**: `apps/web/test/anatomia-reference-overlay.test.tsx` 7/7——三类组件视图、对齐/三种 mismatch、owner 不可用、键盘可达+选择回调、边界断言；`packages/task-sdk/test/anatomia-reference-models.test.ts` 6/6（含坐标 range 校验）；Go adapter 测试 4 组（package happy path、四类 invalid fail-closed、decision 封闭形状、unavailable 三态）。

## 4. Closeout

- [x] 4.1 更新 Workbench docs 与根 handoffs.md 引用（拟建→已建立）。
  - **Evidence (2026-09-06 第二波)**: 新增 `docs/ui/anatomia-reference-review.md` 并登记 `docs/README.md`；根 `anatomia-production-reference-reuse-program-v1/handoffs.md` Workbench 行引用更新（规格冻结→消费面已落地：typed client+BFF adapter+覆盖层+claim decision）。
- [x] 4.2 `openspec validate workbench-anatomia-reference-review-v1 --strict --no-interactive` exit 0；实现与验证证据齐备后归档。
  - **Evidence (2026-09-06 第二波)**: `openspec validate workbench-anatomia-reference-review-v1 --strict --no-interactive` exit 0；11/11 任务全勾；全 gates：go 全量（-count=1 零 FAIL）、bun **1090/0**（166 files）、contract **659/0**、web **252 files / 2088 tests 全绿**、evidence run `20260906084234-a5a04c60-3702-4f90-a30e-994d76124888`（passed/exit 0）；按本任务条款归档。
