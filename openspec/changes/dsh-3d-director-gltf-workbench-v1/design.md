# Design: 3D 导演台 glTF/GLB 工作台

## Product boundary

导演台拥有版本化工作台 scene graph、布局、草案和安全引用；领域资产、生成任务、审批、运行和交付事实仍由对应 owner 提供。每个投影带 opaque ref、有界摘要、revision、freshness、evidence ref 和 server-authored action。

## Workspace

桌面目标布局为：项目上下文条、左侧 Shot/资产导航、中部双视图（无限画布与 3D 视口）、右侧 Shot 检查器、底部时间线。选中画布节点或 3D 对象会同步高亮；视口中的相机、角色、道具变换会回写工作台 scene graph。窄屏切换为 Shot 列表、视口和详情 Sheet，不压缩完整画布。

当前已落地切片（2026-09-12）：独立 surface 为单栏组合（上下文条 + 视口/场景树降级 + Shot 导航 + 时间线 + change set 列表），双视图形态以嵌入做剧工作台的停靠视口实现（画布下方 dock，经 CanvasBinding/`canvasNodeRef` 双向同步选区）；完整桌面双视图 + 右侧 Shot 检查器布局仍属目标设计，归后续波次/host seam。

## Scene and Shot model

- `SceneDocument`: version、scenes、nodes、resources、extensions、capabilityReport。
- `Shot`: cameraRef、frameRange、keyframes、objectRefs、visibility、generationRefs、deliveryProjection。
- `CanvasBinding`: nodeRef、shotRef、sceneObjectRef、edgeKind、layout。
- `GenerationChangeSet`: inputRefs、operationSummary、artifactRef、previewRef、patchDigest、status、rollbackRef。

变换、关键帧和可见性是首版可编辑面；材质、灯光、骨骼、约束、粒子和复杂特效列为后续 capability。

## glTF contract

导入器接受 `.gltf` 与 `.glb`，覆盖 scenes/nodes/meshes/materials/textures/cameras/animations 与核心 PBR 语义。扩展注册表必须能列出官方扩展，即使当前只读或 opaque 保留。导出器只宣称已验证的语义；对 opaque 扩展保留原始 JSON/bin 片段并在 UI 标出不可编辑原因。任何无法保真的导出必须阻止提交并显示具体 capability gap。

## Generation workflow

节点级和整场景生成都生成独立 artifact 与 change set，不直接覆盖当前版本。用户可比较 preview、查看输入与参数摘要、接受或拒绝；接受后产生新 scene graph revision。生成失败、partial、unknown 或 stale 只进入说明状态，不自动 retry 或替换 writer。

## Conflict and evidence

保存前校验 base revision。发生 revision mismatch 时进入只读冻结，展示本地/远端摘要差异，提供 owner reconcile 引用。证据分为 protocol、fixture/local、real-owner、production 四层；本 change 只要求前两层完成，不能用截图代替运行证据。

## UI Contract

客户端包 `@yeisme/dsh-client-ui-3d-director`（`packages/client/ui-3d-director/`）遵循 `docs/design/dsh-unified-panel-visual-system.md` §12。

