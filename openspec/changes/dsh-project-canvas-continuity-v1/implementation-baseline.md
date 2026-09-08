# 画布实现基线与证据

## 2026-09-08：写前日志、确定性对账与冲突显式恢复（2.2b）

### 实现

- `packages/host/pane-protocol/src/index.ts` 增量扩展未发布合同：`ProjectCanvasReadResult` 的 ready/missing 可带 `draft`（journal中的提交意图：requestId/baseRevision/document），`ProjectCanvasSaveResult` 新增 `not_applied`（已记账但commit未落盘的确定性对账答案）。旧行为原义不变，均为additive。
- `project-canvas-store.ts` save 先写 write-ahead journal（requestId/digest/baseRevision/完整document）再原子commit同一row；journal写失败返回 `unavailable`（未发生任何写入），commit写失败返回 `unknown` 且journal可恢复。存在未结算的其他requestId journal时拒绝新save（unknown），不覆盖journal。reconcile：回执存在→saved；journal命中且无回执→确定性 `not_applied` 并尽力清除journal；其余保持unknown，绝不自动重放。
- read 把revision 0的row识别为仅journal占位（已commit的row revision恒≥1），返回 `missing+draft` 或 `ready+draft`，不把未确认内容伪造成确认文档；draft仅在baseRevision与当前确认revision一致时 surfaced。
- `project-canvas-controller.ts` load 时先对账上一个会话留下的journal：`not_applied` 且base未移动→把journal document恢复为dirty编辑（跨刷新未保存草稿恢复）；base已移动→忽略过期journal，不reconcile。保存/对账返回 `not_applied`→草稿保持dirty，可用新requestId重存。conflict 记录owner确认revision，`resolveConflict('reapply')` 把本地草稿rebase到该revision重存，`'discard'` 显式丢弃重读；不自动覆盖任何一方。
- `project-canvas-view.tsx` conflict 态新增“在最新版上重存”按钮（中英locale），reload既有discard确认路径不变。

### 验证及证据边界

- Host store 13项 focused（journal失败分类、跨重挂载draft surfaced、not_applied结算与新requestId重存、foreign journal阻断）；controller 10项（journal草稿恢复、过期journal忽略、unknown→not_applied重存、reapply/discard）。
- 真实storage-domain + JSON磁盘journal恢复集成测试通过：模拟“journal已落盘、commit丢失”，销毁重挂载后read返回missing+draft、reconcile返回not_applied、恢复草稿以新requestId落盘revision 1。证据：`temp/integration-test-runs/project-canvas-storage-20260908033330Z-3349834/`。
- 仓库 typecheck 0 error、check:bundles 27/27、check:surfaces 0 findings、check:plugins 全过（safe-projection 680项）、`visual-project-canvas.spec.ts` 4项通过。
- 边界：非真实DSH Host生命周期/多会话并发写验收；多进程并发写仍不支持；journal草稿恢复覆盖“至少提交过一次”的编辑，纯本机未保存输入跨刷新仍不声明。

## 2026-09-08：Host 保存与首个可操作画布切片

本节更新下方早期内核记录：现已安装固定 `@xyflow/react@12.11.6`，注册 `creator.canvas` Pane，并接通 Creator Studio Host 的增量 `canvasRead/canvasSave/canvasReconcile`。这是实施中的垂直切片；父任务2.2/2.3与完整交互、真实owner验收仍保持未完成。

### 实现

- `packages/host/creator-studio/src/project-canvas-store.ts` 使用现有 storage-domain 及 JSON 后端；只存画布文档与有界保存回执。存储键由可信上下文的tenant/workspace/project/document构成，浏览器不能指定tenant。单Host store串行执行revision校验和保存，写入完成才确认新revision。
- 重复requestId及相同内容返回原回执，复用ID修改内容返回冲突；提交后响应未知时仅对账。最近32条回执之外的请求保持unknown，不以缺失回执推定失败。此store不支持多进程并发写入，不建立调度器。
- `project-canvas-controller.ts` 保留正在保存时的后续编辑；确认回执仅推进revision，不能覆盖后续输入。保存unknown禁止再次提交；冲突保留草稿。拖动/缩放合并为一次撤销，并处理手势期间保存完成后的history revision。
- `project-canvas-view.tsx` 使用真实React Flow与现有Surface、tokens、primitive，提供节点草稿编辑、引用/操作入口、选择、拖动、调整尺寸、分组、复制、撤销、搜索、相机、小地图及仅检查草案的范围入口。执行尚未接通。节点尺寸属于动态几何，已登记surface检查白名单；参考边样式留在静态CSS。
- `project-canvas-pane.tsx` 按项目缓存控制器，关闭Pane保留内存草稿，重开读取已保存文档；Host缺失或无效snapshot显示不可用。专业面板跳转尚未验收固定版本选择的端到端一致性。

