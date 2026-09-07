# Spatial Canvas 交互、控件与可视化设计

## 0. 适用范围

本文规定 `/agent` Spatial Canvas 的布局、控件、交互模式、语义缩放、Lens 视觉语法、响应式和无障碍行为。产品边界见 [语义无限画布产品设计](../product/spatial-canvas-experience.md)，数据与接口见 [Spatial Canvas V3](../interfaces/spatial-canvas-v3.md)。

设计目标不是制造“更像白板”的装饰，而是让用户在数万对象中仍能稳定回答：我在哪里、当前选中了什么、哪些关系重要、下一步可以安全做什么。

## 1. 布局骨架

### 1.1 宽桌面 `>=1440px`

```text
┌────┬───────────────────────────────────────────┬──────────────────────────┐
│Rail│ Spatial Canvas                            │ Context area             │
│    │ ┌───────────────────────────────────────┐ │ ┌──────────┬───────────┐ │
│    │ │ Lens / breadcrumb / Draft / status   │ │ │Timeline  │Inspector  │ │
│    │ ├───────────────────────────────────────┤ │ │          │Review/    │ │
│    │ │                                       │ │ │          │Evidence  │ │
│    │ │ Atlas / Cluster / Object / Detail     │ │ └──────────┴───────────┘ │
│    │ │                                       │ │ ┌──────────────────────┐ │
│    │ │ HUD                       MiniMap      │ │ │Agent composer         │ │
│    │ └───────────────────────────────────────┘ │ └──────────────────────┘ │
└────┴───────────────────────────────────────────┴──────────────────────────┘
```

Timeline 和 Inspector 可并排，但 composer 只出现一次。Context area 不得创建第二个 session stream 或另一套 proposal/Task 状态。

### 1.2 标准桌面 `1024–1439px`

- Canvas 最小宽度 640px。
- Context rail 宽度 320–384px。
- Timeline、Inspector、Review、Evidence 使用标签切换。
- Composer 固定在 rail 底部，不能被标签内容挤出。
- Lens 业务面板不得在 canvas 内再占用固定宽度。

### 1.3 小于 1024px

不挂载完整 WebGL editor。显示：

- 当前 Lens、对象和状态摘要；
- 可搜索、可键盘操作的对象列表；
- Review/receipt/evidence；
- approved Owner deep link。

这不是缩小版桌面画布，也不支持自由 Draft 编辑。

## 2. 常驻 HUD

HUD 必须保持小、稳定、可发现。专业操作不常驻。

| 区域 | 控件 | 行为 |
| --- | --- | --- |
| 左上 | Lens switcher | 切换 Lens，保留 selected refs；目标缺失时显示真实原因 |
| 左上 | Breadcrumb | 显示 Project/Region/Object 上下文，点击逐级 fit/focus |
| 左上 | Draft toggle | 显式进入/退出 Draft，改变边框、光标和工具栏状态 |
| 左下 | `− / zoom% / +` | 阶梯缩放；百分比按钮打开 zoom menu |
| 左下 | Fit Lens | 适配当前 Lens 的有效 regions/objects |
| 左下 | Fit Selection | 适配选择集；无选择时 disabled 并说明原因 |
| 左下 | Recenter | 回到默认内容区域，不重置 Lens/filter |
| 右上 | Search | 全局检索 canonical projection 和 Draft，按 Lens 分组 |
| 右上 | Command palette | 搜索全部可执行 presentation/action，并显示 availability |
| 右下 | MiniMap | 显示 region、cluster、viewport、selection 和有界 presence |

Zoom menu 提供：适配全景、适配选区、回中、50%、100%、200%。不要求用户先记住快捷键。

## 3. 快捷键与输入模式

| 快捷键 | 行为 |
| --- | --- |
| `Space`（按住） | 临时 hand/pan |
| `H` | 切换 Hand 模式 |
| `V` 或 `Escape` | 返回 Select 模式；关闭当前临时工具 |
| `+` / `-` | 按阶梯缩放 |
| `Shift+1` | Fit Lens |
| `Shift+2` | Fit Selection |
| `Ctrl/Cmd+F` | Spatial Search |
| `Ctrl/Cmd+K` | 全局 Command Palette |

规则：

