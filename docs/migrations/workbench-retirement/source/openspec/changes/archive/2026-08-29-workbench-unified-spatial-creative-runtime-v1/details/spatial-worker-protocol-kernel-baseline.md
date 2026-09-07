# Spatial Worker 协议与桌面内核测试矩阵

## 1. 交付结论

3.2 与 3.6 的本地实现面已闭合：tile decode、index、clustering、hit-test、replay、bounded layout 六类计算收敛为一个封闭 Web Worker 协议；主线程 `SpatialWorkerBridge` 提供有界 task 队列、取消传播与 degraded 主线程回退；Pixi renderer 的裸 `postMessage` 路径已迁移到 bridge。32 条新增 vitest 全部通过，根 typecheck（SDK + web）干净，31 条既有 spatial 测试无回归。tasks.md 复选框留给主代理统一验收后勾选。

## 2. 协议形状（design.md 决策 6 的落实）

文件：`apps/web/src/workbench/agent/spatial/spatial-worker-protocol.ts`

- 请求 union（closed，`protocolVersion: "workbench.spatial_worker.v1"`）：
  `capability | decode_tiles | index_primitives | cluster | hit_test | replay | layout_preview`。
- 响应 union（closed，按 `id` 关联）：每个请求 kind 有唯一响应形状 + `error`（closed reason code：`protocol_version_unsupported | invalid_request | index_capacity_exceeded | layout_target_limit_exceeded`）。
- 有界硬上限（与 SDK `normalizeTile`/`normalizeSpatialViewportResponse` 对齐，单点 clamp 函数两侧共享）：tile 节点 8192、index 容量 8192（超限丢最旧）、cluster 输出 1024、replay 事件 512、layout 目标 2000（>2k 必须走服务端 `PlanSpatialLayout`）。
- 无共享可变状态：消息全部 plain data（structured-clone 安全，测试断言）；worker 索引仅存在于 worker 内部；主线程只能通过协议观察。取消 = 主线程丢弃 resolver，worker 不感知取消，因此没有可泄漏的 pending 状态。
- worker 内不触网：协议不包含 transport、URL、fetch 语义；紧凑 primitive 仅携带 ref/nodeType/几何，owner 文本（title/ownerRef）不进入 worker（测试断言键集合）。
- 未识别消息 fail closed：worker 回 `error(invalid_request)`，bridge 直接丢弃。

## 3. 主线程 bridge（调度面）

文件：`apps/web/src/workbench/agent/spatial/spatial-worker-bridge.ts`

- 有界队列：inflight(1) + pending ≤ 容量（默认 32），超队 `submit` 返回 `null`（fail closed，不静默无限排队）；同一时刻一个 inflight 保证内存与消息顺序有界。
- 取消传播：`cancel(id)` 从 pending 出队或丢弃 inflight resolver；worker 迟到响应因 resolver 不存在被静默丢弃——无悬挂 promise。
- degraded 回退：`Worker` 缺失/构造失败、worker `onerror`、或 OffscreenCanvas 探测 degraded 时，capability 投影 `degraded`，同一协议请求交给注入的 `mainThreadFallback`（3.4/3.5 有界 DOM 主线程路径）同步执行；协议形状不变，只有执行位置变化。worker 出错时 inflight 任务以 `failed` 结算（协议无副作用，重提交安全），排队任务按提交顺序转主线程。
- 结果形状：`{ outcome: "worker" | "fallback" | "failed", value }`，供 capability 投影区分真实 worker 与回退。

Renderer 集成：`pixi-spatial-renderer.tsx` 用 bridge 替换裸 worker——首帧提交 `index_primitives(reset:true)` 并以 outcome 投影 `onWorkerCapability`；点击路径经 `submitHitTest`，队列满时该次点击不产生选择（fail closed）。

## 4. 测试矩阵（3.6）

新增四个测试文件、32 条用例：