### 验证及证据边界

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-domain run test
pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-domain run build
pnpm --filter @yeisme/dsh-pane-domain run build
node scripts/run-project-canvas-storage-integration.mjs
node scripts/run-ui-visual-tests.mjs visual-project-canvas.spec.ts
pnpm run check:surfaces
pnpm run check:plugins
```

- 客户端132项测试通过，包含6项保存控制器测试；client typecheck/build与pane bundle build通过。既有React act警告仍保留。
- Host保存/Gateway focused共19项通过；Creator Studio bundle 8项与Pane bundle 5项通过，无skip。Host与Creator Studio bundle类型检查通过。
- 真实storage-domain + JSON磁盘后端重挂载测试通过：`temp/integration-test-runs/project-canvas-storage-20260908023018Z-2101503/`。验证读取缺失文档、磁盘保存、销毁新建Context后恢复文档和回执、旧revision冲突。使用合成文档，不是实际领域owner调用。
- 浏览器360/560/960宽度下“创建→编辑→保存→重开”3项通过；截图与日志位于 `temp/integration-test-runs/ui-visual-2026-09-08T02-34-28-756Z-2146330/`。同轮新增拖拽测试因测试断言未扣除库的拖拽起始阈值失败；将位移断言改为验证显著移动，未改实现来迎合断言。focused复验拖拽一次撤销/重做、缩放撤销恢复viewport通过，证据位于 `temp/integration-test-runs/ui-visual-2026-09-08T02-34-59-503Z-2153651/`。浏览器使用真实ModuleLoader bundle/React Flow，Host存储与primitive为fixture，不能替代真实DSH profile或owner验收。
- Surface规范检查通过；插件六项检查全部通过：`temp/toolchain-runs/2026-09-08T023356470Z-toolchain/`。

### 继续任务

父2.2：已提交过至少一次的草稿与unknown请求可跨刷新恢复（2.2b journal）。仍须验证：真实Host生命周期、多会话/多进程并发冲突、存储失权/损坏恢复；纯本机未提交输入跨刷新仍不声明自动保存。

父2.3及3组：挂载期间项目/权限切换订阅、迟到snapshot隔离、HMR、真实locale和专业面板选定版本双向同步仍未完成。完整媒体可访问性、离屏行为、200%缩放、中文输入法、完整画布连接键盘等价操作，以及300节点60分钟性能测试继续保留任务。

## 2026-09-08：共享文档与确定性编辑内核

本轮实现代码，不是仅调整规划。完整画布/host持久化/真实Pane尚未交付；父任务2.1保持未完成，子任务2.1a记录当前可独立验证的内核。

### 当前源码与复用

- `packages/host/pane-protocol/src/index.ts` 已有 ArtifactRefSchema、OpaqueRef 与动作/事件schema。本轮在其后增量增加 `ProjectCanvasDocumentSchema`、五类节点与两类连接schema，复用原artifact引用，不创建新资产模型。新增合同 `dsh.project-canvas.v1alpha1` 为未发布版本，旧schema原义不变。
- `packages/client/ui-pane-domain/src/project-canvas.ts` 实现UI Draft纯转换：添加、选择、移动、尺寸、文字/参数草稿、分组/折叠、连接、移除、复制、相机与撤销/重做。没有网络、provider、运行调度或持久保存动作。
- `packages/client/ui-pane-domain/src/index.ts` 增量导出内核和范围检查。此包是已有typed domain呈现包；后续renderer复用这些函数，不能再做一份document reducer。
- 已有 `packages/host/dsh-session-tags/src/plugin.ts` 和 `organization-domain.ts` 展示真实storageDomain打开与dispose模式，说明设施存在；这不证明项目画布存储已经实现。任务1.1/2.2仍须完成项目绑定、写入revision、恢复与host adapter核验。
- Creator Studio现有候选/引用源码有并行修改，本轮未修改它们。prepare/ack和artifact候选能力继续复用原实现；未调用任何真实owner。

### 已固定的内核语义

document包含workspace/project scope、独立document ID、owner确认revision、camera、nodes和edges。UI editVersion是独立的本地编辑栅栏，不因为移动/编辑便推进owner revision或声明saved。

每个编辑同时核对workspace/project/document与editVersion，拒绝迟到或旧编辑。初始化深拷贝并冻结状态；校验失败返回原状态，不部分提交。schema拒绝重复ID、悬空边、非法/循环分组、非有限坐标、无效尺寸、未声明runtime字段和现有artifact安全规则不允许的内容。

节点位置采用document坐标。移动分组同步移动其后代，重复选中后代不会二次位移。删除分组默认解组并保留内容；删除具体节点清理其连接与选择。复制分组包含后代与内部连接；外部连接不复制；必须提供全新的节点/边ID。复制操作步骤移除selectedArtifact，不继承运行或采用状态；素材/成果复制仅引用原固定版本资产。

最多保留50份本地撤销历史；撤销/重做不改owner revision。新分支编辑清空redo。关闭/保存/恢复和撤销之间的host协同尚未接入，任务2.2必须另行验证，不将本地undo当远程回滚。

执行环路作为草案可以保存编辑；必须由工作流预检拒绝执行。执行边指向operation并保留input/output/purpose，不在此层推断实际owner类型兼容性。

### 验证

```bash
pnpm --filter @yeisme/dsh-pane-protocol run build
pnpm --filter @yeisme/dsh-pane-protocol run test
pnpm --filter @yeisme/dsh-pane-protocol run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-domain exec vitest run tests/project-canvas.spec.ts tests/project-canvas-workflow.spec.ts
pnpm --filter @yeisme/dsh-client-ui-pane-domain run typecheck
```

新内核/范围检查共17项focused测试通过；原Pane protocol 11项回归测试通过；两个包类型检查通过。测试覆盖项目/文档迟到编辑、owner版本保留、分组、复制、撤销、原子拒绝、unsafe输入、范围边界与草案环路。测试属于unit/contract，不是浏览器或真实owner集成证据。尚未安装React Flow、注册画布Pane、验证300节点性能或持久化，不据此关闭这些任务。

随后 `pnpm --filter @yeisme/dsh-client-ui-pane-domain run test` 的21个测试文件、126项测试全部通过，domain包构建也通过。既有React测试出现act配置/包装警告，本轮未修改无关视图或测试框架；此回归结果不代表真实owner、浏览器或完整画布验收。
