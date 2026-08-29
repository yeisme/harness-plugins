# pane-overlay-workbench-experience Specification

## Purpose
TBD - created by archiving change dsh-web-pane-experience-completion-v1. Update Purpose after archive.
## Requirements
### Requirement: Overlay 宿主必须复用共享 Tab 系统而非独立简化实现
当 `workspace.core-pane.v1` seam 缺失、Pane Workbench 以 official overlay 宿主挂载时，overlay MUST 挂载与 Core Pane 宿主相同的 Tab 系统组件（pinned/preview 分段、状态层级、overflow More Tabs、bulk close 预检）；overlay MUST NOT 维护第二套手写 tab 条或第二套交互模型。

#### Scenario: 多视图塌缩进单 region
- **WHEN** workspace state 中存在多个 group 的视图且当前为 Tier 0 overlay 宿主
- **THEN** 所有视图按 group 顺序塌缩进唯一 tablist，active 视图由 `activeGroupId`/`activeTabId` 决定，tab 的 pinned/preview/dirty/orphaned 状态照常表达

#### Scenario: Bulk close 预检
- **WHEN** 用户在 overlay tablist 执行 Close Others 且一个目标 view 的 close policy 为 deny
- **THEN** 操作整体拒绝、所有 tab 保留，并报告阻塞 view

### Requirement: Tier 0 拓扑固定为单 region，host 几何能力必须诚实禁用
Overlay 宿主 MUST 把 region 拓扑固定为单 group 单 region；split、move-to-region、maximize、dock 等需要 host 几何的意图 MUST 在 dispatch 前被 capability gate 拦截并返回标准化 disabled reason；插件 MUST NOT 在 overlay 内实现 split/dock 几何或伪造第二个 region。

#### Scenario: 用户在 Tier 0 请求 Split Right
- **WHEN** 当前为 Tier 0，用户从 tab 菜单或键盘命令触发 Split Right
- **THEN** 对应 action 处于禁用态并展示"需要 workspace docking seam"类标准 reason，reducer state 不发生任何改变

#### Scenario: Tier 0 不创建第二 region
- **WHEN** 任意 view provider 在 Tier 0 下请求把视图打开到非默认 region
- **THEN** 视图被放入唯一 region 的 tab 集，且不渲染任何模拟 region 边界、分隔条或拖拽 edge zone

### Requirement: 区域内 Tab 拖拽重排必须复用单一 Drag Coordinator
Tier 0 下的 tab 拖拽 MUST 复用跨 region 共享的 `PaneDragCoordinator`（同一 generation、起始门、磁滞与取消恢复语义）；允许的 drop intent 集合 MUST 收敛为 `reorder_within_group`；任何指向 region 几何的 drop intent MUST NOT 生成。

#### Scenario: 拖拽重排成功
- **WHEN** 用户在 overlay tablist 拖动 tab 越过另一 tab 中点并释放
- **THEN** coordinator 提交恰好一个 reorder intent，FLIP 动画有界完成，reducer 一次提交新顺序

#### Scenario: 拖拽朝向不存在的区域
- **WHEN** 用户在 Tier 0 把 tab 拖向 viewport 边缘
- **THEN** 不出现 edge zone/drop indicator，释放后完整恢复原位，reducer state 不变

### Requirement: Quick Pick、菜单与键盘等价路径在 Overlay 必须可用
Tier 0 overlay MUST 提供与 Core 宿主一致的锚定 Quick Pick（搜索/分组/快捷键/键盘选择/Esc focus restore）、视图 More 菜单与完整键盘路径（Tab APG、Shift+F10、关闭后确定性焦点恢复）。

#### Scenario: 键盘打开视图
- **WHEN** 用户在 Tier 0 打开 Quick Pick、输入过滤并按 Enter
- **THEN** 目标视图在唯一 region 打开为 tab，Quick Pick 关闭且焦点移到新 tab

#### Scenario: 键盘关闭活动 tab 后恢复焦点
- **WHEN** 用户用键盘关闭 overlay 中的活动 tab
- **THEN** 焦点移动到相邻 tab；无剩余 tab 时移动到 Open View 触发器

