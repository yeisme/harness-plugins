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
5. 节点包括素材、文字Draft、操作步骤、成果、分组框，素材支持图片/视频/声音/文件/领域引用。reference edge只表达关系，execution edge的映射/校验/运行入口由dsh-creative-workflow-v1提供，两者复用本change的同一document。固定使用@xyflow/react@12.11.6；完整节点交互、复制、撤销/重做与相机可测试；按可见范围裁剪，离屏暂停视频。
6. 选择冻结 projectRef/sessionRef/node refs/revisions，通过既有引用 prepare/ack 进入 Composer。添加上下文不发送、不执行；发送使用 DSH 原入口。失败保留 Draft，切项目/会话后的迟到结果不能改投。
7. 成果预览、候选比较、采纳和写回复用 `dsh-prompt-reference-creative-workspace-v1`。保存事实来自 owner receipt；无写合同只读，unknown 对账，不自动重试。
8. 续接显示目标、成果、决定、阻塞、来源与下一动作。无 Pinax 则明确只显示确认事实；打开画布不运行 Agent，关闭 Pane 不取消运行。

## UI Contract

- Surface：project-level workspace Pane，沿用 ui-pane-workbench；嵌入 renderer 用 ui-visual-kit，完整 surface 用 ui-surface。
- 视觉：仅复用 `docs/design/dsh-unified-panel-visual-system.md` 的 token、图标、控件；不复制 Workbench CSS。
- 主动作：添加选中引用到明确会话；画布工具条包括选择、添加、连线类型、搜索、缩放、适配、撤销/重做；运行范围入口由工作流能力提供。
- 滚动：画布负责相机变换，Inspector 文本独立滚动；不劫持 Composer 滚轮或 IME。
- 状态：loading/empty/offline/needs_contract/stale/conflict/unknown；能力缺失显示原因，不伪造成功。
- 响应式：桌面 Pane 正常分栏；窄屏使用对象列表与预览，不强塞完整画布。
- 无障碍：对象列表等价操作、键盘选择/移动/删除/撤销、焦点恢复、reduced motion、中英 locale。
- 对照验证：双栏会话、热卸载、重新打开、断线、过期引用与保存冲突。

## Migration and Rollback

从历史快照提取需求，不导入旧运行状态、数据库、credentials 或完成标记。新插件默认关闭，禁用后保留 Draft 存储与 owner 引用；旧 DSH 会话、文件 Pane 和成果工作区继续可用。若新 schema 不兼容必须显式迁移与旧版读取策略，不自动丢弃布局。

## Validation

先 focused reducer/host/引用隔离用例，稳定后运行仓库 typecheck/test/build/check:bundles/check:plugins/check:surfaces/test:visual。真实产品验收另测同一 DSH staging/profile：真实 Agent 成果、刷新/重启恢复、双栏零串会话、零重复提交、无重复 Target 底栏。协议通过不能关闭真实使用任务，官方上游合入也不作为插件协议完成门。

## 完整交互与新增任务

[画布页面](../../../docs/design/dsh-project-canvas.md)与[公共方案](../../../docs/design/dsh-creative-studio-program.md)补全此前最小画布范围，五类节点和两类边全部保留。Agent可编辑指定范围插件草稿/布局，显示摘要且支持撤销；owner正文仍走candidate。专业Pane独立交付，回填按版本绑定，不成为基础canvas渲染前置。

第4组质量与真实验收依赖2/3组及新增5.1–5.5。正式schema描述项目scope/document revision/camera/nodes/两类边，不直接序列化React Flow内部对象；CLI/应用创建存储schema与迁移。执行状态仍归owner/Ordo。

## UI Contract 补全

- Surface classification: adopted workspace；节点renderer为embed。
- Surface kind: workspace + inspector。
- First / second / third visual priority: 当前成果与选区；主要节点操作；来源/运行详情。
- Existing components reused: ui-pane-workbench、ui-surface、ui-visual-kit、官方primitives、CreatorActionComposer、artifact-workspace、rich-media。
- Cards that earn existence: 节点与候选缩略预览；不创建等权dashboard。
- Primary scroll owner: 画布camera；文本和Inspector各自滚动，不捕获输入控件的滚轮/IME。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 项目document | 固定scope加载 | 添加首个节点 | 保留未保存编辑 | owner确认保存 | revision冲突比较 | storage缺口及任务 |
| 引用与结果 | 有界缩略加载 | 无选定版本说明 | 来源访问错误 | 固定版本可见 | 原结果保留/失权标记 | 禁用并显示原因 |
| 执行连接 | 加载实际能力 | 未映射输入 | 类型/环路错误 | 可预览 | 旧输入/计划失效 | owner不可用，其他Pane不受影响 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 可访问对象列表/单面预览 | 画布与详情互斥Sheet | 画布+一个详情或专业Pane |

### Accessibility

键盘与菜单覆盖平移/缩放/选择/复制/删除/撤销，图形操作有对象列表等价入口；焦点归host，关闭Sheet返回发起控件；所有图标有中英名称，不只用颜色表达边和状态；支持coarse pointer、200% zoom和reduced motion。

### Visual Exceptions

无。样式仅复用DSH主题，节点必要几何值遵循已有renderer例外，不增加私有token。

## 性能与续接验收

使用300混合节点、含媒体的固定样本持续60分钟；输入p95≤100ms，缓存切换p95≤200ms，订阅/DOM/heap无持续增长，零已确认丢失或重复执行。三项目两类工作、10次续接至少8次30秒内定位正确成果/下一步；网络等待单列、失败不删。协议、原型与真实DSH证据分开，详见公共合同。