- 文本输入、composer 和 Draft text editing 中不抢占字符快捷键。
- 所有 drag 都有菜单或键盘等价路径。
- Overlay/Dialog/Sheet 关闭后，焦点回到真实 trigger。
- reduced motion 下 camera 直接抵达目标或使用极短淡化，不播放长距离飞行动画。

Draft 的具体工具快捷键由命令面板和用户快捷键设置提供，不硬编码一个会与文本输入冲突的单键。

## 4. 选择与上下文工具栏

### 4.1 正式对象

正式对象可以直接执行 presentation/layout 行为：

- Inspect；
- Focus；
- Compare；
- Locate in Lens；
- Add reference to Draft；
- Plan layout；
- Propose change。

拖动、resize、放入 region 只修改当前 Lens layout。修改内容、依赖、状态、Owner、审批或交付必须进入 proposal。

### 4.2 Draft 对象

Draft toolbar 提供：

- 文本/便签样式；
- connector；
- frame/group；
- 对齐和分布；
- lock/unlock；
- delete；
- Promote selection。

Draft 与正式对象混合选择时，工具栏先显示选择组成和安全边界，再提供只对相应子集生效的动作。禁止用一个“Apply”同时暗中修改 layout、Draft 和 Owner state。

## 5. 四级语义缩放

### 5.1 Atlas

Zoom `<0.30`。显示：

- 大区、泳道和 Frame 轮廓；
- tile density；
- dominant type/status；
- warning/blocked/stale/unknown 热区；
- viewport 和 selection 在小地图中的位置。

不显示 individual edge 或富卡片。目标是理解全局结构和异常分布。

### 5.2 Cluster

Zoom `0.30–<0.70`。显示：

- cluster 数量、标题和主状态；
- region title 和主要 flow；
- selected/search-highlighted 跨区关系；
- 少量 sample objects。

Cluster 必须可点击、可键盘定位、可展开或 zoom into。

### 5.3 Object

Zoom `0.70–<1.30`。显示：

- 轻量 object card；
- title、type、status、freshness/Owner 标记；
- selection/layout handle；
- focus path 和显式 relation filter。

卡片不加载大图、长文本或完整 action form。

### 5.4 Detail

Zoom `>=1.30`。选中和可交互对象可以加载：

- thumbnail/preview；
- bounded safe summary；
- receipts/evidence badges；
- presentation controls；
- context rail 中的完整 Inspector/Review。

最多挂载 200 个 rich DOM overlays。超出预算时保留 WebGL primitive，并把详情交给 selection/Inspector。

跨阈值使用 5% hysteresis，避免触控板在边界附近反复拆建 renderer。

## 6. Region 与关系视觉

Region 类型固定为：

- `section`：通用语义分区；
- `frame`：层级或叙事/生产阶段；
- `lane`：状态、时间、角色或流程泳道。

Region 使用低对比边界和标签建立秩序，不做大面积装饰色块。状态色只用于真实 `running/warning/blocked/stale/unknown_accept` 等语义。

关系显示遵循“默认弱化，按需增强”：

- Atlas：不画 individual edges。
- Cluster：仅显示关键跨区关系和当前 focus path。
- Object/Detail：默认低透明，选择、hover、搜索或 relation filter 时增强。
- 关系不可见不等于不存在；Inspector/accessible summary 仍能列出关系数量和类型。

## 7. Lens 视觉语法

### 7.1 Creative Production

- 主要结构：Project/Show→Episode/Sequence→Scene→Shot/Asset。
- Scene 使用 Frame 或有序段落；Shot/Asset 在 Object/Detail 显示 thumbnail。
- 时间顺序和生产依赖分层显示，避免把所有关系混在一张图。
- Director controls、decision、handoff 和 readiness 进入共享 context rail，不保留固定 430px 内栏。

### 7.2 Workflow

- 主要结构：阶段 lane + DAG。
- 选择 step 后突出 upstream blocker、downstream impact 和 current run overlay。
- 默认不绘制所有定义/运行/证据关系；按当前问题切换 relation preset。

### 7.3 Run

- 主要结构：state/time lanes。
- Running step 使用克制状态强调；reduced motion 下不使用持续发光或脉冲。
- `waiting_approval`、`failed`、`unknown_accept` 和 reconcile 是一级视觉状态。

### 7.4 Review

