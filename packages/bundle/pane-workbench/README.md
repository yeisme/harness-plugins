# @yeisme/dsh-pane-workbench

可安装的 DSH Web profile bundle，为 DSH 提供唯一的共享 Right/Bottom Core Pane。

它通过 `shell.workspace.right`、`shell.workspace.bottom` 和 `ctx.workspaceLayout`
参与 AppFrame 正式布局，Tool Details 作为隐藏内置 provider 进入同一个 Pane。完整 Core
seam 由运行时 probe 判定：workspace slots 已声明但缺 `workspace.core-pane.v1` 时停挂载并
报告版本不兼容；已发布 rc.9 的残缺宿主走 `shell.overlay` / footer / header 兼容宿主并
`provide('paneWorkbench')`。旧 `details` 列不再使用。

`./client` 由 `tsdown` 构建为 DSH client-modules 所需的
`window.__ModuleLoader__.load({ id: "@yeisme/dsh-pane-workbench", factory })` 格式，并把
`@yeisme/*` 实现内联、仅 external 平台包。

插件完成门是协议对接：探测 workspace slot / `workspaceLayout` / Core contract，齐全时挂
Right/Bottom，缺失时 `apply()` 明确失败。官方 `dsh plugin add` 与 Web boot 是可选 host
集成，不作为本包测试门。

## 安装与移除

```bash
dsh plugin --profile web add @yeisme/dsh-pane-workbench
dsh --profile web --dump-config
dsh plugin --profile web remove @yeisme/dsh-pane-workbench
```

本地 checkout：

```bash
dsh plugin --profile web add ./packages/bundle/pane-workbench
```

卸载会释放两个 workspace slot、唯一 layout handle、drag coordinator、session/persistence
订阅与 client service。右侧 44px 轨道和所有布局预留应完全消失；canonical session、task、
run 与 domain 数据不会被删除。

## 当前能力

- 首次安装 Right/Bottom 均收起；外部 `openView()` 自动展开目标 region。
- Right/Bottom 共用 controller/store，支持 Tab 重排、跨区移动、边缘 split、resize、
  最大化、恢复、撤销和 orphaned provider 恢复。
- 轨道只显示已打开视图；`+` 提供 view selector，不常驻七个固定模块。
- split 深度最大 2、可见 group 最大 4、Pane 最小 280×180px。
- V2 persistence 保存安全布局；V1 自动迁移并丢弃 overlay/maximized 临时字段。
- 缺少任一 workspace slot、layout service 或 Core 合同时明确报告兼容错误，不提供 overlay/footer/details 降级。
- Bash 等 Tool Details 与生态 provider 共用 registry/controller/chrome；后续侧栏与底栏能力
  只允许通过 `registerView()` / `registerPlugin()` 扩展，不新增独立 sidebar 或 Pane store。

## Experience Tier 行为

Pane 体验按宿主 seam 分级，随 `dsh-web-pane-experience-completion-v1` 落地为运行时
投影：`apply()` 时按 probe 结果一次性判定（纯函数），seam 热插拔触发重判并向订阅者
广播；tier 与 probe 状态从不落盘，每次会话重新判定。

| Tier | 前置 seam | 可用体验 |
| --- | --- | --- |
| 0 | 无（任意官方发布版） | overlay 单 region 完整工作台：真 tab 系统、区域内拖拽重排、Quick Pick、菜单、键盘路径 |
| 1 | `workspace.core-pane.v1` + `shell.workspace.right/bottom` | Core Pane docking：split、跨 region 移动/拖拽、maximize、Workspace Designer apply |
| 2 | Tier 1 + TerminalHostV2 + PreviewResourceV1 + 官方 Artifact seam | 真 PTY 终端、生产级预览、官方 artifact handoff |

Tier 0 不是降级版，而是同一 reducer、同一 tab 系统、同一 drag coordinator 的单 region
拓扑形态。用户向口径见 `docs/cookbook/dsh-web-pane-tiers.zh.md`，设计细节见
`docs/design/dsh-web-pane-experience-completion.md`。

## Tier 0 overlay 单 region 交互

随 `dsh-web-pane-experience-completion-v1` 落地：overlay 宿主挂载与 Core 宿主相同的
chrome 组件，不维护第二套简化 tab 条或交互模型。

- tab 系统全量复用：pinned/preview 分段、状态层级、overflow More Tabs、bulk close 预检
  （目标 view 的 close policy 为 deny 时整体拒绝并报告阻塞 view）。
- 区域内 tab 拖拽重排复用共享 `PaneDragCoordinator`（generation、起始门、磁滞与取消
  恢复语义不变）；drop intent 收敛为 `reorder_within_group`，拖向 viewport 边缘不出现
  edge zone，释放后完整恢复原位。
- 锚定 Quick Pick（搜索/分组/快捷键/键盘选择/Esc focus restore）、视图 More 菜单与
  完整键盘等价路径（Tab APG、Shift+F10、关闭后确定性焦点恢复）。
- 多 group 视图塌缩进唯一 tablist 时，active 由 `activeGroupId`/`activeTabId` 决定，
  pinned/preview/dirty/orphaned 状态照常表达。
- 响应式与可访问性：≤720px 投影为全屏 Sheet，coarse pointer 交互目标 ≥44px，尊重
  `prefers-reduced-motion`，保留 tablist/tab 角色语义与视图错误 boundary 的重载路径。

## 诚实禁用与 canonical round-trip

- split、move-to-region、maximize、dock 依赖 host 几何——那是 AppFrame 职责，插件不
  实现也不伪造第二个 region。Tier 0 下这些意图在 dispatch 前被 capability gate 拦截
  并返回标准 disabled reason；控件**可见但禁用**（附 reason 与能力矩阵指引）而非隐
  藏——隐藏会制造"功能不存在"的误解，workspace docking seam 进发布版后同一控件自动
  解锁。
- overlay 塌缩只是渲染态投影：canonical `PaneWorkspaceV1` 保持完整 region/group 结
  构，布局持久化只写 canonical 数据；Tier 1 布局经 Tier 0 会话往返无损恢复，seam 热
  插拔 Tier 0→1 升级时宿主切换保留已打开 tab、active 与 pinned/preview 状态。

## 开发与证据

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test
pnpm --filter @yeisme/dsh-pane-workbench run build
pnpm --filter @yeisme/dsh-pane-workbench run test
```

本包测试只验 pack、ModuleLoader 面与 workspace slot 绑定，证据写入
`temp/integration-test-runs/<run-id>/`。官方 `dsh plugin add` / Web boot / browser
runner 是可选 host 集成，不作为本包完成门。

排障时先打开 Workspace Capabilities 能力矩阵（`/workspace capabilities` 命令面可达
时，或 pane 设置/帮助入口的同一份投影）：它逐行展示当前 tier、每个 seam 的 probe 状
态、标准化 disabled reason 与解锁指引锚点；投影只含 tier、probe 布尔、reason key 与
文档锚点，不含路径、URL、token 或用户内容，诊断证据事件只记类别。
`contract_mismatch` 表示 seam 对象存在但合同不完整（如残缺 `workspaceLayout`），区别
于"未安装"且不计入更高 tier，解锁路径是升级 DSH。seam 兼容问题再确认 DSH layout 暴露
`shell.workspace.right`、`shell.workspace.bottom`、`ctx.workspaceLayout` 和
`workspace.core-pane.v1`，并检查 bundle row 与 client loader。旧 DSH 不会得到降级路
径，也不会静默恢复独立 Details 或双侧栏组合。
