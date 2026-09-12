# Design: 做剧可视化流水线工作台

## Owner fit

DSH 拥有项目画布布局、草案、引用投影、Agent 上下文条和检查器呈现。Ordo 拥有跨领域计划、调度、预算、恢复和运行投影；领域 owner 拥有正文、候选、版本和领域执行事实。页面不创建第二份运行真相。

## Entry and page layout

页面从项目级 `writing` 或 `production` 工作上下文进入，共享 `projectRef`、Project Canvas Document 和恢复索引。桌面使用 `Surface kind="workspace"`，布局为：

```text
┌─────────────────────────────────────────────────────────────┐
│ SurfaceContextBar: 项目 / 上下文 / freshness / 下一步       │
├───────────────┬──────────────────────────┬─────────────────┤
│ 项目/对象导航  │ 无限画布                 │ 流水线检查器     │
│ 可选区/节点    │ 节点 + reference edge    │ 输入/版本/状态   │
│               │ + execution edge         │ 暂停/恢复/对账   │
└───────────────┴──────────────────────────┴─────────────────┘
```

窄屏切换为对象列表与详情 Sheet；不强行压缩完整画布。画布是主滚动和相机区域，检查器独立滚动。

## Canvas projection

首版节点：`asset`、`character`、`scene`、`shot`、`candidate`。节点只携带安全引用、有界摘要、版本、状态和布局，不携带正文、凭据、provider payload、绝对路径或完整运行状态。

`reference edge` 只表达关系，不触发执行。`execution edge` 表达已声明的自动化步骤、输入用途、版本和 owner projection。连接不兼容时保留草案并显示原因，不隐式转换。

## Background Agent

常驻上下文条显示当前项目、工作上下文、选区、引用完整度、freshness、运行摘要和下一步。Agent 抽屉仅在用户选择节点/边、请求解释或查看阻塞时打开。

Agent 可以读取安全投影、组织流程草案、解释版本/阻塞，并暂停或恢复已确认的运行。Agent 不可静默扩大范围、替换 writer、重试 unknown、写入 owner 正文或自动采用成果。

## Pipeline inspector

选中 execution edge 后，检查器显示：输入引用和版本、输出候选、owner/adapter 状态、freshness、预算、阻塞、evidence ref 和可用的 `pause`/`resume`/`reconcile` 动作。新增范围、版本变化、owner 写入、候选采用、预算或权限变化必须明确确认。

## Failure and recovery

owner 不可用、输入缺失、版本过期或能力缺失时，保留图、边和草案；边进入 `blocked`、`stale`、`needs_contract` 或 `unknown`。页面显示原因、影响范围和下一动作，不自动重试、回退、删除或替换输入。

关闭/刷新页面不取消运行；重开只恢复原查询身份和观察，不重放命令。迟到结果按 `projectRef`、generation 和选区隔离。

## UI Contract

- Surface classification: adopted
- Surface kind: workspace（最接近 `docs/design/dsh-unified-panel-visual-system.md` §18 的 Creator workspace archetype：当前产物/候选/媒体为第一优先级，禁止三列等权 dashboard 与领域主题覆盖 host）
- First / second / third visual priority: ① 无限画布上的节点与 reference/execution 边（当前产物、候选与引用关系）；② SurfaceContextBar 的项目、工作上下文、选区与 freshness；③ 流水线检查器、Agent 抽屉与诊断
- Existing components reused: `Surface` / `SurfaceContextBar` / `SurfaceSection` / `SurfaceState` / `SurfaceActionBar`（`packages/client/ui-surface`）；画布主体复用 `ui-pane-domain` 的 `ProjectCanvasView`（`packages/client/ui-pane-domain/src/project-canvas-view.tsx`）；Agent 抽屉与确认弹层使用官方 Sheet/Menu/Modal，不自建 focus trap
- Cards that earn existence: 仅 candidate 节点卡（可比较、可采用）与 Productions 入口卡（可独立打开的项目对象）；普通状态、运行摘要和列表项使用 row/list/section
- Primary scroll owner: 画布是主滚动与相机区域；检查器独立滚动；页面 body 不再叠加第三层滚动容器
- 状态使用 `SurfaceState` 或统一 alert/row，状态永远有文本和 aria，不只靠颜色或圆点
- 视觉 token、间距、圆角、focus-visible、reduced-motion 复用 `docs/design/dsh-unified-panel-visual-system.md`
- 参考图（`docs/design/references/dsh-creative-pipeline/`）只冻结信息层级和空间关系；真实 UI 仍须通过组件、浏览器和视觉测试

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 项目画布 | 有界 skeleton（92px 最小高度），标题说明正在读取画布投影 | 短标题 + 产生空态的项目上下文 + 真实下一步（如添加 asset）；不伪造节点 | 紧凑左对齐 strip，显示可理解原因；不泄漏 token、raw payload、绝对路径 | 节点与边按 projection 渲染，显示版本与 freshness | stale：保留最后安全图并显示 freshness，mutation 禁用；partial：只渲染已确认字段并标明缺失范围 | 不可用动作可见并带 title/aria 原因（如 owner projection 缺失） |
| execution edge 检查器 | skeleton 行，不预填输入/版本 | 说明“未选中 execution edge”并提示在画布选择 | error strip + owner 真实 recovery action；不自动 retry | 显示输入引用/版本、输出候选、owner 状态、evidence ref 与 pause/resume/reconcile | 输入过期或缺失时边进入 `stale`/`blocked`/`needs_contract`，显示原因与影响范围，保留草案 | `pause`/`resume`/`reconcile` 依据 server-authored action 渲染；不可用时显示原因 |
| Agent 抽屉 | 抽屉骨架 + “正在读取上下文” | 说明当前选区无可解释内容 | 错误以文本呈现；Agent 建议不构成执行授权 | 建议/草案标记“待审阅”，需显式 confirm 才进入执行 | owner 状态为 `unknown`/`blocked` 时只解释与建议，不自动重试、不替换 writer | 确认按钮在合同未满足（needs_contract）时禁用并给出原因 |
| 顶部工作面胶囊 | 胶囊立即可用，项目数据异步补齐 | 无项目时胶囊显示选择项目入口 | 工作面数据错误仅影响对应面板，胶囊本身不消失 | 当前工作面 tint + 状态点；运行中显示进度 | stale 工作面显示 freshness 标记 | 触控目标不足 44px 的环境按 coarse 规则放大，不因空间裁切主操作 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏；无限画布折为对象列表 + 详情官方 Sheet；ContextBar 分行，actions 收进官方 Menu；主操作不裁切 | 单栏默认；画布与检查器顺序切换，检查器以 Sheet 覆盖而非固定侧栏 | 三区域布局：左侧项目/对象导航、中部画布、右侧检查器；最多两个主列权重，画布优先 |

