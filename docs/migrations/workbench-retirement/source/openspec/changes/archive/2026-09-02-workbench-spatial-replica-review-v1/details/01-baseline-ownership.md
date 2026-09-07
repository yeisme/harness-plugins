# 0.1 实施基线、path lease 与单一 tracked-file writer（2026-09-01 冻结）

> 对应 task 0.1。本文记录第一波开始时的 dirty-worktree、并行 change、依赖版本与写入权划分。
> 后续波（合同层 1.x、composition 层 2.x、Pane 层 3.x 起）必须先复核本文 lease，再开始写入。

## 1. 仓库快照

| 项 | 值 |
| --- | --- |
| repo | `client/yeisme-workbench` |
| branch | `develop` |
| HEAD（快照时） | `81cc221` |
| 工具链 | bun `1.3.14`、go `1.26.4`（`service/go.mod` 声明 `go 1.26.0`）、vite build `7.3.6` |
| 快照命令 | `git status --short`、`git diff --name-only` |

Dirty-worktree 总量（快照时刻）：**320** 个 status entry = **152** modified + **19** deleted + **149** untracked；`git diff --name-only` 计 **171** 个 tracked 变更。树脏属正常：全部来自其他在途 change 的并行会话。

## 2. 变更分类（introduced / pre-existing / concurrent）

### 2.1 introduced（本 change 拥有，允许写入）

- `openspec/changes/workbench-spatial-replica-review-v1/**`（proposal/design/README/tasks/specs + 本 `details/`）
- `docs/product/spatial-replica-review-workspace.md`
- `docs/interfaces/spatial-replica-review.md`
- `docs/ui/spatial-replica-review-workspace.md`
- `docs/README.md` 中指向上述三份文档的索引行（已存在的三行，勿动其他行）

### 2.2 pre-existing / concurrent（禁止写入、禁止 revert/checkout 抹除）

按并行 change 归属（不完整清单，完整名单见 `git status --short`）：

| 并行 lane | 代表性脏文件 |
| --- | --- |
| `workbench-spatial-workflow-automation-r4` | `apps/web/src/workbench/agent/spatial/spatial-surface.tsx`、`workflow-lens/**`、`service/internal/runtime/spatial_*.go`、`api/proto/workbench/spatial/v1/spatial.proto` |
| `workbench-spatial-canvas-experience-v3` | `service/internal/spatial/model_v3.go`、`service_v3.go`、`service/internal/repository/spatial_canvas_v3_*.go`、`packages/task-sdk/src/spatial-v3-*.ts`、`openspec/changes/workbench-spatial-canvas-experience-v3/` |
| `workbench-film-production-readiness-v1`（已归档，落地未清） | `apps/web/src/workbench/agent/spatial/film-production/`、`service/internal/filmproduction/`、`api/proto/workbench/film/` |
| `workbench-ai-drama-director-canvas-v1`（已归档，落地未清） | `apps/web/src/workbench/agent/spatial/director-canvas/`、`service/internal/showcontrol/directorcanvas.go`、`packages/task-sdk/src/director-canvas-*.ts` |
| `workbench-production-ga-r5` / `daily-operations-r3-gates` 等 | `service/internal/operations/**`、`apps/web/e2e/daily-ops-real-backend.spec.ts` 等 |
| identity / owner-backend / personal-radar 等其余在途 | `service/internal/identity/account_linking*.go`、`service/internal/adapters/radar*.go`、`apps/web/src/workbench/personal-radar/` 等 |

关键交叉点：**`api/proto/workbench/agent/v1alpha1/agent.proto`（共享 `ActionDescriptorV1` 所在文件）与 `api/proto/workbench/spatial/v1/spatial.proto` 当前均为 concurrent 修改状态**。本 change 后续波在 `api/**` 追加字段前必须重读当时文件内容，只做 append/additive，绝不覆盖或回滚并行修改。发现 lease 重叠无法解耦时：停止写入并重新划界（task 0.1 失败复查条款）。

## 3. 现有 Agent/Spatial/Show Control changes 快照（openspec list，2026-09-01）

