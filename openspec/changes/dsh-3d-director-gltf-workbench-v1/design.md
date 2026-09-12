# Design: 3D 导演台 glTF/GLB 工作台

## Product boundary

导演台拥有版本化工作台 scene graph、布局、草案和安全引用；领域资产、生成任务、审批、运行和交付事实仍由对应 owner 提供。每个投影带 opaque ref、有界摘要、revision、freshness、evidence ref 和 server-authored action。

## Workspace

桌面布局为：项目上下文条、左侧 Shot/资产导航、中部双视图（无限画布与 3D 视口）、右侧 Shot 检查器、底部时间线。选中画布节点或 3D 对象会同步高亮；视口中的相机、角色、道具变换会回写工作台 scene graph。窄屏切换为 Shot 列表、视口和详情 Sheet，不压缩完整画布。

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