- Surface classification: adopted
- Surface kind: workspace（Creator workspace archetype；视口/时间线为内容画布，外层 chrome 回到共享语法）
- First / second / third visual priority: 当前 scene 文档 + revision + 保存状态；3D 视口（或场景树降级视图）与 Shot 时间线；生成 change set 与 capability gap 次级信息
- Existing components reused: `Surface`/`SurfaceContextBar`/`SurfaceSection`/`SurfaceState`/`SurfaceActionBar`（ui-surface）、官方 `Button`、`buildPanelStyles` + `--vk-*` token（ui-visual-kit）；根 scope `[data-3d-director]`
- Cards that earn existence: 无卡片；状态用 `SurfaceState`/`.vk-alert`/`.vk-empty`，列表用行/树
- Primary scroll owner: `d3d-body`（视口与时间线为内容区；场景树降级视图独立滚动）

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| Scene read | `SurfaceState` loading + 有界 skeleton，文案说明正在读取哪个文档 | missing → `SurfaceState` empty + “New scene draft” 真实下一步 | schema fail-closed → error phase，不渲染部分真相；transport 失败 → error + Reload（无自动 retry、无轮询） | ContextBar 显示 `revision N` + Saved 文本状态 | save unknown → warn strip + “Reconcile save” owner 入口 | unavailable/forbidden → disabled phase + 原因文案 |
| Shot 导航与预演 | — | 无 Shot → `vk-empty` 说明 owner 未投影，视口保持自由环绕预览 | — | 导航行文本携带 keyframe 数、帧区间、delivery 状态与绑定高亮（`bound to selection`）；视口按播放头 step 采样预览（display-only，不回写 draft），description 明示 `Previewing shot <ref> at frame <n>` | — | conflict 冻结只禁编辑；导航与 picking 保持可用 |
| Mutation（transform/visibility/keyframe） | — | 未选中节点 → 编辑 section 不渲染（视口/场景树 picking 是唯一入口） | 非法数值（非有限/超出 ±1e6 界）→ 行内 `role=alert` 原因文本，编辑不入 draft；save 失败 → error 状态文本 | saved → revision 前进、clean；`NodeTransformEditor` 数值编辑（translate/rotate 四元数/scale + visibility toggle）与 `ShotTimeline` 关键帧 frame 编辑都落 controller draft，仅经 Save 持久化 | — | conflict → 只读冻结：`data-conflict-frozen` warn strip（本地 base revision + 未确认编辑数 vs owner revision 摘要），Save/导出/时间线/节点编辑全部禁用+原因，仅提供 Reapply/Discard 两个 owner reconcile 入口，绝不自动覆盖或重试。相机节点无合同内专有参数（SceneDocumentV1 无 fov/near/far），编辑面明示该边界 |
| Change set 审阅 | — | 无记录 → `vk-empty` 说明 owner 未记录 | 列表契约违例 → 整体降级 unavailable + 说明，不渲染部分真相 | 状态徽标（statusTone+文本）+ operationSummary + base revision；Preview 展开只读对比（inputRefs/operationSummary/patchDigest/base vs current revision/是否保留基线）；accept 把当前 draft 经同一 conflict-fenced save 提交为新 revision，rollback 重提交保留版本后客户端重读 owner truth | accept 冲突 → 与 draft save 相同的冻结条；rollback 拒于 dirty draft（提示先 Save/Discard，绝不静默丢 draft） | host 未暴露控制 seam（probe 缺失方法）→ 全部按钮禁用+原因，列表保持只读；server-authored 可用性：终态/缺 artifactRef/缺 rollbackRef 的条目对应按钮禁用+原因 |
| GLB export | exporting → 按钮禁用防重复 | — | exported 失败/契约违例 → critical strip + bounded reason | exported → 字节数 + mediaType 文本 | capability_blocked → gap 列表逐条展示（extension/resourceRef + reason），不静默丢数据 | capabilityReport.export.ready=false → 按钮禁用 + title 原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏，body 内边距收紧，视口 min-height 180px，能力不裁剪 | 单栏默认，视口/时间线顺序排列 | 同一单栏组合（嵌入做剧工作台的停靠视口已于 2026-09-12 落地；完整双视图 + Shot 检查器布局归后续波次） |

### Accessibility

- Keyboard path: 场景树 `role=tree/treeitem` 按钮选择；Shot 导航 `role=listbox/option` 按钮选择（选中收敛到该 Shot 相机节点、播放头归零至帧区间起点）；时间线关键帧为 button、播放头为原生 range input、关键帧 frame 为 number input；节点编辑为原生 number input + checkbox；change set 审阅为普通 button 行，全部可键盘完成
- Focus owner/return: 无自制 overlay；focus-visible 由 buildPanelStyles 基线提供
- Visible labels and accessible names: 状态全部文本+`role=status/alert`；关键帧 aria-label 含 property+frame；禁用控件带 title 原因
- Reduced motion and coarse pointer: `prefers-reduced-motion` 关闭 shimmer/过渡；OrbitControls 关闭阻尼惯性（相机动画），渲染改为按需；coarse pointer 44px 命中由基线覆盖

### Visual Exceptions

- `ShotTimeline.tsx` 播放头/关键帧 marker 位置为帧区间百分比测量几何，已登记 `scripts/check-ui-surface-contracts.mjs` dynamicStyleAllowlist。
- WebGL 视口 canvas 为媒体/内容画布，尺寸由 renderer 测量设置（非 inline style）；jsdom/无 GL 环境降级为同等可选中的场景树列表（测试与低端环境主路径）。