### Requirement: Overlay 挂载协议必须保持兼容与 fail-closed
Overlay 宿主升级 MUST NOT 改变 `mountOverlayPaneHost` 的挂载协议、`provide('paneWorkbench')` 语义与 probe 失败语义：`apply()` 在 seam 缺失时 MUST NOT throw；仅"两 slot 均声明但缺 core-pane"时保持 fail-closed 停挂。

#### Scenario: 发布版 DSH 上 apply
- **WHEN** 官方发布版缺少 `workspace.core-pane.v1` 与 `shell.workspace.right/bottom`
- **THEN** 插件以 overlay 宿主挂载成功，`paneWorkbench` 服务被 provide，不抛出异常、不阻断其他插件

#### Scenario: 矛盾 slot 声明
- **WHEN** host 同时声明 right/bottom 两 slot 但缺失 core-pane 合同
- **THEN** 插件 fail-closed 停挂并给出可见原因，而不是以半功能状态挂载

### Requirement: Overlay 必须满足响应式与可访问性合同
Overlay 宿主 MUST 在 ≤720px viewport 投影为全屏 Sheet，coarse pointer 下交互目标 ≥44px，尊重 `prefers-reduced-motion`，并保留 `aria-label`、role=tablist/tab 与加载失败 boundary 的重载路径。

#### Scenario: 窄屏全屏投影
- **WHEN** viewport 宽度为 390px
- **THEN** overlay 以全屏 Sheet 呈现，tablist 可横向滚动，所有交互目标 ≥44px

#### Scenario: 视图渲染抛错
- **WHEN** overlay 中某视图组件抛出渲染错误
- **THEN** 错误 boundary 展示该视图失败与"重新加载"，其余 tab 与 workspace state 不受影响

### Requirement: Overlay MUST NOT 伪造 host 职责
Overlay 实现 MUST NOT 读取或修改 AppFrame 几何、Details 优先级、官方 slot 树或 host CSS 变量以外的 host 内部状态；MUST NOT 通过 monkey patch、全局轮询或 DOM 探测推断 host 布局。

#### Scenario: 检测 host 内部状态
- **WHEN** overlay 代码路径尝试读取 host 未公开的布局/几何内部对象
- **THEN** 该路径不存在；代码审查与 lint 规则可静态拒绝此类引用

### Requirement: Tier 0 塌缩 MUST NOT 破坏 canonical 布局的持久化 round-trip
Overlay 塌缩 MUST 只是渲染态投影：canonical `PaneWorkspaceV1` 多 region 结构在 Tier 0 会话中保持完整，布局持久化 MUST NOT 因塌缩而丢失 region/group 信息；Tier 1 布局经 Tier 0 会话往返后 MUST 无损恢复。

#### Scenario: Tier 1 布局在 Tier 0 会话后恢复
- **WHEN** 用户在 Tier 1 保存了含 Right/Bottom 双 region 的布局，随后在 Tier 0 环境打开并关闭若干 tab，再回到 Tier 1
- **THEN** region/group 结构与未被显式关闭的视图完整恢复，只有用户的显式关闭操作生效

#### Scenario: Tier 0 下的布局持久化
- **WHEN** Tier 0 用户重排 tab 或开关视图触发持久化
- **THEN** 写出的持久化数据仍包含完整 canonical region 结构，不写入任何 overlay 伪 region

### Requirement: Tier 热升级必须保持视图状态
当运行期 probe 重判导致 Tier 0→Tier 1 升级（seam 热插拔）时，宿主切换 MUST 保留已打开视图、active tab 与预览/pinned 状态；MUST NOT 因宿主重建而关闭视图或重建 owner 资源句柄。

#### Scenario: 运行期 seam 变为可用
- **WHEN** Tier 0 会话中 workspace docking seam 变为可用并完成重判
- **THEN** 工作区切换到 Core Pane 宿主，所有 tab 与其状态保留，canonical region 结构恢复生效，用户焦点确定性落回原 active 视图

### Requirement: Overlay 交互必须满足性能预算
Overlay 路径 MUST 沿用既有性能合同：pointermove 期间零 reducer dispatch、tab 列表有界测量与虚拟化、重渲染只触达受影响 group；长 tab 列表 MUST NOT 退化为全量重排重绘。

#### Scenario: 高密度 tab 列表
- **WHEN** overlay tablist 存在 40 个 tab
- **THEN** tab 渲染经有界测量/虚拟化保持滚动与拖拽流畅，无布局抖动

