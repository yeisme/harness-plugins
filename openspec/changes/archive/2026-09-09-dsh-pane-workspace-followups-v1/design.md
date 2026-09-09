## 状态与顺序

状态：实施中，1.1/1.2/1.3 已完成（1.1/1.2 为合同层交付，真实 fs-watch 与 owner 复核 seam 未合入上游）；布局controller验证已补强，1.4仍保留编辑缓冲集成缺口。依赖本轮 `dsh-pane-interaction-completion-v1`，按目录事件 → 文件恢复 → 上下文菜单 → 布局模板顺序推进，每步以真实用户路径验证。

## 场景矩阵

| scenario | 用户与任务 | 产物/检查 | 证据与交接 | readiness |
|---|---|---|---|---|
| directory-watch | 开发者在其他工具新增/重命名文件 | typed owner event；树保留展开、选择和滚动 | owning project temp/integration-test-runs；Explorer reducer | exploratory |
| directory-gap | 长会话掉线后恢复 | cursor/version gap 触发一次权威重读，未知不自动 mutation | 同上；file owner reconcile | exploratory |
| file-reopen | 刷新后重开原文件 | opaque ref + owner admission；不存在显示原因 | 同上；desktop.file/semantic editor | exploratory |
| dirty-conflict | 外部更新命中未保存缓冲 | 不覆盖、不自动丢弃；提供版本比较与显式决策 | 同上；file owner preview/receipt | exploratory |
| tree-context-menu | 鼠标与键盘执行文件操作 | 原生 menu、预检/冲突/撤销复用；动作权限可见 | 同上；现有 mutation service | exploratory |
| layout-template | 两栏/三栏工作流与切换项目 | 原有 preset schema；无重复 pane；绑定不串线 | 同上；host workspace service | exploratory |

## UI Contract

- adopted navigator/workspace；复用 Pane 标题、紧凑 Surface 与原生 Menu/Modal。
- 优先级：上下文、文件内容/树、待处理状态；不新增仪表盘卡片。
- 树/编辑器各自拥有唯一主滚动区；More 与菜单不改变背景布局。
- loading 保留最后安全内容；empty 解释目录为空；error 显示 owner 原因；stale/partial 标明缺失范围；disabled 标明权限；success 只展示 receipt 摘要。
- <=420px 单栏加返回路径，421–720px 导航与内容切换，>720px 可并列；所有重要动作提供键盘路径，Escape 回到发起行。
- reduced motion 禁用非必要动画；触控目标至少44px；焦点环和文本状态沿用统一 token。

## 验证与边界

先用已有 Explorer reducer/component tests 与文件服务测试，真实浏览器只测关键链路。每次 integration/component/e2e 都由现有脚本生成脱敏六件套。不把模拟 watch 或静态截图当真实跨刷新恢复通过。任何真实文件删除、覆盖或生产动作仍需具体用户授权；测试使用可丢弃 fixture。

## 1.3实施与验收

右键、Shift+F10和ContextMenu使用既有Menu及owner预检/执行/冲突/撤销通道；菜单绑定发起行而不更改另一选择目标。请求generation隔离取消、更新操作、runtime切换和迟到执行/刷新；pending可取消，预检就绪聚焦确认但不执行。取消及完成回到发起行，删除行时回到有效父级/首行。短Pane菜单内部滚动，coarse pointer项至少44px。菜单提供新建、重命名、移到废纸篓，其他已有操作继续使用原工具栏。

独立验证10项新菜单回归+22项既有Explorer测试通过：`temp/integration-test-runs/p1-independent-recheck-20260907T104205684008Z/`。原生Menu的360/960px、160px矮窗和触屏验证5项通过：`temp/integration-test-runs/ui-visual-2026-09-07T10-49-28-113Z-3806248/`，最终完整视觉106项通过：`temp/integration-test-runs/ui-visual-2026-09-07T11-04-11-870Z-3926944/`。使用合成文件操作，不宣称真实文件删除/改名通过。

## 1.4部分验证，保持未完成

真实WorkspaceLayoutController补充10项测试覆盖两/三栏混合项目、重复恢复去重、会话身份、序列化重建与同步/异步dirty guard和过期许可：`temp/integration-test-runs/preset-continuity-strengthened-20260907T105132133690Z/`。测试包在`upstream-prs/pane-preset-continuity-tests/`，不改宿主生产代码。实际编辑器renderer重挂载后的两份未保存正文独立性仍未验证，不能把controller guard测试当完整buffer恢复；1.4维持未勾选。

