# Proposal: 3D 导演台 glTF/GLB 工作台

## Problem

现有创意工作流和项目无限画布能够表达素材、场景、镜头与执行关系，但缺少可审计的 3D 场景编排面。用户无法在 Shot 上同时调整空间构图、时间线、生成结果和画布关系，也缺少明确的 glTF/GLB 能力边界。

## Goals

- 以 Shot 为工作流锚点，提供浏览器实时 3D 预演。
- 双向联动画布节点、选区、聚焦与 3D 对象。
- 首先支持 Khronos glTF 2.0 核心与 GLB 容器。
- 识别全部官方扩展并声明 readable/editable/exportable/opaque-preserved 能力。
- 在工作台层版本化保存 scene graph，按需导出 glTF/GLB 快照。
- 将节点级和整场景生成统一为可审计变更集，支持预览、接受、拒绝和回退。
- revision 冲突时冻结写入并要求 owner reconcile。

## Non-goals

- 不实现完整 DCC（骨骼、约束、粒子、复杂特效）。
- 不承诺实时预览与电影级离线渲染一致性。
- 不让导演台成为 Ordo 的 scheduler、task ledger、approval ledger 或生产交付 owner。
- 不自动覆盖冲突、重试 unknown、回退远端版本或静默丢弃未知扩展。

## Dependencies

- `dsh-project-canvas-continuity-v1`
- `dsh-creative-workflow-v1`
- `dsh-creative-pipeline-visual-workbench-v1`
- `dsh-pane-workspace-experience-v3`
- `dsh-ordo-agent-ops` owner projection 与 reconcile 规则