| change | 进度 | 与本 change 的关系 |
| --- | --- | --- |
| workbench-spatial-workflow-automation-r4 | 103/118 | 同域并行；占用 `spatial/**` 既有文件与 spatial.proto |
| workbench-spatial-canvas-experience-v3 | 23/24 | 同域并行；占用 spatial V3 capability/registry 面 |
| workbench-production-ga-r5 | 35/103 | 仓级 gate；evidence 目录与整体门禁 |
| workbench-daily-operations-r3-gates | 2/4 | operations 面 |
| workbench-client-runtime-promotion-gates | 1/3 | client runtime 面 |
| workbench-dsh-ai-drama-bridge-consumer-v1 | 12/13 | ai-drama 消费面 |
| workbench-project-data-staging-soak-v1 | 30/32 | data staging |
| workbench-production-foundation-r0 | 15/16 | 基础面 |
| workbench-harness-studio-v1 | 19/22 | harness 面 |
| workbench-project-data-workspaces-v1 | 60/62 | workspace 面 |
| workbench-identity-tenant-access-r1-gates | 3/5 | identity 面 |

无名为 "show-control" 的 active change；Show Control 面由已归档 director-canvas / film-production lanes 的落地文件构成（见 2.2），本 change 不触碰。

## 4. 依赖版本基线

| 依赖 | 版本 | 用途/备注 |
| --- | --- | --- |
| react / react-dom | 19.1.1 | Pane/shell |
| @tanstack/react-query | ^5.83.0 | projection/Task cache |
| @tanstack/react-virtual | ^3.14.10 | timeline 虚拟化（复用，勿引第二虚拟化库） |
| @xyflow/react | 12.11.2 | 既有 spatial 用 |
| pixi.js | ^8.13.2 | 既有 2D spatial renderer；replica overlay 不复用 pixi（用 bounded 2D canvas overlay adapter） |
| dockview-react | 7.0.2 | Pane 布局 |
| lucide-react / radix-ui | 既有 | controls |
| @playwright/test | ^1.54.1 | e2e/视觉矩阵 |
| **three** | **未安装**（`apps/web/package.json` 与 `bun.lock` 均无） | 见 0.5：本波只冻结预算，不安装；安装属于 task 5.1 |

## 5. Path lease 与单一 tracked-file writer（后续波强制遵守）

本 change 的四个实现路径族各自**串行单写**（同一时刻至多一个会话持有写权；按波次交接）：

| 路径族 | 指定 writer | 波次 |
| --- | --- | --- |
| `api/**`（proto/schema/locale 中的 replica 新增） | **本 change 的合同层会话（wave 1.x）为唯一 tracked-file writer**；跨波串行继承：任何后续波要写 `api/**` 必须声明接管该 lease 并重读当时文件。其他并行 change 的 `api/**` 修改不受本 lease 约束，但重叠文件（agent.proto、spatial.proto）只允许 append，不允许改写并行会话已落的行 | 1.x 建文件；2.6/9.x 校验时只读 |
| `service/internal/spatialreplica/**` | composition 层会话（wave 2.x）独占；该目录当前不存在，新建即本 change 所有 | 2.x |
| `packages/task-sdk/src/spatial-replica-*`（models/client 及 index 挂载） | SDK facade 会话（wave 1.x 后半）；`workbench-client.ts`/`index.ts` 挂载点为共享文件，只允许 additive 单行级修改并先重读 | 1.3 |
| `apps/web/src/workbench/agent/spatial/replica-review/**` | 前端会话（wave 3.x–7.x）独占；该目录当前不存在。`spatial/` 下其他文件属并行 lane，禁改 | 3.x 起 |

附加边界：

- 共享挂载点（`agent-pane-registry.ts`、`agent-pane-manifest.ts`、`agent-route.tsx`、i18n catalog）属多 lane 交叉文件：只允许 additive 注册行，写入前重读，冲突时停止并重新划界。
- 本波（0.x）未写任何 `api/**`、`service/**`、`packages/**`、`apps/**` 源码；`bun run --cwd apps/web build` 与 go test 仅作为基线证据命令运行，不改产物入 git。

## 6. 基线验证命令记录（2026-09-01）

- `git status --short` / `git diff --name-only`：见第 1 节数字；分类见第 2 节。
- `openspec list`：见第 3 节。
- `CGO_ENABLED=0 go test ./internal/config ./internal/runtime -count=1`（于 `service/` 执行）：`ok ... config 0.005s`、`ok ... runtime 48.430s`（0.4 基线）。
- `bun run --cwd apps/web build`：成功，chunk 基线见 `05-p1-fixture-dependency-budget.md`（0.5 基线）。
