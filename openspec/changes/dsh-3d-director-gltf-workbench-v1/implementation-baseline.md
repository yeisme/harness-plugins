# Implementation baseline

当前仓库已有项目无限画布、创意工作流、Director Pack、Pane/Surface 协议与安全 owner projection。尚未发现 glTF/GLB 专用 scene graph、导入导出器或 3D Director pane。实现应复用现有 canvas、Shot、Surface 与 reconcile 合同，不创建第二份 Ordo 状态机。