- `test/spatial-worker-protocol.test.ts`（5）：封闭性（未知 kind/版本拒绝）、错误响应封闭、协议常量与 SDK 预算对齐、clamp 有界、structured-clone 安全。
- `test/spatial-worker-kernel.test.ts`（7）：mock worker 全局加载 worker 模块，覆盖 OffscreenCanvas available/degraded 探测、tile decode（self-loop relation 拒绝、dropped 计数、owner 文本不入 worker）、malformed 请求 fail closed、容量驱逐（evict oldest）、LOD 格网 clustering、bounded replay（apply/reject/lastEventRef，重演后几何即时反映到 hit-test）、2k layout 上限与 unknown ref 拒绝。
- `test/spatial-worker-bridge.test.ts`（11）：无 worker 降级、无回退 failed 结算（不悬挂）、单 inflight + 排队、超队 null、取消 inflight/queued、顺序结算、worker 出错降级（inflight failed + queued 转回退 + terminate）、非协议消息丢弃、dispose 结算与拒绝后续提交、协议版本注入与 clamp。
- `test/spatial-surface-kernel.test.tsx`（9）：LOD 阈值与预算（far/medium/near，4096 primitives）、selection（additive、2k 上限、clear）、键盘/可访问 overlay 焦点镜像 selection、worker replay 协议闭合、renderer context-loss（jsdom 中 pixi mock reject → `data-render-failure=true` 显式降级 + 有界列表仍可用）、near LOD DOM mount 预算（220 interactive 节点 → 恰 200 个 overlay）、far LOD 零 rich DOM（cluster 代替）、desktop-required unavailable state（无 transport 时明确降级态、无隐藏编辑器、Plan layout 禁用）、layout preview presentation-only（进入 review Lens、`applySpatialChangeSet` 不得自动调用）。

测试模式遵循仓库现状：jsdom + testing-library + 纯 vi.fn client 注入；worker 用「mock `self` 全局 + 动态 import worker 模块」模式，bridge 用注入 `createWorker` mock；pixi.js 动态 import mock 为 reject 以验证显式 degraded（不伪造 WebGL）。

## 5. 验证

- `cd apps/web && bunx vitest run`（聚焦 4 个新文件）：32/32 通过，0 unhandled errors。
- `cd apps/web && bunx tsc --noEmit`：0 错误。
- 根 `bun run typecheck`（SDK tsc + web tsc）：通过。
- 回归：`spatial-state`、`spatial-ingress`、`spatial-board`、`agent-route` 共 31 条既有测试全部通过。
- 租约：仅触碰 `apps/web/src/workbench/agent/spatial/**` 与 `apps/web/test/spatial-*.test.ts*`；未动 tasks.md、Taskfile、docs、service、task-sdk（协议类型全部复用既有 `spatial-models.ts` closed models，零 SDK 改动）；未 git commit。

## 6. design.md 歧义点与裁决

1. **"replay" 的具体语义未在 design.md 展开**。spec 只要求 worker replay 可测试。裁决：replay = 把 Board receipt 派生的几何事件按序重演进 worker 索引（geometry_update/node_create/node_delete 三种 closed kind），返回 applied/rejected/lastEventRef 计数作为有界证据；不引入第二事件流，不伪造 Board 修订。
2. **capability 探测时机**：design.md 未规定探测请求的发起方。裁决：renderer 首帧提交 index 时顺带带回 capability（`index_primitives` 响应前独立 `capability` 请求保留给显式探测），`Worker` 全局缺失时直接投影 degraded，不阻塞首帧。
3. **hit-test 与 DOM overlay 双路径**：near LOD 同时有 worker hit-test 与 DOM overlay 按钮。裁决保持既有行为：overlay 命中走按钮（flushSync 同步选择），canvas 点击走 worker hit-test；两者都收敛到同一 `select` reducer，无第二选择状态。
4. **clustering 的服务端/客户端职责**：viewport response 已含 server clusters。裁决：worker clustering 是 far/medium LOD 的本地聚合（256/128/64 格网），用于 renderer 在 server clusters 缺失时仍有有界聚合可渲染；不反向写回任何 canonical 状态。
