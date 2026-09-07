# Workbench 退役与 DSH 知识承接

2026-09-07 用户明确决定停止并彻底清理独立 Workbench（包括远程仓库），将主要交互推进到 DSH Pane。本目录保存可追溯的原文；所有 `source/` 内容均为历史参考，不授予功能就绪、执行权限或新的开发任务。

## 直接进入下一步

唯一新增实施入口：[DSH 项目画布与连续性 tasks](../../../openspec/changes/dsh-project-canvas-continuity-v1/tasks.md)。
成果编辑、引用、比较与写回继续由已有 [引用与创作工作区](../../../openspec/changes/dsh-prompt-reference-creative-workspace-v1/tasks.md) 承接，不能复制其任务或覆盖在途实现。

## 优先提取的设计

| 能力 | 原文 | 迁移方式 |
|---|---|---|
| 无限画布与 Draft | [产品](source/docs/product/spatial-canvas-experience.md)、[交互](source/docs/design/spatial-canvas-interaction.md)、[合同](source/docs/interfaces/spatial-canvas-v3.md) | 保留平移/缩放/选择/分组/引用/草稿与恢复语义，改用 DSH Pane 和 host storage；不迁旧 Spatial Service |
| 项目成果与连续性 | [产品](source/docs/product/project-continuity-workbench.md)、[界面](source/docs/ui/project-continuity-workbench.md)、[接口](source/docs/interfaces/project-continuity-workbench.md) | 项目概览、来源新鲜度、显式继续；DSH 原会话执行，Pinax 保持长期记忆权威 |
| 候选、Diff 与保存 | [文本产品](source/docs/product/text-development-workbench.md)、[交互合同](source/docs/interfaces/text-development-agent-interaction.md) | 接既有 Creator Studio/引用工作区；候选采纳、文件写回、正式版本是不同动作 |
| 画布内专业审阅 | [空间复刻](source/docs/product/spatial-replica-review-workspace.md)、[接口](source/docs/interfaces/spatial-replica-review.md)、[Anatomia UI](source/docs/ui/anatomia-reference-review.md)、[编剧 UI](source/docs/ui/auctra-screenplay-room.md) | 后续 domain Lens；保留 owner refs、来源/证据与版本，不建领域状态机 |
| Ordo 工作与恢复 | [Ordo 产品](source/docs/product/ordo-managed-work.md)、[原 tasks](source/openspec/changes/workbench-ordo-managed-work-v1/tasks.md) | 复用 Ordo Agent Ops；不得迁入第二调度器、TaskService 或审批账本 |
| Pane 生命周期与可访问性 | [Pane 交互](source/docs/design/pane-interaction-model.md) | 借用选择、焦点、键盘、关闭不取消和迟到事件反例；视觉真源仍是 DSH |
| 命令发现 | [发现 UI](source/docs/ui/command-journey-discovery.md) | 承接到 DSH 已有搜索/命令能力；精确命令只读与执行分开 |

## 明确终止的独立产品投入

独立 Web 主壳、Workbench 专属 BFF/SDK/多传输控制面、租户实例编排、Workbench GA/R0–R5 发布门、独立平台运维与 Workbench 接收端不作为 DSH 前置。领域 owner 的公共合同与独立运行能力继续保留。

不是把 283 条未完成任务全部搬到新 backlog。[原始任务去向](task-disposition.md)保留每条原文并按 adapt/reuse-owner/split/defer/retire 标注；其中 `split` 的平台任务取消，只采用明确列出的交互与恢复语义。新 tasks 全部从未完成开始，不继承 Workbench 的勾选、截图或 canary。

## 第一条用户路径

打开 DSH 项目画布 → 加入文字/图片/文件引用 → 明确选择目标会话并附加上下文 → 当前 Agent 处理 → 成果引用回到原项目画布 → 关闭重开可恢复。

首版支持本机 DSH Web。独立 Workbench 的 local/remote 同版部署承诺随该产品退役，不成为 DSH 插件首版前置。DSH 自身远程部署和 owner 权限继续按各自规则处理。

首版保留布局、草稿和安全引用；原文件/媒体/正文继续由已有 owner 保存。语义缩放、多 Lens、手绘、presence、50k 性能目标作为原始设计参考保留，不能成为首个真实闭环前置或被标为已交付。

## 来源与恢复

`manifest.json` 由根脚本生成，记录源 HEAD、每份文件 SHA-256、活跃任务及去向。源快照包含当时未提交的文档；原文中的相对代码链接属于旧仓库上下文，查阅源码需使用离线恢复副本，不能据此恢复独立项目入口。

工作区外保留受限访问的恢复副本：`/home/yeisme-agent-dev/retired-projects/yeisme-workbench-20260907/`，包括 Git bundle、原工作树及远程元数据。它不参与 workspace、skills、构建或部署。不得将其中凭据、运行数据或原始 payload 放入本目录。

在根目录校验提取文件：

```bash
python3 scripts/extract-workbench-knowledge.py verify
```