### Accessibility

- Keyboard path: 节点/边可选区通过 Tab/方向键移动（roving selection），Enter 打开检查器，Escape 返回画布；胶囊切换、Sheet/Menu/Modal 全程可键盘完成
- Focus owner/return: Sheet/Menu/Modal 的 trap、Escape、return focus 交给官方 primitive；关闭检查器/抽屉后焦点回到触发它的节点或边
- Visible labels and accessible names: 状态永远配可见文本与 `role=status/alert`；节点 accessible name 含 kind、名称与版本；disabled 控件带 title/aria 原因
- Reduced motion and coarse pointer: `prefers-reduced-motion: reduce` 关闭 shimmer/位移动画；coarse pointer 下胶囊、节点与关键动作命中区 ≥44px

### Visual Exceptions

- None

## Evidence tiers

1. Protocol：typed projection、reducer、合同验证。
2. Fixture/local：本地 owner stub、Eikona fixture canary、Playwright/visual。
3. Real owner：真实 Eikona/Scaena/Ordo adapter 与 receipt/reconcile。
4. Production: provider、计费、交付、回滚和生产消费者。

只有上一层稳定后才可宣称下一层；参考图不能替代任何层的运行证据。

## ComfyUI 工作台视觉基线与工作面胶囊

附件中的 ComfyUI 截图仅作为空间关系与密度参考，不是功能、协议或生产证据。工作台采用顶部项目栏右侧常驻悬浮胶囊：`[ ✦ Agent ]  ⇄  [ ▦ 工作台 ]`。两者是同级工作面；切换只改变当前工作面，不改变项目、选区、运行状态或权限。

- 顶部保留项目下拉，胶囊紧邻 Workflow / Models / Assets / Render / Gallery。
- 当前工作面使用蓝色 tint、浅边框与轻微 elevation；胶囊高度 32–36px，触控目标至少 44px。
- Agent 面承载对话、背景上下文、建议、草案、解释和下一步；工作台面承载画布、节点、媒体、流水线、Inspector 与运行观察。
- 未保存布局草案显示小圆点；运行中显示状态点或进度；Agent 草案显示“待审阅”，不得自动进入执行。
- 悬浮展开菜单显示当前项目、工作面、工作上下文、运行状态和下一步。
- 不使用大面积渐变、强发光或跳动动画；遵循 unified visual system、键盘焦点和 reduced-motion。

工作台内部采用左侧图标化资产导航与 Productions 卡片、中部可拖拽节点画布、右侧 Inspector/Versions/Comments、底部只读 Log/Validation/Render Queue。媒体节点只保存安全引用与受限预览元数据；blob、signed URL、object URL 与解码缓存必须在内存生命周期内对称释放。

## Slice 已知边界（2026-09-11）

以下为 vertical slice 评审确认的已知边界，不属于本 slice 的完成条件：

- **(a) R6 确认生命周期**：已实现为纯函数 `derivePipelineConfirmationPhase`（`packages/client/ui-ai-drama-director/src/client/pipeline/inspector-state.ts`）并有测试覆盖；但 live pane 尚未接入 confirmation/budget 来源，属诚实降级——无确认绕过路径，确认/budget 不可用时控件保持禁用并带原因。
- **(b) R7 owner 观察期**：不可用状态下的恢复需要 refresh/订阅通道；当前 `PipelineWorkbenchController.load()` 仅在挂载时读取一次，`phase != ready` 时以整体 `SurfaceState` 替代渲染。后续任务接入 error strip-over-preserved-graph（保留已有图 + 错误条）。
- **(c) ui-pane-domain fall-through**：共享包 `ui-pane-domain` 对新 domain kind 的 `semantic()`/缩略图 fall-through 为已知边界，需上游 seam，本 slice 不改共享包源码。
- **(d) 画布选中直达 inspector**：画布上边选中直达 inspector 依赖 `ui-pane-domain` 增加 selection 回调 seam，列为 upstream-prs 候选，本 slice 未实现该直达路径。
