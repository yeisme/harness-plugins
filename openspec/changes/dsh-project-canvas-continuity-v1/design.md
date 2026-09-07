## Context

迁移依据是用户 2026-09-07 的明确退役决定。原文来源见 `docs/migrations/workbench-retirement/README.md` 与 CLI 生成的任务去向。本设计是 DSH 实施权威；原文的 Workbench shell、TaskService、四种调用面、平台发布门不适用。

## Goals / Non-Goals

目标：尽快交付“画布选择→当前会话→真实成果→关闭重开”的一条完整路径。保留成果审阅与项目续接能力。

不做独立客户端、第二 Composer、第二调度器、领域数据库、任意 URL/iframe 执行或自动 mutation。原工作台专属托管/发布要求随产品取消；多 Lens、语义缩放、presence 保留为后续参考而非首版依赖。

## Decisions

1. Owner-fit 为 split-owner：DSH 插件拥有项目画布布局与 Draft；DSH 拥有会话执行，Ordo 拥有 Agent Ops，Pinax 拥有长期决定，领域 owner 持有成果和版本。
2. 项目画布使用 `paneWorkbench.registerView`，项目引用与选定会话分开；禁止用全局 current session 处理迟到结果。注册、订阅、locale、storage 均对称 dispose。
3. 先 probe 现有 host storage 是否可承载项目级记录；不得把 session-scoped storage 偷换为 project-scoped。缺 seam 形成最小 `upstream-prs` 合同补丁，无第二服务替代。
4. 布局模型只含相机、节点坐标/尺寸/分组、Draft 与 refs。用户输入的 Draft 内容使用获批 host 文档存储，不进入遥测/证据；文件正文、媒体 blob 不复制到布局记录。
5. 首版节点：文字 Draft、图片引用、文件引用。连接线只代表用户草稿关系，不是运行依赖。平移、缩放、选择、移动、尺寸、分组、撤销可单元测试；虚拟化使用可见范围裁剪，库选择遵循现有依赖与许可证。
6. 选择冻结 projectRef/sessionRef/node refs/revisions，通过既有引用 prepare/ack 进入 Composer。添加上下文不发送、不执行；发送使用 DSH 原入口。失败保留 Draft，切项目/会话后的迟到结果不能改投。
7. 成果预览、候选比较、采纳和写回复用 `dsh-prompt-reference-creative-workspace-v1`。保存事实来自 owner receipt；无写合同只读，unknown 对账，不自动重试。
8. 续接显示目标、成果、决定、阻塞、来源与下一动作。无 Pinax 则明确只显示确认事实；打开画布不运行 Agent，关闭 Pane 不取消运行。

## UI Contract

- Surface：project-level workspace Pane，沿用 ui-pane-workbench；嵌入 renderer 用 ui-visual-kit，完整 surface 用 ui-surface。
- 视觉：仅复用 `docs/design/dsh-unified-panel-visual-system.md` 的 token、图标、控件；不复制 Workbench CSS。
- 主动作：添加选中引用到明确会话；画布工具条只含选择、添加、缩放、适配与撤销。
- 滚动：画布负责相机变换，Inspector 文本独立滚动；不劫持 Composer 滚轮或 IME。
- 状态：loading/empty/offline/needs_contract/stale/conflict/unknown；能力缺失显示原因，不伪造成功。
- 响应式：桌面 Pane 正常分栏；窄屏使用对象列表与预览，不强塞完整画布。
- 无障碍：对象列表等价操作、键盘选择/移动/删除/撤销、焦点恢复、reduced motion、中英 locale。
- 对照验证：双栏会话、热卸载、重新打开、断线、过期引用与保存冲突。

## Migration and Rollback

从历史快照提取需求，不导入旧运行状态、数据库、credentials 或完成标记。新插件默认关闭，禁用后保留 Draft 存储与 owner 引用；旧 DSH 会话、文件 Pane 和成果工作区继续可用。若新 schema 不兼容必须显式迁移与旧版读取策略，不自动丢弃布局。

## Validation

先 focused reducer/host/引用隔离用例，稳定后运行仓库 typecheck/test/build/check:bundles/check:plugins/check:surfaces/test:visual。真实产品验收另测同一 DSH staging/profile：真实 Agent 成果、刷新/重启恢复、双栏零串会话、零重复提交、无重复 Target 底栏。协议通过不能关闭真实使用任务，官方上游合入也不作为插件协议完成门。
