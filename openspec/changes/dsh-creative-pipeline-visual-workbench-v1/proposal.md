# Proposal: 做剧可视化流水线工作台

## Problem

现有 Agent 面板把 Agent 作为显式主功能，现有项目画布则缺少统一的内容节点、自动化执行边和运行检查器。用户无法在同一项目中连续查看素材、人物、场次、镜头、候选成果与自动化状态，也无法理解 Agent 当前引用了哪些背景上下文。

## Goals

- 从项目级剧作/制作上下文进入做剧可视化页面。
- 使用无限画布表达素材、人物、场次、镜头和候选成果。
- 分离只读 `reference edge` 与可确认的 `execution edge`。
- 将 Agent 降为背景上下文条和按需抽屉。
- 提供右侧流水线检查器，展示输入、版本、owner 状态、阻塞和证据。
- 允许 Agent 准备、解释、暂停和恢复已确认的运行。
- 保留 Ordo 与领域 owner 的唯一状态、任务、审批、运行和成果真相。

## Non-goals

- 不新增 scheduler、task ledger、approval ledger 或第二 execution graph owner。
- 不自动 retry unknown/stale/partial，不自动回退输入版本。
- 不自动扩大范围、写入 owner 正文或采用候选成果。
- 不实现完整 DCC 3D 建模器。
- 不把 Eikona 参考图当作生产 UI、provider ready 或功能完成证据。
- 不以真实 provider canary 阻塞本地插件协议完成。

## Dependencies

- `dsh-project-canvas-continuity-v1`：项目 document、节点、布局、恢复。
- `dsh-creative-workflow-v1`：execution edge、范围预览、确认、运行观察。
- `dsh-eikona-studio-v1`：图像候选、版本、来源和 owner 边界。
- `dsh-pane-workspace-experience-v3`：Pane host、Surface 和响应式交互。

## Evidence boundary

协议证据、fixture/本地证据、真实 owner 证据和生产交付证据分层记录。Eikona UI 参考图只用于信息架构、空间关系和视觉讨论，不证明任何运行或交付事实。
