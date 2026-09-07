# 0.5 P1 local fixture 与依赖预算冻结（2026-09-01）

> 对应 task 0.5。冻结 P1 fixture 形态、数值预算、`three` 依赖决议与 Web bundle 基线/spatial chunk 预算。
> task 5.1 才安装依赖；本波只冻结预算（`three` 当前不在 `apps/web/package.json`/`bun.lock`，已核实）。

## 1. P1 local fixture（deterministic，显式 `fixture` provenance）

| 维度 | 冻结预算 |
| --- | --- |
| shot | **单 shot**（含 3 个 PTS segment：1 cut + 1 gap + 1 正常段；VFR：帧距非均匀，inline frame_intervals ≤4096） |
| actors | **1–2 actors**：actor A 全骨架（16 joints + root），actor B 仅 root placeholder |
| camera | 1 条 keyframed camera path（8 keyframes，含 1 个 hold） |
| scene proxies | ≤24 primitives（ground plane 1、box 6、capsule 2、bounds 3、proxy 12）；frustum 1 |
| overlay/track groups | **≤10**（grayscale/depth/mask/skeleton/camera 5 layer + source_segment/camera/actor_root/joint/receipt 5 track，quality/occlusion 按需在 10 内置换） |
| events | 每 track ≤200 event；contact 8、occlusion 6、receipt 12 |
| duration | 12s @ timebase 30000/1000（rational），帧数 ~288（VFR） |
| fixture 标注 | 所有 segment `limitations` 含 `code=fixture_provenance`；UI/测试不得将其当真实 owner/runtime/production evidence |

## 2. 数值预算（contract validator 与 UI 共用上限）

| 项 | 上限 |
| --- | --- |
| segments | 5 |
| evidence layers | 10 |
| stage objects（primitives 总账） | 64（fixture 用 24） |
| joints/actor | 25（fixture 用 16） |
| keyframes/curve | 32（fixture 用 8） |
| candidates | 4 |
| claim scopes | 8 |
| screenplay nodes | 500（safe_text ≤2000 chars/节点） |
| receipts/page | 100（gap_detected 语义见 02 §6.2） |
| actions/descriptors | 24 |
| inquiry question | 512 chars |
| action input_json | 16 KiB |
| projection response 总量 | 256 KiB（超限 → `contract_mismatch`） |
| timeline 可见 window | 40 rows + overscan 10（fixture 远小于上限；virtualization 行为测试用合成大 fixture，不入 P1 media） |

## 3. 依赖决议：`three`

- **现状核实**（2026-09-01）：`apps/web/package.json` dependencies/devDependencies 无 `three`；`bun.lock` 无 `three` 条目。**本波不安装**。
- **批准范围（task 5.1 执行）**：仅 `three` core + 包内 `examples/jsm/loaders/GLTFLoader`（同 npm 包，无第二依赖），版本取当时 latest stable 并在 5.1 记录；**禁止** React Three Fiber、Drei、第二 scene-state store、任何 Three 类型进入 wire contract/SDK/Pane props。
- **加载方式**：`ReplicaViewportAdapter` 内 `await import("three")` 动态加载；vite `manualChunks` 增加 `spatial-replica-3d` lazy chunk；capability off / `<1024` viewport / viewport3d 未启用时该 chunk 不得进入任何加载路径（task 5.1 验收：普通 `/agent` build 无 three）。
- **chunk 预算**：`spatial-replica-3d` gzip ≤ **250 KiB**（预期 three core+GLTFLoader ≈ 170 KiB gzip）；其余 chunk gzip 增量 ≤ **30 KiB**（replica Pane/registry/i18n 代码）。超预算：先降 scene/render cost 或收窄 import，不删 provenance/unknown，不扩依赖（task 0.5 失败复查条款）。
- 复用既有：timeline 用 `@tanstack/react-virtual`；overlay 用 bounded 2D canvas adapter（不引 pixi 进 replica 面）；不新增任何其他 runtime 依赖。

## 4. Web bundle 基线（2026-09-01，`bun run --cwd apps/web build`，vite 7.3.6）

> 基线在 dirty worktree（r4/canvas-v3 等并行在制品）上取得，代表「本 change 前的当前态」，非 clean-develop 数字；后续 wave 对比时以同环境复跑为准。

| chunk | minified | gzip |
| --- | --- | --- |
| index（主入口 `index-9QJ7ILZN.js`） | 1,856.19 kB | 463.59 kB |
| index（`index-onTI73M1.js`） | 878.76 kB | 253.33 kB |
| ui-vendor | 614.67 kB | 199.02 kB |
| dockview | 359.25 kB | 81.73 kB |
| app-vendor | 151.22 kB | 43.07 kB |
| harness-route | 39.33 kB | 11.70 kB |
| route | 28.88 kB | 8.17 kB |
| compatibility-messages | 23.15 kB | 5.72 kB |
| spatial-worker | 11.07 kB | — |
| CSS（index/dockview/ui-vendor） | 428.65 kB | 60.46 kB |

- 构建结果：`✓ built in 12.82s`，3080 modules；无 `three`、无 `spatial-replica-3d` chunk（符合 default-off 预期）。
- 既有告警：两个 chunk >500 kB（ui-vendor 614.67 kB、index 1856.19 kB）为 pre-existing，不因本 change 恶化；replica 面新增代码必须走 lazy 路径，不进主入口。

## 5. 性能/资源生命周期 gate（task 5.6/e2e 复用本冻结值）

| 指标 | gate |
| --- | --- |
| confirmed sync drift（video/overlay/3D/timeline） | ≤ 1 source frame（按 PTS map 相邻帧距，非固定 fps） |
| selection feedback（pointer+keyboard） | <100ms 可见 |
| repeated main-thread long task（play/scrub） | 无重复 >50ms |
| first 3D frame / frame-time / heap | 记录 env + p50/p95，不声明 production SLO |
| 资源释放 | Pane close / shot switch / capability off / WebGL loss 后 renderer/buffer/texture/media callback/observer/subscription 计数归零，无界增长为零 |
| stage 超预算 | `view_too_large` + summary/deep link，不静默降采样 |