## 1.1实施与验收（合同层，真实 watch 未验证）

官方 fs-watch seam（`FileWatchCapabilityV1`，`upstream-prs/fs-watch` fork-ready）截至 2026-09-09 上游 alpha 0.1.5-alpha.1 仍未合入，本任务按「owner 增量 + 客户端诚实降级 + 合同层验证」交付，不伪造真实 watch：

- 绑定：`ExplorerWatchController`（`packages/client/ui-pane-workbench/src/explorer/explorer-watch.ts`）按能力探测绑定 runtime `fileWatch`；缺位返回 `available:false` + 禁用原因，树保持显式读取。`ExplorerTreeView` 以最新状态镜像接线（同步 ref，watch 折叠不覆盖事件间隙内的用户选择/焦点/锚点）。
- 事件：沿既有 `watch` intent 折叠；未知 ref 的 created/renamed 事件不带名称，只把已知父目录标 stale 并触发一次定向 `listChildren(parent)` owner 增量（已加载或已展开的父目录才刷新，未加载目录保持懒加载）。
- gap reconcile：sequence gap 只标 `reconcile_required`（不重排 expanded/selection/focus/锚点）；新增 `reconcile_apply` intent 承接一次权威重读（roots+全部已展开目录），仍存在的展开/选择/焦点/主行/勾选/滚动锚点原样保留，消失引用如实清空且锚点不回退到根；sequence/cursor 以触发事件为基线，后续连续事件不再误报。读取在途时新触发合并进当次读，只有新 gap 才再读一次；全程零定时器零轮询。不安全投影（绝对路径等）标 contract_mismatch 且不自动 reconcile。

独立12项测试（能力探测/连续折叠/重命名定向重读保位置/折叠目录增量/gap 一次权威重读/并发合并/飞行中选择保留/在途事件吸收与新 gap 再读/contract_mismatch 不触发读/dispose 停止/reconcile_apply 边界两态）：`temp/integration-test-runs/explorer-watch-file-reopen-20260909T051000Z/`，含 explorer 22项、上下文菜单 10项、controller 7项、persistence 6项回归共 76 通过。真实 host watch 端到端与真实文件系统 rename 未验证——合成事件流如实断言，解锁条件=官方发布版合入 fs-watch seam（或 DSH owner OpenSpec 交付）。

## 1.2实施与验收（合同层+真实 controller，真实 owner 复核面未验证）

- 恢复端口：`FileReferenceAdmissionV1`（`src/explorer/file-reopen.ts`）——owner 对 opaque ref 的重新准入（存在/权限/当前版本）。端口缺位时恢复返回 `deferred` 并提交 nothing，视图保持原状（不伪造 ready）。
- 恢复映射：同版本=ready；版本变更+缓冲干净=stale（compare/reload/keep_local）；版本变更+dirty=conflict（compare/reload/save_as/keep_local，autoOverwrite/dropBuffer 恒 false，resourceVersion 保持打开版不清）；missing/forbidden/unavailable=unresolved——Pane 占位保留、有界原因入 `metadata.reopen`，绝不开其他文件替代。admission 抛错降级为 unavailable。
- 提交：新 `set_view_status` workspace intent（只改状态/版本/注意位/有界原因；unknown view 拒绝；不换 resourceKey、不清 dirty、不动分组）。持久化信封（pane.workspace.persisted.v2）增列 `resourceVersion` 与白名单元数据 `reopen`（`sanitizeViewMetadata` 只放行该键、控制字符剥离、200 上限；rawPrompt 等既有 canary 密钥仍被剥除）。元数据净化只发生在持久化边界，live metadata（lifecycle/status 等）不受影响。
- 跨重挂载：真实 `PaneWorkbenchController` + `PaneWorkspacePersistenceAdapter`（内存 storage）序列化→新 controller 恢复→恢复→再 remount 状态存活（stale 版本、dirty、reopen 原因）。

9项新测试（决策映射/未解析有界原因/端口缺位 deferred/抛错降级/真实跨重挂载无替代文件/二次 remount 存活/dirty conflict 缓冲保留/lifecycle 投影一致/unknown 拒绝与 detail 净化）与上述回归同目录 76 项全绿。真实 owner admission（host 文件复核 seam）与浏览器级刷新未验证——admission 为合同层假实现，解锁条件同 1.1。