- 主要结构：Review queue、Compare frame、Decision/Evidence region。
- `accept/reject/request_changes` 与目标 Task status 分开。
- 对比状态不能只用红绿；同时显示名称、icon 和文本。

### 7.5 Evidence

- 主要结构：Source→Claim→Decision/Receipt→Artifact。
- provenance edge 可按来源、时间、Owner、freshness 过滤。
- 无权查看或已脱敏内容显示明确节点，不把缺失解释为没有证据。

## 8. Draft 模式视觉

进入 Draft 时：

- Canvas 内边界出现克制的 Draft 状态线；
- cursor/tool indicator 显示当前 Draft 工具；
- 正式对象降低编辑 affordance，但保持可引用；
- Draft 对象使用独立 style token 和 `Draft` 标记；
- 退出 Draft 后 Draft 可继续显示，但创建/编辑工具收起。

Lifecycle：

| 状态 | UI |
| --- | --- |
| `active` | 正常可编辑 Draft |
| `locked` | 可选择、不可修改，显示锁定人与原因 |
| `promoted` | 保留来源与 canonical refs，降低草稿强调 |
| `deleted` | 默认隐藏，只在历史/undo 需要时恢复 |

冲突必须显示远端与本地差异；禁止静默 last-write-wins。Undo 只生成自己的 inverse patch，不把协作者的新工作倒回去。

## 9. MiniMap 与空间搜索

MiniMap 是导航摘要，不是缩小版富画布：

- 使用 SVG/WebGL 简化 region/cluster marks；
- 显示当前 viewport mask；
- selection 使用语义颜色；
- presence 只显示有界 member dots；
- 支持 click locate、drag viewport 和 wheel zoom；
- 提供 aria-label，键盘用户使用等价的 region/object navigator。

Search 结果结构：

```text
Object identity
├── Creative projection
├── Workflow projection
├── Review projection
├── Evidence projection
└── Draft references
```

结果显示 Lens、Owner、status、freshness 和 safe breadcrumb。选中结果时先验证 projection，再切 Lens、定位、聚焦并更新 context rail。

## 10. Presence

Presence 只做“有人正在这里”的轻量提示：

- cursor ≤10Hz；
- selection/viewport ≤2Hz；
- TTL 15 秒；
- 最多绘制 32 名活跃成员；
- 超限后显示总数和 Lens 分布。

远端 drag 使用虚线 preview，不改变本地 revision。presence degraded 时显示状态，但不阻断 Draft patch/refetch。

## 11. 状态与错误

| 状态 | Canvas 行为 | 控件行为 |
| --- | --- | --- |
| loading | 保留镜头和上次安全投影，显示局部 loading | mutation disabled |
| empty | 显示真实空状态、Create Draft 或返回上级 | 不伪造示例节点 |
| stale | last-confirmed + stale badge | fresh-revision action disabled |
| offline | 保留安全摘要 | retry read/deep link |
| degraded | bounded renderer/list | 保留搜索、选择、Inspect |
| permission_required | 脱敏对象/区域摘要 | 提供权限恢复路径 |
| conflict | 当前 revision + compare | rebase/reapply |
| unknown_accept | Draft/selection 保留 | reconcile only |

错误不能只放在 toast。与当前 selection、Lens、Draft 或 proposal 有关的错误进入 context rail，并保留恢复动作。

## 12. 无障碍验收

- Canvas host 可聚焦，并说明 Lens、semantic level、对象数和选择数。
- 每个 semantic level 都有 region/cluster/object accessible summary。
- Accessible navigator 最多 200 项，支持搜索、上下键、Enter、Space 多选和 Locate。
- Icon-only controls 有 aria-label 和 Tooltip。
- 状态不只依赖颜色。
- 200% zoom 无页面级横向滚动；context rail 内部独立滚动。
- reduced motion、WebGL unavailable、worker unavailable 和 context loss 都有等价路径。

## 13. 视觉与性能黑名单

禁止：

- 空白远景仍标记 ready；
- 所有关系长期显示；
- Lens 内重复固定业务侧栏；
- 全屏工具墙；
- 未选择时挂载大量富 DOM；
- 假实时发光、无意义渐变、厚玻璃和 KPI 卡片墙；
- 用动画掩盖数据刷新；
- 用 localStorage/query parameter 开启 capability；
- 用 screenshot 或“DOM 为零”代替功能/性能证据。
