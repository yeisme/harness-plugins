## Context

依据 2026-09-07 创作台程序与 Workbench 退役决定。Eikona 公共接口见其 consumer contract matrix（generation、workflow、batch、asset/lineage/handoff）；本仓只做 DSH 侧消费。原文快照不构成实施权威。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「选资产/参数 → 动作预览 → 确认生成 → 候选比较 → 采纳回填」的一条真实路径。

不做第二 provider runtime、图像缓存权威、自动采纳最新候选、绕过 owner 费用/权限复核，或把列表顺序当最新采用。

## Decisions

1. Owner-fit：split-owner。Eikona 拥有生成执行、资产与版本；DSH 插件拥有 Pane 呈现、动作入口与候选比较 UI。
2. 只经 server-authored 动作 descriptor 发现生成/编辑/批量动作；输入类型、权限、费用状态、expected revision 来自 owner，前端不自授 capability。
3. 遮罩/局部编辑的具体模型支持在合同核对任务中逐项标注支持/缺失/未验证；缺失时保留禁用入口并显示原因与owner配套任务，不造客户端图像处理 fallback。
4. 候选比较、采纳、写回复用既有引用工作区 candidate/action 通道；资产引用按 ArtifactRefV1 固定 owner/ref/version 回填画布节点。
5. 取消先请求，收到 owner 确认才显示 cancelled；unknown 只对账原 operation。
6. 项目列表带 project scope、分页游标与 freshness；不从目录名猜项目。

## UI Contract

- Surface classification: adopted（ui-surface 完整面；画布节点内嵌预览用 ui-visual-kit）
- Surface kind: workspace（专业主 Pane）+ inspector（详情/参数）
- First / second / third visual priority: 当前资产或候选 / 主要生成动作 / 来源与技术详情
- Existing components reused: ui-visual-kit token、官方 primitives Menu/Modal、既有候选比较组件
- Cards that earn existence: 候选对比卡（同 base revision 多候选）；无卡片仪表盘
- Primary scroll owner: 资产/候选列表；参数面板独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 项目/资产列表 | 保留最后安全内容 | 解释空目录 | owner 原因 | 列表+freshness | 标明缺失范围 | 权限原因 |
| 生成动作 | 预检中 | 无可用动作说明 | owner 错误 | 回执摘要 | expected revision 过期 | 权限/费用未知原因 |
| 候选比较 | 骨架 | 无候选说明 | 读取错误 | 候选+版本 | stale 标注 | 未采纳不可写回 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回；参数折叠 | 导航/内容切换 | 列表+详情并列 |

### Accessibility

- Keyboard path: 列表→详情→动作→确认全程键盘；Escape 回发起行
- Focus owner/return: 列表行；动作完成后回候选或发起行
- Visible labels and accessible names: 动作/状态/费用文本化，不只靠颜色
- Reduced motion and coarse pointer: 禁非必要动画；触控目标 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实生成闭环在 Eikona staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，脱敏凭据与 provider payload。

## 页面、控件与验收补全

[完整页面设计](../../../docs/design/dsh-eikona-studio.md)是本change的UI细化，和本design共同约束实施。所有页面均为required；默认模型固定 `openai/gpt-5.4-image-2`，其他模型仅来自 owner capability。必须支持参考图/选区/遮罩与修改交互；模型不支持时禁用具体动作并显示原因和补齐任务。批量partial保留成功候选，失败重试范围来自owner，unknown只对账。

| 工作页 | 控件与动作 | 关键行为 |
|---|---|---|
| 生成配置 | 提示词、参考图/区域、模型、尺寸、数量、可用seed；生成预览与确认 | 预览绑定配置版本，模型或参考变化必须重做预览 |
| 候选与修改 | 批量候选网格、并排/切换比较、选定结果、遮罩和修改提示词 | 新结果仅为候选；遮罩绑定原图版本与坐标 |
| 资产与来源 | 生成来源、run、资产版本、绑定用途、固定引用与交接 | 采用、引用和交接分别操作，不自动采用最新图 |

完整路径：真实生成两候选→比较→基于选定结果修改→保留旧版并采用新版→固定版本引用/交接。重点恢复：默认模型/不支持模型、遮罩过期、费用unknown、批量partial、重复点击、采用与交接分离。第4组质量/真实验收依赖新增5.1–5.4，不能只交付列表和通用descriptor便关闭。

### UI Contract补全

- 内容主体是主要滚动owner，参数/证据独立滚动；不劫持Composer滚轮或IME。
- 复用CreatorActionComposer、artifact-workspace、ui-surface/visual-kit、官方Button/Input/Menu/Modal/DiffBlock与rich-media；不新建私有atoms。
- 图形/媒体选择必须有列表或菜单等价操作；新结果不抢焦点，关闭对话框回到触发控件。
- 视觉例外：无；不复制Workbench CSS，不增加第二主壳或万能领域表单系统。

## 依赖与回滚补全

本领域直接操作只依赖DSH host与`cli/eikona`；画布回填、跨领域编排按能力单独接入，不阻塞独立页面。已确认缺口在owner创建最小配套change，而不是在插件中实现领域状态。任务5.1必须留下负责方/操作/所需交付物/受影响任务/双向链接。

默认additive演进；旧kind、方法和closed schema保持兼容。新接口schema由CLI/owner生成，未知critical版本拒绝。禁用本Pane不删除草稿、资源或运行；原operation仍通过原owner查询/对账。采用candidate不自动写源文件、晋级Canon或发布。
## 增量原操作对账合同（2026-09-08）

共享Pane协议增加`pane.action-reconcile-request.v1alpha1`，只包含owner/actionId/expectedTargetRef/context/原idempotencyKey。严格拒绝values、提示词和新执行参数。新增Host Remote `creatorStudio.reconcile`及可选adapter `reconcile`、可选runtime `reconcileAction`；原dispatch和旧adapter形状保持兼容。

Host校验当前可信上下文，调用唯一选中的owner adapter，等待后再次校验上下文与回执owner/action。对账无需原生成descriptor仍有效，但必须由owner重新校验当前身份对原操作的查询权限。查询缺失、拒绝、传输异常或无法关联回执时保持unknown，不调用dispatch、不切换transport、不执行生成。客户端只在原操作存在时使用原幂等键；没有保存的原标识则诚实拒绝，不能新造标识。

UI在unknown/pending旁显示独立“核对原操作”。旧runtime未实现时禁用并解释原因。查询不会带上正在编辑的下一份草稿，也不会使旧确认重新生效。receipt的accepted/completed/partial/failed仅表示owner确认的原操作事实；查询被rejected不等于原执行failed。

本增量为兼容新增，无弃用窗口或数据迁移；回滚时移除新增入口，旧dispatch继续工作。持久恢复标识和Eikona HTTP映射仍为2.4/5.4剩余工作，本合同实现不能证明刷新后unknown恢复或真实owner调用已完成。
