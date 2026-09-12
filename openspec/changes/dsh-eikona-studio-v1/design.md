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
## 生成台工作页实现（2026-09-08）

`creator.visual`在原Pane宿主内提供生成配置、候选与修改、资产与来源三页。页面容器`EikonaStudioPages`不拥有领域数据，只组合原CreatorActionComposer、CreatorArtifactWorkspace和资源投影；已有controller/runtime/receipt继续共用。配置默认打开，其他页首次选择后挂载；已访问页面保留挂载以保留草稿与选中对象。切页暂停其媒体，不取消owner操作。各编辑区脏状态汇总为OR，未编辑的候选页不能清掉配置页的未保存标记。

UI Contract增量：使用现有Surface根、官方Button及vk-btn；tablist/tabpanel关联唯一useId，单一tab stop；左右方向键循环，Home/End定位首尾并激活；中英locale，窄Pane导航换行。不开第二主壳，不新增执行按钮或owner能力。切页保留只限当前Pane生命周期，不宣称跨刷新草稿恢复。

当前候选页内容仍取决于owner的artifactWorkspace合同；域内遮罩、完整参数预览、lineage和真实生成路径仍按5.3/5.4验收，不因三页导航完成而晋级。
## 生成配置草稿的项目隔离（2026-09-08）

共享CreatorActionComposer按tenant/workspace/project/principal/owner/task及固定descriptor入口区分临时草稿。组件绑定切换时，在新scope提交渲染前存下旧values/选中动作，恢复新scope自己的草稿或默认值；确认不跨scope复用。旧请求的迟到回执不能进入另一scope的onReceipt或清空其输入。若显示的动作descriptor仍属于旧项目，执行入口保持禁用。

缓存只存在当前组件内，没有新增正文owner或浏览器持久存储。回到原scope时保留待审草稿，即使其旧请求后来完成也不据此自动清空；实际保存与采用仍按owner回执和版本审阅。关闭Pane/刷新后的恢复尚未完成，不能由此规则推导持久化保证。
# 固定生成准备的 Host 消费进展

## UI Contract：费用批准表单

观察新鲜度：再次查询中/失败时标明展示的是上次成功观察，保留其时间；返回时间早于当前记录、撤销事实回退或已领取操作改变则拒绝覆盖。5项批准组件覆盖旧观察回退，client typecheck/UI静态门及原生恢复回归通过，证据 `temp/integration-test-runs/eikona-discovery-20260909045635Z-3388298/`。本地记录仅用于一致性保护，不能作为后续执行授权。

两步查询连接一致性：readApprovalStatus 在能力探测前固定完整 Host connection，discovery 与后续GET均通过该绑定读取；resolve 返回的凭据、scope、URL、admission或context变化会停止查询，各请求原有late检查保留。16client测试（含凭据替换零HTTP）与Host typecheck、原生恢复回归通过：`temp/integration-test-runs/eikona-discovery-20260909045252Z-3342789/`。绑定仅在内存比较，不输出连接配置，不建立执行授权缓存。

恢复能力探测：Host 在 GET状态前通过当前已核验discovery确认 approval_status.v1 为available/read_only且读开关开启，不依赖写开关；缺声明或pin不匹配不继续查询。7项discovery测试覆盖写关闭/读关闭/非只读声明/未重签摘要，Host typecheck及原生丢包失权恢复通过，证据 `temp/integration-test-runs/eikona-discovery-20260909044901Z-3291218/`。能力只表示接口支持，读取仍由当前owner授权复核。

已领取操作展示：核对成功保留observedAt及可选consumedOperation，若owner返回领取事实，明确提示撤销不取消该操作，按原身份核对运行结果；不推断运行终态。5项批准组件覆盖同时revoked与consumed的引用展示，client typecheck/UI静态门及原生丢包/失权恢复回归通过，证据 `temp/integration-test-runs/eikona-discovery-20260909043944Z-3172153/`。浏览器该关联操作来自组件fixture，真实生成/领取→UI链仍待。

失权恢复验收：原生浏览器在owner撤销成功但响应丢失后，第一次GET状态由测试transport注入403；界面保持unknown/锁定，原回执保留、owner写入仍为1。恢复访问后第二次查询同一批准，实际owner返回revoked后解锁。总计1撤销写入、2状态查询；证据 `temp/integration-test-runs/eikona-discovery-20260909043347Z-3106111/`，Host typecheck通过。403为受控测试注入，正式凭据变化/跨刷新恢复仍待。

原生撤销丢包恢复：`temp/integration-test-runs/eikona-discovery-20260909043044Z-3068675/`。真实 Eikona HTTP 撤销成功后在测试 transport 消费响应并抛出连接错误；浏览器显示unknown且准备锁定，点击核对原批准后经原生Remote/Gateway/GET状态确认revoked并解除锁定。统计1次owner撤销写入、1次浏览器状态查询，无重发或生成；正常后续采用/恢复继续通过。丢包由测试注入，实际状态与读取均来自owner；跨进程/刷新恢复、缺批准ref的unknown创建仍待。

核对状态按钮已接正式回执：只提交已知批准ref，匹配返回项目/准备/digest后核实revoked才解除未确认撤销锁定；读取失败或未核实撤销保留原回执及unknown，不重复撤销。读取不由UI写权限禁用，仍由owner校验当前读取权限。11项表单组件覆盖unknown→只读revoked恢复，client typecheck/UI静态门及原生正常链回归通过，证据 `temp/integration-test-runs/eikona-discovery-20260909042723Z-3024043/`。真实丢包→原生核对按钮恢复尚待，缺批准ref的unknown创建与跨刷新恢复另有缺口。

只读状态 Remote 已接 adapter/Gateway/bundle/controller，query只含批准ref，result严格保留状态事实及引用匹配，await后复核完整context与adapter世代。实际Gateway→owner撤销后查询通过，33runner证据 `temp/integration-test-runs/eikona-discovery-20260909042326Z-2977857/`；14bundle、36Remote/controller、Host build/client typecheck通过。尚未挂恢复按钮，查询成功不会自动解除未知状态或恢复执行。

只读状态消费：owner 配套 `cli/eikona/openspec/changes/eikona-preparation-approval-recovery-v1`。Host readApprovalStatus 通过 GET 原批准引用，project由凭据scope填入；校验独立 revoked/expired/consumed_operation、固定准备摘要与观察时间，期限计算矛盾拒绝，不派生 execution authority。实际撤销后查询通过，证据 `temp/integration-test-runs/eikona-discovery-20260909042014Z-2941826/`；16合同/client及Host typecheck通过。尚未接Gateway和界面核对按钮。

撤销状态展示修复：revoking/unconfirmed 优先于旧 approved 文案，避免同屏同时说“批准有效”和“撤销结果未知”；只保留一条当前状态说明，原预算/准备/回执信息继续可核对，unknown 不再次提交。5 项批准组件测试覆盖状态替换、引用保留与零重发，client typecheck/UI静态门和原生浏览器正常批准撤销回归通过，证据 `temp/integration-test-runs/eikona-discovery-20260909040617Z-2794460/`。未知撤销的实际网络丢包与只读查询恢复仍待。

撤销 UI 已挂正式回执区域，官方 Button 明确确认撤销及“已开始任务不会取消”的影响；沿用批准独立权限。处理中/unknown 通知父表单锁定准备，confirmed revoked 保留回执、替换状态文案并禁止再点击；失败保留回执，不伪造成功。原生浏览器通过 DSH Remote/Gateway→实际 owner 撤销一次，按钮禁用与已撤销文案正确，证据 `temp/integration-test-runs/eikona-discovery-20260909040358Z-2760784/`；10 项表单组件、client typecheck/UI静态门通过。撤销未知结果查询、跨刷新恢复和生成执行仍待。

撤销调用层已连接 optional adapter/Gateway、安装 bundle、版本化浏览器 Remote/controller，共享严格 input/result 合同，明确确认且回执必须匹配 approvalRef；context变化或回执不符保持unconfirmed。实际 Gateway→owner 撤销与33项runner通过，证据 `temp/integration-test-runs/eikona-discovery-20260909040027Z-2715752/`；14bundle和35Remote/controller测试、Host build/client typecheck通过。尚未挂载撤销按钮、浏览器撤销和查询恢复。

Host 撤销切片：revokePreparationApproval 复用实际 owner POST approvals/{ref}:revoke，要求明确确认、固定 ega 引用及独立 generationApprovalApproved；项目由 credential scope 填入。严格匹配返回 approval_ref/state=revoked，其他响应保持 unconfirmed，不宣称已取消运行。实际 HTTP 撤销及同引用重复撤销均通过，33 项 runner 证据 `temp/integration-test-runs/eikona-discovery-20260909035732Z-2681770/`；15 项client测试和Host typecheck通过。此方法未接Gateway/UI，未知响应查找与已领取批准的运行对账仍待。

到期显示：根据回执 expiresAt 设定一次定时检查，窗口 focus/visibilitychange 时复核本地时间；到期显示明确限制，保留原回执，不自动请求新批准。卸载清理定时器与事件监听。owner 仍是执行时批准有效性的唯一权威，本地显示不代表未撤销。4 项批准组件测试（fake clock 到期/无重复批准/清理）、client typecheck/UI静态门及原生浏览器回归通过，证据 `temp/integration-test-runs/eikona-discovery-20260909035424Z-2644306/`。撤销查询、到期后新批准流程及恢复仍待。

批准回执展示增加 definition list：approvalRef、preparationRef、owner maxCostUSD 与 expiresAt（time datetime），不靠成功提示代替可核对引用。实际原生浏览器读取到相同准备及 0.75 USD 预算和到期字段，证据 `temp/integration-test-runs/eikona-discovery-20260909035136Z-2612250/`；原生整链恢复通过，之前 owner 编译阻断已解除。3 项批准组件、client typecheck 与 UI静态门通过。到期后的状态刷新、批准查找/撤销与跨刷新恢复仍待。

未确认批准保护：批准开始时同步通知准备区域，禁用原准备字段、变量增删和再次创建；unknown 保持锁定并显示说明，明确成功/拒绝才解除。批准状态参与既有 dirty 汇总，防止编辑准备卸载批准表单后丢失未知状态。9 项组件测试、client typecheck、UI 静态门通过。原生集成 `temp/integration-test-runs/eikona-discovery-20260909034708Z-2558378/` 未通过：Eikona 当前工作树 responses_image.go:33 对 modelref.ModelID 的返回值数量不匹配，独立编译复现；该文件不属于本轮修改，未修改无关 provider 实现。此轮原生通过声明保留为空，批准恢复入口仍待。

原生浏览器批准已验证：`temp/integration-test-runs/eikona-discovery-20260909034329Z-2484057/`。准备后空预算/未许可均禁用，填写预算仍需主动选择未知费用许可，确认后通过实际 DSH Remote/Gateway 调用 Eikona HTTP/GORM 批准，仅一次 approve 请求，成功后按钮保持禁用、文案明确尚未执行。后续采用与恢复测试继续通过，未配置收费 provider。首次失败 `eikona-discovery-20260909034046Z-2452969/` 为原生 select 可访问名称包含选项而导致严格label定位失败，改用combobox角色定位，未放宽许可要求。批准恢复、真实生成与最终交付仍待。

正式配置页已挂载：准备成功且提供 approve 回调时在准备表单之外显示批准区域，按 digest 重挂载；修改准备输入即移除旧区域，不能保留旧预算许可。approval-capability 独立于 preparation-capability，要求 owner capability 与 Host generationApprovalApproved、单项目scope成立；页面仅在新鲜快照下开放批准。2 项批准组件及6项准备测试、Host build/client typecheck/UI静态门通过；实际owner回归 `temp/integration-test-runs/eikona-discovery-20260909033810Z-2408910/`，既有六页视觉回归 `ui-visual-2026-09-09T03-38-50-419Z-2431686/`。新批准区域的原生浏览器提交与恢复仍待。

- adopted workspace 内嵌 SurfaceSection；复用官方 Input/Button、ys-field 内 select 和现有 locale，不创建第二主壳或弹窗。
- 第一优先级预算与许可，第二固定模型/单图/一小时期限，第三 owner 回执。无新增卡片，滚动归现有 Pane。
- 初始预算为空、许可为否；编辑预算清除许可；处理中冻结控件；unknown 保留内容并禁止再次批准；approved 明示尚未执行；权限不可用有可见原因；错误不清草稿。
- 三种宽度均单栏。可见 label、Tab 路径、官方焦点样式；无新增动画，复用 coarse pointer/reduced-motion。
- 父级按完整 context 和准备 digest 重新挂载，防止许可沿用其他准备。当前尚未挂入正式配置页，也未验收浏览器批准；组件测试覆盖许可/预算变化/unknown不重发。无视觉例外。

浏览器费用批准调用层：注册 approveEikonaPreparation@1，复用 Host 导出的输入、结果与预算/摘要绑定函数；controller 在 reset/context/dispose 后返回 unconfirmed，不把迟到批准当新项目授权，也不自动重发。缺少 confirmed 或 allow_unknown_cost 的请求在 transport 前拒绝。34 项 Remote/controller 测试、Host build 与 client typecheck 通过。此层尚未挂载批准 UI，原生浏览器批准、批准只读恢复与执行闭环继续待验收。

费用批准 Gateway：新增 optional adapter approveEikonaPreparation 和同名 Remote，安装 bundle 注册调用。请求严格校验 confirmed/unknown-cost许可、固定摘要和限额；回执使用严格白名单并复核准备/摘要/金额/期限。await 后 context/directory/generation/adapter 变化返回 unconfirmed，不能假定批准未创建。实际 Gateway→owner HTTP/GORM 通过，33 项 runner 证据 `temp/integration-test-runs/eikona-discovery-20260909032846Z-2286377/`；14 bundle 测试、批准回执合同测试及 Host typecheck 通过。浏览器批准 UI、批准恢复与生成调度仍待，尚不开放完整执行闭环。

Host 费用批准切片：approvePreparation 要求 confirmed=true、allow_unknown_cost=true、固定 preparation_ref/digest、非负有限金额、单图和 1–86400 秒期限，连接另外要求 generationApprovalApproved，不能从 preparationApproved 推导。project_ref 仍由凭据绑定填入；返回批准匹配项目/准备/摘要/金额且未过期，异常返回 unconfirmed。复用既有有界 transport，零自动重试，不调用生成。实际 owner HTTP/GORM 批准及 33 项 runner 通过，证据 `temp/integration-test-runs/eikona-discovery-20260909032624Z-2242160/`；14 项 client 测试及 Host typecheck 通过。此为内部 client 方法，尚未发布 Gateway/浏览器批准入口，恢复批准与执行接线仍待。

原生浏览器变量与旧版保留：`temp/integration-test-runs/eikona-discovery-20260909032326Z-2201979/` 使用实际 owner 模板默认值先创建准备，再通过表单添加多行中文变量并提交同一模板版本。第二个准备 ref 与 promptDigest 改变，PromptRef 保持固定版本；HTTP 重读第一个准备验证 digest/promptDigest 未变。浏览器共两次准备请求，没有生成或额外采用。33 项回归及原生浏览器综合路径通过，Host typecheck 通过。输入内容仅测试 fixture，真实 provider、跨刷新恢复及批准执行尚未验收。

原生浏览器准备创建证据：`temp/integration-test-runs/eikona-discovery-20260909031612Z-2104845/`。复用已有 native DSH Connection/Remote、真实 Typert registry/Gateway 与安装 bundle；表单调用 controller.prepareEikonaGeneration，经过 Host adapter 和实际 Eikona HTTP/GORM 创建准备。断言浏览器仅一次 prepare 请求、返回预先由同一 owner 固定输入生成的引用、采用计数不变。没有 window 提交桥，也没有收费 provider。后续采用/比较/刷新对账路径继续通过；360 中文截图人工检查确认操作区可见，但准备字段刷新后为空，跨刷新恢复仍是明确缺口。fixture 为准备服务显式指定测试项目绑定，正式多项目配置仍需独立验收；不能据此认定完整配置→生成→修改闭环完成。

准备返回绑定增加共享 matchesEikonaPreparationInput：成功返回的 PromptRef 必须等于提交的固定 ID/版本，显式模型必须等于提交的 canonical ref（允许首尾空白规范化）；未指定模型时由 owner 选择默认。Host HTTP、Gateway adapter seam 和浏览器 controller 使用同一规则，防止某一层接受其他模型的准备。14 项合同/client 测试、Host build、client typecheck 和 33 项实际 owner runner 通过，证据 `temp/integration-test-runs/eikona-discovery-20260909031421Z-2067315/`。这不重建 owner 参数规范化，也不宣称所有输入摘要已由浏览器重新计算。

## UI Contract：固定提示词准备表单

失败反馈按既有状态区分invalid_input、permission_denied、needs_contract、unknown与unavailable，说明核对参数、恢复项目访问或核验合同，全部保留草稿。unknown仍禁止重复创建，不自动重试。10项准备组件测试覆盖分类文案与原输入保留，typecheck/UI静态门及六页浏览器回归通过，证据 `temp/integration-test-runs/ui-visual-2026-09-09T05-09-42-368Z-3590488/`。更细owner错误码尚未投影，未伪造模型能力错误原因。

固定参数核对：准备成功后以既有receipt definition list展示owner返回的PromptRef、模型、尺寸/种子（有值才显示）和准备digest，不从草稿输入拼接已保存事实。原生browser验证1536x1024/42来自owner读回，证据 `temp/integration-test-runs/eikona-discovery-20260909050556Z-3532713/`；12表单测试、typecheck/UI静态门及六页360/560/960中英视觉通过，证据 `ui-visual-2026-09-09T05-06-55-910Z-3564618/`。真实provider执行尚待。

尺寸/种子原生准备验收：浏览器输入1536x1024及42，经DSH Remote/Gateway/实际owner HTTP创建固定准备，随后GET读回controls与输入一致，旧准备digest保持不变。原生批准/撤销/恢复后续路径继续通过，证据 `temp/integration-test-runs/eikona-discovery-20260909050306Z-3481240/`；Host typecheck通过。该证据只证明准备传输和持久化，不代表模型provider执行支持或真实生成完成，模型能力准入仍需专门验证。

尺寸/种子编辑：新增官方Input，可选size及安全整数seed，留空不传以保持owner默认；更新字段清除旧准备展示，按原流程重新准备，不复用旧批准。两字段进入dirty、busy及未确认批准锁定，输入说明说明支持由当前模型验证。不在UI枚举未经验证的模型参数。12项表单测试、client typecheck/UI静态门及六页浏览器回归通过，证据 `temp/integration-test-runs/ui-visual-2026-09-09T05-00-31-617Z-3436698/`；新增参数实际owner执行仍待。

模板变量编辑：按变量名和多行内容增删行，使用官方 Input/Button 及 ys-field 内 textarea；最多 64 项、名称 160 字符、内容 4096 字符，名称去首尾空白后唯一且非空，内容保持原文。默认不传 values，继续使用 owner 模板默认值；新增行纳入 dirty，提交后编辑会清除旧展示，unknown 仍保持不可重复提交。6 项组件测试覆盖中文换行/等号保留、重复名称阻止和删除后正常提交。变量声明、缺失必填和模板渲染仍归 owner，不在浏览器复制模板引擎。整份请求字节上限继续由 Host 验证；模板变量发现与自动字段生成尚待。

输入约束可见化：提示词 ID 与固定版本均提供中英说明，aria-describedby 关联，非法已输入 ID/非法版本通过 aria-invalid 标记；ID 设置 160 字符上限。无效输入不会触发准备。5 项组件测试、client typecheck 与静态 UI 门通过；360/560/960 中英六路径无横向溢出，证据 `temp/integration-test-runs/ui-visual-2026-09-09T03-18-44-501Z-2144966/`。此处未新增提示词检索器，按 ID 选择仍是当前准备入口的使用限制。

草稿离开保护：准备表单将输入变化、处理中和 unknown 汇报给现有 onDirty；OwnerWorkspace 将 preparation 与 configure/candidates 独立汇总，避免其他区域清理状态遮蔽准备草稿。固定准备虽然已由 owner 保存，但页面选中与字段尚未接入刷新恢复，故成功后仍保持 dirty，清空至初始值才解除。4 项组件测试及 client typecheck 通过；六条既有表单浏览器回归通过，证据 `temp/integration-test-runs/ui-visual-2026-09-09T03-11-52-471Z-2024283/`。这只补离开提示，不能替代跨刷新草稿恢复。

组合输入防误提交：表单监听 composition 状态，Enter 在组合中、isComposing 或兼容 keyCode 229 时不触发表单默认提交，submit handler 也核对组合状态。组件反例先复现组合输入期间一次错误提交，修复后 3 项组件测试和 6 条浏览器路径通过；浏览器路径派发 composition 事件并使用真实 Enter，确认零准备请求，结束组合后普通 Enter 正常。证据 `temp/integration-test-runs/ui-visual-2026-09-09T03-09-32-757Z-1983523/`；这不是操作系统真实中文输入法人工验收，保留该限制。client typecheck、check:surfaces、check:plugins 通过。

表单现已挂载正式 Eikona configure 页，key 为完整 snapshot context；准备能力资源不再混入资产列表。可用状态要求新鲜快照、owner preparation capability available、workload delegation、读写开关及 Host preparationApproved 与单项目 credential scope 同时成立。配置不完整时保留说明并禁用提交；后端每次请求继续复核，不以 UI 状态授予权限。当前表单尚未支持变量编辑和跨刷新持久化，浏览器真实准备提交仍需后续证据。

既有视觉套件 146 项通过，证据 `temp/integration-test-runs/ui-visual-2026-09-09T02-59-23-545Z-1835306/`。新表单尚未进入这些浏览器 fixture，故此结果仅证明现有页面未观察到回归，不作为新表单视觉验收。

- Surface classification: adopted，嵌入现有 workspace；archetype 为 Creator workspace，不新增主壳。
- 第一优先级：固定提示词 ID/版本；第二：创建准备状态；第三：默认模型及“不是执行批准”的说明。
- 复用 SurfaceSection、官方 Input/Button、ys-field、cs-receipt 与现有 locale；无额外卡片或 CSS，主滚动归现有 Pane。
- Loading：保留输入并禁止重复提交；Empty：可见 label、版本默认 1；Error：保留草稿并说明核对版本/权限；Success：展示 owner 准备引用与未知费用；Unknown：保留草稿，停止提交并提示核对 owner；Disabled：显示尚未开放原因。未将准备成功视为生成成功。
- Responsive：<=420、421–720、>720 均采用原有单栏表单；不增加固定宽度。准备引用沿用现有 receipt 区。
- Accessibility：Tab 依次进入两个 label 对应的 Input 和官方 Button，Enter 提交；无自建焦点管理和动画，复用原有 coarse pointer/reduced-motion token。中文/英文进入 locale，pseudo 继续由现有翻译器生成。
- Visual Exceptions：无。
- 验证：2 项组件测试覆盖固定参数、重复点击、unknown 保留与不可用说明；client typecheck、check:surfaces、check:plugins 通过。表单当前尚未挂载正式页面，实际浏览器表单布局、IME、刷新持久化与动态 capability 接线继续待验收，不以现有视觉套件替代。

浏览器 Remote wrapper 新增版本化 `creatorStudio.prepareEikonaGeneration@1`，共享 Host 导出的严格输入/结果 codec；controller 提供同名方法，对缺失能力诚实降级，验证 PromptRef 对应提交的固定版本，并在 reset、dispose 或 context 变化后丢弃迟到结果。不会自动重发准备请求。32 项 Remote/controller 测试通过，Host build、客户端 typecheck 和本轮 diff 空白检查通过。该层是可调用接口，尚未完成配置表单与浏览器端到端操作验收，不能标为生成闭环完成。

Gateway 增量入口 `prepareEikonaGeneration(input)` 已注册安装 bundle，optional adapter seam 保持旧 adapter 无方法时 unavailable。固定输入与返回投影使用共享 Zod 合同；返回正文、额外字段、错误版本形态不能穿过 Gateway。实际 context、directory 身份、generation 和选定 adapter 在 await 后复核。实际 Gateway→adapter→HTTP→GORM 准备创建集成及 33 项 runner 通过：`temp/integration-test-runs/eikona-discovery-20260909025048Z-1516495/`；13 项客户端与 14 项 bundle 测试、Host/bundle typecheck 通过。这里只创建 owner 草稿准备，执行与批准仍是独立动作；浏览器 Remote wrapper/配置页面尚待。

Host 创建准备已接实际 owner：prepareGeneration 复用现有有界 transport，使用严格固定提示词/变量/typed controls 输入，序列化输入上限 48 KiB，项目由 Host credential scope 填入。新增独立 preparationApproved admission，不复用采用或媒体权限；读取完成继续核验当前权限。返回准备必须绑定提交的 PromptRef；unknown 不重试，不执行 provider。实际 HTTP→GORM 创建与固定输入相同引用、随后 snapshot 全链通过，证据 `temp/integration-test-runs/eikona-discovery-20260909024737Z-1366173/`；另有客户端权限、越界输入与断线零重试测试。页面配置调用、批准和执行尚待接通。

快照全链验证：`temp/integration-test-runs/eikona-discovery-20260909024450Z-1244036/` 将实际 owner 准备通过 adapter、CreatorStudioOwnerDirectory 和实际 Cordis CreatorStudioGateway.snapshot，再执行公共快照 schema 校验。固定 ref/digest 和无执行动作保持一致，正文及 owner URL 不进入最终投影。33 项 runner 测试和 Host typecheck 通过。参数摘要采用有界字段文本拼接，避免 JSON 转义膨胀超过资源摘要上限。尚未宣称浏览器配置或真实生成完成。

Discovery adapter 增量接受第三个可选参数 selectedPreparation(context)，由 Host 返回 preparationRef 与 digest，旧两参数调用保持原行为。读取前后复核选中引用与摘要，仅匹配时追加 generation-preparation 资源，复用现有 snapshot 展示；参数仅包含 owner typed controls 的有界白名单，费用保持 unknown，execution 保持 not authorized。此资源不是执行 descriptor，也不替代后续配置/确认页面。实际 Go HTTP→adapter 的正常与中途取消选择路径及现有 33 项回归通过：`temp/integration-test-runs/eikona-discovery-20260909024236Z-1185950/`。第一次测试配置错用另一实例 pin 的失败证据保留于 `eikona-discovery-20260909024108Z-1112665/`；修复测试绑定，没有放宽生产 pin 校验。

实际 owner 接线证据：`temp/integration-test-runs/eikona-discovery-20260909023829Z-944280/`。沿用 Eikona discovery 集成 runner，在临时 Go owner 内通过项目注册、canonical prompt 创建和 GORM CreatePreparation 生成固定输入；由实际 owner HTTP router 验证 delegation 并读取，再由 EikonaDiscoveryClient 投影。断言默认模型、准备引用、项目、单候选、未知费用、未授权执行及无正文泄漏。完整 runner 通过且 Host typecheck 通过。准备数据来自实际 owner 服务，但图像仍为 fixture，未运行收费 provider；本轮没有浏览器准备页面验收。

EikonaDiscoveryClient 的 readPreparation 复用既有受信连接、1 MiB 响应上限和请求完成后的 scope/pin 复核，使用 GET 读取 owner 准备。project_ref 从 Host 已核验的单项目 credential scope 得出，不接受浏览器指定其他项目。新投影只保留固定引用、摘要、模型、候选数量、未知费用和未授权执行状态；原始正文与额外字段不进入返回值。模型与摘要不一致、非单图准备或 execution_authorized=true 返回 needs_contract。

本轮 12 项客户端合同测试及 Host typecheck 通过；证据级别为 fixture。此读取方法尚未注册成 Pane 生成动作，不能据此宣称准备 UI、批准、执行或真实生成闭环完成。后续在同一 adapter 接入实际 owner 准备、显式未知费用许可和一次性批准，继续复用既有确认与 unknown 对账机制。


## 生成表单恢复合同（实施中）

现有 ProjectCanvasStore 的 document/journal 仅归画布；editor-recovery 合同归 Auctra 正文，operation-recovery 归执行观察。生成表单使用独立版本化 storage-domain，复用 Host 单实例串行读校验写、revision 冲突与待确认写入恢复方式，不以隐藏画布节点持有独立 Pane 草稿。

首步增加内部 eikona.studio_draft.v1 schema：tenant/workspace/project/id/revision、原始编辑文本与变量数组，允许暂时无效和重复变量名以免恢复时丢内容；执行时仍走准备合同校验。UTF-8 聚合上限 320 KiB。checkpoint 显式记录 editing、准备未确认、固定准备引用、批准未确认、批准观察、撤销未确认；批准观察仅含 opaque ref/digest，恢复不得解释为有效批准。禁止额外许可、凭据或 provider payload 字段。

4 项合同单测通过：原样保留无效草稿、拒绝许可字段、未确认与引用约束、UTF-8/revision 边界。当前只有内部合同与单测，尚未导出 Remote、实现存储或接表单；不得宣称已支持刷新恢复。后续需存储 CAS/写入不确定、页面加载前阻止覆盖、dirty 清理时机和恢复后零执行验收。


Host 草稿 store 已补内部实现：yeisme_eikona_drafts_v1 独立 domain，单 Host 实例序列化 read/check/write；key 使用 tenant/workspace/project/id，读写前后复核完整当前上下文，跨会话可读取同项目草稿，旧上下文迟到请求拒绝。revision 为基础版本，首次保存0→1；保留最近32个requestId/digest/revision用于同请求重放与只读reconcile。原子put已提交但回执丢失返回unknown，reconcile读到回执后确认saved；未找到回执仍unknown，不假装未写入。历史回执淘汰后旧基础版本冲突。关闭后拒绝新请求，等待队列并关闭domain。

存储验收目前为内存storage-domain适配器单测：跨store关闭重开及会话读取、竞争基础版本、请求ID冲突、写后错误只读对账、项目隔离与关闭。尚未在Host installer装配真实storage-domain，也未接Remote/表单；不能宣称磁盘重启恢复。双Host共享同domain不在单实例序列化保证内，装配必须确保每个Host仅一个store owner。


Host 装配更新：CreatorStudioGateway 在已有 storageDomain 可用时创建唯一 EikonaDraftStore，随 Gateway effect 关闭；无 storage 时三个方法返回 unavailable。bundle 显式注册 readEikonaDraft/saveEikonaDraft/reconcileEikonaDraft，沿用 src-json transport。真实 DSH staging 的 storage/storage-json/storage-domain 由 Cordis plugin 装配，直接经过 Gateway 保存、核对磁盘 domain 文件、dispose、另一会话重开，读回未确认草稿和保存回执；旧版本写入冲突、其他项目读取拒绝。复用既有存储集成 runner，3 项（含原画布2项）通过，证据 temp/integration-test-runs/project-canvas-storage-20260909063238Z-390689/。Host typecheck 与 bundle 15 项测试通过。

这证明真实存储与Gateway生命周期，不是浏览器刷新恢复。客户端codec/controller/表单尚未接线，启动恢复完成前必须阻止空表单覆盖旧草稿；不恢复执行许可。


客户端草稿读写接线（页面前置）：共享contracts导出query/save/reconcile和严格结果schema，Host store复用共享输入定义；native Remote为三个方法注册@1 src-json codec，controller提供可选兼容入口。controller核对当前tenant/workspace/project、完整上下文代际、返回草稿id/scope、保存requestId及base+1 revision。错误、非匹配与迟到返回均unknown，不自动重试、不触发领域dispatch。3项controller反例与8项Host合同/store单测通过，Host build及client typecheck通过。页面仍未消费这些接口，恢复加载与本地dirty/保存提示待实现。


页面状态协调前置：EikonaDraftSession 仅管理当前挂载表单的loading/ready/saving/unknown/conflict/error与dirty；Host仍是revision/持久化真源。加载前拒绝编辑，读取失败不当作missing；读取到保存内容或missing后才可编辑。保存冻结当前字段、checkpoint、requestId及base revision，未知结果只对账原请求；冲突保留本地草稿，不通过重新load覆盖。dispose忽略迟到结果。恢复任何checkpoint均不调用准备、批准或生成。3项状态单测及client typecheck通过；模块尚未用于React表单，不作为页面恢复验收。


React生成表单已初步接草稿：项目上下文存在时由views注入controller runtime，首次加载前禁用输入/准备，读取后原样还原字段；提供手动保存、失败重读与未知保存只读对账。准备前持久化preparation_unconfirmed，只有保存确认且组件仍挂载才调用owner；准备返回后记录prepared或对应不确定状态。批准前保存approval_unconfirmed，批准成功存opaque approval观察；读取恢复时prepared允许显式重新准备，其他owner待确认状态锁定并显示已有引用，绝不自动恢复批准。费用许可不落盘。

现阶段仍保持离开dirty提示（保存后尚未收敛dirty清理）；不自动保存每次输入。批准/撤销恢复后的完整读取和交互尚待，读取到未知且没有引用时无法凭空对账。组件使用统一SurfaceSection、Button/Input和zh/en/pseudo词条，未加局部样式。StrictMode复用同一次加载，unmount后的保存完成不发owner请求。17项相关状态/表单测试（含新增unmount反例）、client typecheck、check:surfaces/check:plugins通过；新增存储工具栏的真实浏览器视觉及刷新验收待补，不能使用原无draftStorage fixture截图替代。


离开提示更新：有草稿存储时，以当前字段与已确认draft字段的差异、session dirty/phase以及owner未确认状态共同决定onDirty；已读取或已确认保存且字段一致时清除提示，继续编辑即恢复。unknown保存不清dirty，原requestId/revision对账确认才清除；恢复owner待核对、当前批准未解决或准备unknown仍保留提示。无draftStorage兼容入口保持原行为。新增正常保存后编辑、unknown保存后对账两条组件测试；16项表单回归及client typecheck通过。


原生浏览器草稿刷新验收：现有native-menu fixture的EikonaPreparationForm按真实snapshot.context注入controller draftStorage，未用浏览器localStorage替代Host。实际Cordis Gateway+JSON storage-domain保存未完成seed为“-”与固定prompt ID，读Gateway确认已保存，再page.reload，原生Connection重连后表单恢复同样字段。刷新前后saveEikonaDraft/prepareEikonaGeneration/approveEikonaPreparation请求计数不增加。之后清空非法seed继续无效版本拒绝→有效准备→变量size/seed修改→批准/撤销未知对账→候选比较采用路径。33项集成runner含浏览器通过，证据 temp/integration-test-runs/eikona-discovery-20260909065905Z-742996/。该证据覆盖手动保存后的浏览器刷新，不是未保存输入自动恢复或批准观察完整恢复。


恢复批准的只读入口：EikonaRestoredApproval仅在已恢复checkpoint含approvalRef且readStatus可用时出现；用户点击后查询原批准，校验approvalRef/preparationRef/digest三者匹配。展示撤销/过期/观察时间以及独立consumedOperation；读取失败或绑定不符保留未确认，不解除restoredLock、不批准、不生成。沿用官方Button、cs-receipt及zh/en/pseudo词条。2项新组件测试与6项草稿表单回归、client typecheck通过。下一步仍需原生刷新后查询验收、重复观察防回退、明确撤销后继续编辑与完整批准恢复路径；当前只读入口不等于整个恢复闭环完成。


恢复批准观察防回退已补：先严格校验状态schema，再校验固定批准/准备/digest；已接受的观察拒绝更早时间、revoked/expired回退、consumedOperation变更、项目或expiry变更。新查询失败时保留上次成功观察，并显示本次未确认提示。8项组件测试、client typecheck与surface门通过。原生浏览器完整路径在批准已撤销、草稿保存approvalRef后刷新，点击“核对已保存批准”，经真实Remote/Gateway/Go owner读回撤销事实；批准请求数不增加，创建准备仍锁定。33项runner含browser通过，证据 temp/integration-test-runs/eikona-discovery-20260909070811Z-930092/。明确用户操作解锁已撤销草稿及无ref未知批准恢复仍待。


撤销后继续编辑已接：新增保守可选checkpoint approval_reconciled，revoked固定true，保留原approval/preparation/digest、observedAt及可选consumedOperation；旧读取器不认识新枚举时失败关闭。只在用户明确点击且当前读取未失败时调用本地persist，确认后解除restoredLock；unknown保存不解锁。恢复该checkpoint可编辑，不持有执行许可，不修改owner批准或运行。16项相关组件测试、Host build/client typecheck/surface门通过；native刷新→真实owner读取撤销→明确继续→Gateway读回checkpoint→表单解锁且批准请求未增加，33项runner通过，证据 temp/integration-test-runs/eikona-discovery-20260909071234Z-1005641/。尚未解决无ref未知批准恢复、有效批准重新绑定与完整生成闭环。


草稿容量反馈：表单复用Host共享eikonaDraftFieldsSchema验证存储界限，超过聚合UTF-8限制时显示alert，保留全部变量输入并禁用保存/创建准备，其他字段仍可编辑以修复；不默默截断或丢弃。组件用26条合法中文长变量加载，添加第27条跨界，验证无save/prepare调用、完整文本保留，缩减后恢复保存。9项草稿表单测试、client typecheck、surface门通过。此为容量错误的组件验证，不替代300节点或长时性能验收。


草稿工具栏视觉覆盖已增加：eikona-pages视觉fixture装配明确标注的内存draft runtime，360/560/960px × zh/en验证键盘Enter保存一次、零prepare、无横向溢出，并留存新增eikona-draft截图；保留原IME/页面切换/资产流程。初次截图发现新Button缺cs-button/vk-btn导致fallback主题文字对比不足，已为草稿和恢复批准按钮复用既有class。复跑6项通过，证据 temp/integration-test-runs/ui-visual-2026-09-09T07-20-51-638Z-1094331/，人工查看360px中文截图确认按钮可读；surface门通过。输入框仍存在预览fallback样式差异，需后续收敛；本次视觉fixture不替代已存真实Host刷新证据，也不宣称200%/pseudo全部覆盖。


输入框fallback差异已修正：准备表单和批准预算field补用既有cs-field，与ys-field并存，继续使用官方Input，不增加CSS/token。360px截图确认输入填满可用宽度、主题背景和文字可读；6组宽度/语言视觉及键盘回归通过，证据 temp/integration-test-runs/ui-visual-2026-09-09T07-24-34-512Z-1133320/。surface门通过；批准预算的浏览器专项及200%/pseudo压力验收仍待，不扩大此次截图结论。


生成提交接线前置：现有EikonaReviewAdapter只执行采用候选，DiscoveryAdapter仍无生成descriptor。新增内部bindEikonaGeneration纯函数，将准备、预算批准、最新批准状态按project/preparationRef/digest/approvalRef/expiry绑定；revoked/expired/consumed拒绝，观察超过60秒或领先本地时钟超过5秒拒绝，须重新向owner只读查询。该客户端新鲜度仅为更严格的确认预览约束，不能替代owner执行时复核。当前Eikona SubmitGeneration admission仅接受canonical默认模型，绑定按该真实合同保守限制，不声称其他模型不存在。输出仅固定引用与单图owner请求，预算留在确认摘要；无prompt正文、无provider调用、无执行授权。11项绑定反例单测及Host typecheck通过。

后续必须接Host受信连接、独立generation mutation授权、server-authored descriptor、既有Gateway操作恢复与once-only approval，才可显示执行按钮；此纯函数尚未接dispatch，不能算真实生成闭环。


生成确认descriptor前置已实现：createEikonaGenerationDescriptor仅接受通过固定绑定校验的准备/批准/最新状态，生成既有PaneActionDescriptor；target固定preparationRef/digest，所有输入为单选固定值，approvalRef参与descriptor哈希，确认有效期不超过60秒或批准到期时间。预览明确1张、费用未知、预算上限USD、候选不自动采用/写回/交付，risk=high且confirmation=confirm。13项绑定/descriptor测试与Host typecheck通过。当前函数未装配到adapter.snapshot，尚未形成可执行UI，后续dispatch必须重新验证并使用原幂等键；不可把确认预览当owner执行授权。


生成Pane请求校验前置：共享eikonaGenerationValuesSchema和descriptor身份计算，解析标准PaneActionRequest，要求owner/action、完整11项context、target准备/digest、descriptor哈希与原幂等键匹配；严格拒绝额外参数和textBody，不接浏览器raw prompt。14项绑定/描述/请求测试通过，覆盖替换批准、模型、目标版本、会话/策略版本及非法幂等键。此解析器仅校验形状与绑定，客户端可计算哈希不构成授权；Gateway仍需校验实时server-authored descriptor，dispatch仍需当前owner批准复核。尚未接发送网络请求。


生成回执投影前置：inspectEikonaGenerationReceipt接受实际SubmitResponse或完整owner Receipt形状；完整回执固定generation contract/action，receipt_ref必须等于operation_ref，运行引用必须等于canonical adapter规则run_owner_sha256(operation_ref)前32位。succeeded无运行引用拒绝；running/unknown/partial等状态不投影为generationConfirmed。限制单运行、无子操作和额外payload，reconcile可固定原operationRef。16项反例/状态单测和Host typecheck通过。仍未装配HTTP generation submit，不能以此宣称已执行。实际服务验证需证明接收的SubmitResponse与canonical runstore相符；采用和交付仍是独立动作。


生成HTTP基础方法已接EikonaDiscoveryClient.submitGeneration，内部mutation联合保留旧review默认语义，generation分支要求新增可选Host admission.generationExecutionApproved=true；缺省拒绝，不从浏览器或准备/预算批准推导。仅允许严格单图固定body、confirmed=true与有界原幂等键，project:前缀归一后匹配Host单项目credential scope。复用loopback URL限制、私有headers、15秒超时、1MiB响应、禁止重定向及完成后连接/pin/header/scope复核；失败响应未知不重试。18项client测试及Host typecheck通过，含独立权限拒绝零网络、错项目拒绝、正确route/body/key、响应丢失一次调用、迟到权限变化未确认。尚未接generation adapter/snapshot/dispatch，未通过真实Go HTTP验证；不会自动启用执行权限。


生成对账HTTP方法已增加：reconcileGeneration只接受原idempotencyKey、Host scope匹配的projectId及可选原operationRef，调用既有owner operations/:key:reconcile空body路由；执行权限关闭不阻塞当前项目只读对账。必须返回完整generation contract/action Receipt，不能用缺合同的SubmitResponse或review receipt替代；再次校验canonical run及原operation引用。19项client+16项receipt测试和Host typecheck通过，涵盖关闭写权限仍可查询、跨项目零请求、错误action拒绝。尚未接generation adapter dispatch/reconcile与真实owner网络验收，不建立第二调度器或自动重提。


生成Pane回执投影已增加：仅generationConfirmed且有canonical run才completed，run只进evidenceRefs，不伪造成已采用outputArtifacts。partial保留独立partial状态，accepted/running/cancel_requested/unknown保持unknown及原操作对账原因；查询时失权不退化成新请求rejected。当前共享PaneActionReceipt无cancelled，临时以failed+明确owner确认取消文案保留事实；须后续增量合同或UI明确取消呈现验收，不能算取消完整闭环。10项映射与共享schema测试及Host typecheck通过，尚未装配generation adapter。


生成适配器组合已增加：withEikonaGeneration保留base其他动作，在可信Host selection返回approved投影时读取discovery、固定准备与最新批准状态，selection前后复核一致后追加标准生成descriptor。dispatch再次走相同解析与owner读取，再向submitGeneration传原key；选中批准变化拒绝。新增client.pin把准入读与提交锁定同一连接对象（含header/pin/scope），不暴露连接信息。reconcile不读当前selection，按原expectedTargetRef读取准备的owner项目、原key查询，且两次读也pin同一连接。读取失败不制造可执行descriptor。34项绑定/client测试及Host typecheck通过，其中adapter测试为mock client，不算真实owner执行证据。尚未导出并装配正式selection/registry，取消状态完整呈现及真实生成集成仍待。


组合入口已从Host包index增量导出withEikonaGeneration，README说明可信selection、独立执行准入及默认未装配，不启用任何外部调用。新增adapter恢复测试：selection直接抛错且无discovery时，reconcile仍仅调用readPreparation和原key查询；失配项目context拒绝，submit计数0。16项生成绑定/adapter测试、Host typecheck/build通过。测试使用mock client，不替代真实HTTP证据。默认registry及页面批准选择绑定仍待实施。


生成HTTP实际owner联调已补：沿用Eikona discovery集成runner，临时Go进程装配真实PreparationStore、OwnerService、CanonicalGenerationAdapter与runstore，仅图像provider替换为本地fixture（保留canonical模型请求，fixture Normalize映射测试模型）。测试delegation显式增加generation action与批准项目，只有隔离测试connection启用generationExecutionApproved。DSH client按固定批准submit→同key重复submit→原key reconcile，三者同operation/run；批准状态ConsumedOperation匹配。临时测试进程直接检查runstore：恰好1个run_owner目录、正确project、成功result、1个实际非空图片文件，不输出文件路径/正文。33项runner通过，证据 temp/integration-test-runs/eikona-discovery-20260909081642Z-1923844/。

证据分层：这是实际Go owner与本地provider替身、HTTP client的验证；不是收费模型、不是generation组合adapter穿过Gateway/浏览器的闭环。后续仍需正式selection、Host/owner项目映射与注册、Gateway确认、未知结果恢复和候选列表交接。


实际生成组合/Gateway联调：descriptor增量接受显式ownerProjectId（旧调用缺省保持原同ID行为），adapter只使用经受信连接读取且准备/批准/观察三方一致的owner项目ID；descriptor.context仍固定DSH原项目，不从浏览器提供映射。真实Go owner测试中DSH project:test与owner注册项目不同，组合snapshot产生descriptor。真实Cordis CreatorStudioGateway+OwnerDirectory读取并校验snapshot，dispatch复核descriptor/context后经组合adapter→HTTP→Go canonical runtime成功，runstore仍只1运行1图、同key重复及对账身份一致。33项runner通过 temp/integration-test-runs/eikona-discovery-20260909082448Z-2044436/。此Gateway实例尚未装operation recovery storage，且未经过浏览器确认；后续需正式批准selection装配与native完整生成路径。


生成Gateway恢复存储联调：生成专用Cordis Host装配真实storage-json/storage-domain，Gateway在提交前持久化原操作。测试在Go owner生成成功返回后读取完响应并模拟丢失，Gateway返回unknown，待核对列表保留原key；dispose整个Host后在同磁盘目录重建，读回原待核对记录，以原request调用Gateway.reconcile→组合adapter→owner恢复completed，并清理待核对列表。既有runstore核实仍恰好1运行1图，重复提交/对账引用一致。33项runner通过，证据 temp/integration-test-runs/eikona-discovery-20260909082958Z-2100053/。这是实际owner+本地provider替身、真实Host存储重建，不是浏览器生成确认或真实收费模型验收。


可信批准选择已封装为createEikonaStudioAdapter：组合既有候选选择/采用与生成适配器，仅记忆当前完整11项上下文内owner.approvePreparation返回的approved投影，最多64个上下文；新prepare/revoke立即失效，迟到approve不重新选择。该Map为临时UI选择，不是批准账本；刷新重建不从草稿提升权限，owner执行前继续复核。17项绑定/选择测试覆盖无批准无动作、成功后动作、跨会话隔离、新prepare后迟到批准拒绝。实际Go集成改经StudioAdapter批准，之后Gateway生成/响应丢失/存储恢复/单运行验证通过，33项证据 temp/integration-test-runs/eikona-discovery-20260909083559Z-2181875/。默认宿主配置入口与浏览器批准后刷新snapshot仍待接线。


批准成功后的动作刷新已接controller：只在严格匹配的approved结果后触发既有refresh，保持原snapshot等待新投影，不调用dispatch；未确认/失配批准不触发。31项controller测试（含成功刷新零dispatch）与client typecheck通过，33项实际owner/native浏览器回归通过 temp/integration-test-runs/eikona-discovery-20260909084210Z-2262839/。浏览器fixture仍使用旧review组合，不能将本轮回归视为浏览器生成确认完成；正式Studio适配器注册与页面完整生成仍待。


原生页面生成确认入口联调：createEikonaStudioAdapter增量可接existingBase（仅接受owner=eikona），保留既有候选/媒体adapter的Host凭据scope，同时生成准备与执行使用独立受信client；默认不传第三参数行为不变。native fixture现以Studio适配器包装真实review base，浏览器批准返回后controller刷新，页面显示“执行图像生成”确认动作；随后原批准撤销、恢复、候选采用流程继续通过。33项含browser证据 temp/integration-test-runs/eikona-discovery-20260909084856Z-2459608/。此次未点击生成执行，不得据此宣称浏览器生成闭环已完成；默认运行配置与浏览器执行/未知恢复仍待。


原生浏览器生成提交已验收本地provider替身路径：预算批准后Composer显示生成动作，用户勾选确认并点击执行，native Connection→HTTP Gateway→Studio adapter→Go owner canonical runtime返回completed；runstore从先前1run/1图增加至2run/2图，采用提交计数未变化。之后撤销/刷新恢复和独立候选采用仍通过。首次测试发现descriptor缺presentation.task=image，Composer不填默认模型导致必填禁用；已在生成descriptor增加领域标记，未改变共享Composer。增加生成后原identity recall计数从1改2（生成、采用各一次）。33项browser runner通过，证据 temp/integration-test-runs/eikona-discovery-20260909085854Z-2595891/；失败证据085303/085647保留。仍非真实收费模型和完整候选修改交付验收，默认宿主配置入口也待接线。


浏览器生成未知恢复验收：在原生确认执行时重新注入owner成功响应丢失，页面显示unknown，实际Gateway恢复列表保留action=eikona.generation.submit的原请求；用户在共享待核对区域点击查询，native reconcile恢复completed并清空列表，生成dispatch计数仍1次。runstore总量保持2run/2图（此前非浏览器1次＋浏览器1次），采用计数未增长；后续独立采用未知/失权/刷新恢复继续通过。33项runner证据 temp/integration-test-runs/eikona-discovery-20260909090350Z-2656304/。provider仍为本地替身；生成后候选资产绑定、默认配置与完整真实创作路径仍待。


生成回执候选读取入口已增加：ActionReceiptFeedback仅对generation submit且单个canonical run evidence展示EikonaRunCandidates，用户显式读取原run的review候选，核验共享schema/runId后展示标签与固定artifactRef；不自动读媒体、不选择或采用。Composer runtime增量可选readEikonaReview，旧消费者无此方法不受影响。18项组件/Composer回归与client typecheck通过。当前候选读取组件为fixture验证，真实新生成候选review可能仍缺assessment，需owner联调；选择/预览/比较操作后续复用已有组件，不把仅列表视作完整生成闭环。


无assessment新候选HTTP联调已通过：临时Go owner生成后由标准review handler+项目限定凭据读同runstore，不添加机器分析；DSH client.readReview校验正确项目/运行并读到1个固定artifactRef/digest。测试review路由与owner delegation路由使用各自既有权限中间件，不修改生产认证。33项runner证据 temp/integration-test-runs/eikona-discovery-20260909092337Z-3144566/，对应owner change eikona-generated-candidates-without-assessment-v1任务2。浏览器回执候选入口与实际新资产预览选择仍待。


浏览器新生成候选联调：native fixture在生成unknown→对账完成后，点击回执“读取本次生成候选”，经controller/Remote/Gateway→实际review HTTP返回新run_owner下1个固定资产ref，页面明确候选/采用/修改/交付分离；媒体读取数和采用数不增加。33项runner通过 temp/integration-test-runs/eikona-discovery-20260909092842Z-3298135/。fixture为旧project-a资产和owner新项目分别选择受信client，仅测试按run_owner前缀分流；这不是生产授权规则，生产须使用Host核验项目映射而非前缀推断权限。默认宿主映射、新候选预览选择/比较及真实模型验收仍待。


生成回执候选列表已复用selectEikonaCandidate：有固定artifactRef/contentDigest才显示选择按钮，显式点击单飞提交，返回selected必须匹配同ref/digest；选择成功后刷新现有owner动作，无自动采用或媒体读取。Composer runtime方法保持可选兼容。3项候选组件与16项Composer回归、client typecheck/surface门通过（首次新增测试误写按钮文案已修正）。真实新生成资产的选择仍需在正确owner项目client下联调；不能把旧project-a候选选择证据替代。


实际新生成候选选择验证：同owner项目StudioAdapter读取无assessment新候选，按artifactRef/contentDigest选择成功，snapshot出现目标匹配的candidate.adopt动作；重新读取owner review仍pending/decisionState=pending，选择不写采用决定。篡改digest返回unconfirmed。仅隔离测试connection显式启用reviewAdoptionApproved，默认权限不改变。33项runner通过 temp/integration-test-runs/eikona-discovery-20260909094224Z-3668973/。证据为实际Go owner+本地provider、Host adapter，浏览器新候选选择的统一项目路由与媒体/比较仍待。


无assessment新生成候选独立采用联调通过：重新选择固定ref/digest，按owner descriptor构造独立candidate.adopt请求和新幂等键，StudioAdapter→真实review owner记录accepted/version1；采用receiptRef与生成receiptRef不同，资产ref/digest不变，runstore仍1运行1图。33项证据 temp/integration-test-runs/eikona-discovery-20260909094542Z-3744866/。该步骤为Host adapter/HTTP而非浏览器新候选采用，图像provider为替身，不包含遮罩修改、批量及交付验收。

## 安装包一体化 adapter 导出

安装包增量导出 host 已有 `createEikonaStudioAdapter`，继续使用 `registerCreatorStudioOwner` 和核验后的连接 resolver，不新增配置或凭据存储。旧 discovery/review/selectable 导出保持兼容。注册不创建批准或执行，缺连接时保留无动作降级。此接线不能代替用户 profile 的实际连接验收。

## 批准失效后的动作刷新

controller 收到匹配的撤销回执，或显式查询得到 revoked/expired/consumed 的批准观察后，刷新 owner snapshot。此刷新只重读动作，不重复撤销、生成或恢复执行。迟到/不匹配/校验失败响应继续拒绝。Host 仍在 dispatch 时核验当前批准，UI 刷新不授予执行权限。

## 运行候选的比较入口

运行回执的候选列表在 owner 返回多个候选时复用 `EikonaImageComparison` 与既有双栏/滑动/透明度比较器。选择保留 ref+digest，不读取媒体；两项选择后单独确认读取。重新读取列表立即释放比较组件并清空本地比较选择，避免新旧观察混用。采用选择保持独立，比较不修改 owner 决定。UI 使用原 `cs-button vk-btn` 及中英文已有词条，未引入新主壳。当前生成准备合同仍限单图，批量 owner 与真实多候选运行验收未完成。

## 固定批次 Host 读取

EikonaDiscoveryClient.readBatchInput 接收 batchRef/digest，不接收浏览器项目或连接参数。先固定 Host 连接，按既有 owner project: ingress 规范构造批次项目引用，再通过原 bounded/鉴权 transport 只读预览；查询编码、严格 schema、返回身份及数量和 execution_authorized=false 校验均在 Host。连接变化/异常不继续读取。该方法尚未接 Gateway/Remote/Pane，也不生成运行批准或计划动作。

Gateway 增量增加 readEikonaBatchInput，adapter 方法为可选，缺失时 unavailable；输入只含batchRef/digest。返回后重验完整上下文、directory generation与adapter身份，再校验固定版本及严格概要schema。共享contracts导出对应query/result schema。批次projectRef由已核验的Host连接映射，不与DSH projectRef假定同名。Native remote codec和Pane未接入，当前无浏览器入口。

Native Remote 增量注册 creatorStudio.readEikonaBatchInput@1，bundle typert行沿用原共享JSON transport，客户端query/result使用Host共享严格schema。controller再次核验固定ref/digest与当前上下文，不刷新动作或dispatch。仅提供读取能力，Pane入口与真实原生HTTP联合验收仍待。

## 批次预览 UI Contract

Eikona configure 页对 owner.resources 中 kind=batch-input 的固定对象渲染预览；ref 为批次引用，version 为sha256摘要，不要求用户手填。复用 SurfaceSection、cs-button vk-btn、现有本地化与状态区。显式点击后经controller读取概要；失败或摘要替换显示恢复提示，不展示可执行状态。组件按完整上下文/ref/version重建，忽略卸载后结果。空列表不新增空白主壳；不显示尚未实现的执行按钮。

当前owner adapter尚未生产该资源列表，需要批次列表/选择投影接入才能形成真实可达页面。组件与既有页面回归只证明UI接线，不能代替此可达性验收。

Host listBatchInputs 复用原固定连接和有界传输，支持limit/cursor；拒绝跨项目条目、重复ref/digest、数量不符与原样返回的续页游标。列表只投影批次版本与数量，不创建动作或费用估算。当前还需列表Gateway/Remote与分页页面接入，不能只取首页后隐藏更多批次。

批次分页已增加listEikonaBatchInputs Gateway/Native Remote @1及controller。共享schema限制页大小、游标格式、数量和页内固定版本唯一性；Gateway/controller拒绝超出请求limit或原样返回的cursor，并沿用迟到上下文检查。下一步页面保留分页历史和失败重试，不能只投影首页掩盖剩余版本。

## 批次分页 UI Contract

configure 页新增已保存批次分区，复用SurfaceSection/Button和现有布局；显式加载每页20项，有上一页/下一页与原游标重试。失败保留当前页，权限或合同失效清除可见页。列表读取不自动预览或执行；对象ref/digest来自owner列表，逐项复用固定预览。上下文改变重建列表，卸载后忽略迟到结果。当前标题使用owner批次引用，后续owner可读名称仍需增量提供；不伪造名称。页面入口已接线，真实Native UI点击路径尚待验收。

Host readBatchPlan固定连接和项目读取owner重计划，严格校验schema、ref/digest、plan摘要、费用与缺项一致性。返回status表示读取是否确认，planStatus单独表示ready/blocked；executionAuthorized恒false。未知费用不带数字上限。尚未接Gateway/Remote/页面，不将该观察缓存为批准。

Gateway readEikonaBatchPlan与可选adapter方法接通，复用固定batch查询。共享EikonaBatchPlanResult严格区分读取status和planStatus，并校验费用、缺项和executionAuthorized=false；Gateway返回前重验上下文与adapter及ref/digest。实际Go owner→Host→Gateway路径已有证据；Native Remote、controller和计划UI继续待办。

重计划Native Remote @1和bundle注册及controller已接通，输入仍仅固定batchRef/digest，不接确认或预算。codec共用Host严格结果schema；controller复验上下文和固定版本，不因ready/blocked计划响应触发dispatch。计划UI和真实Native计划调用验收仍待。

## 批次计划 UI Contract

固定批次详情显示后，提供独立“检查运行计划”按钮。复用Button/状态区/双语，显示预计调用数、已知费用上限或明确未知、ready/blocked及请求级缺项代码。重新检查先清除旧计划观察，不用旧费用覆盖新失败；不提供尚未实现的批量执行按钮。查询固定ref/digest，组件按父级版本生命周期隔离。缺项的人类操作说明及ready→确认执行闭环仍待，不能仅靠代码列表判定专业页完成。

计划缺项显示六类owner代码的中英文处理说明，保留原代码用于核对：提示词不存在/版本变化/审阅未完成、模型能力、provider访问和费用未知。未知代码通用降级，不尝试执行owner返回的文本。此说明不是配置/审阅/费用授权按钮，也不代表这些owner操作已在Pane中完成；直接处理闭环仍待。

## 批量提交与对账 Host 传输

`EikonaDiscoveryClient.submitBatch/reconcileBatch` 复用既有有界响应、loopback 连接、单项目凭据约束与连接固定机制。提交需要独立且默认关闭的 `batchExecutionApproved`，不能继承单图执行或准备授权；输入固定 batchRef/digest/planDigest、原 idempotencyKey、明确 confirmed 与 allowUnknownCost。项目由 Host binding 决定，浏览器输入不能覆盖。对账仅向 owner 发送项目与原键，不要求 mutation 开关打开，不执行 submit/resume/retry。

响应严格核对项目、批次、计划、operation 格式、状态与 terminal 一致性及非负计数；额外字段和迟到的旧连接结果拒绝。安全投影状态 `observed` 仅代表观察到 owner 事实，不能作为候选采用或最终交付。传输错误保留 unconfirmed，不自动重试。新增九项传输反例及既有二十三项 client 测试通过，Host typecheck 通过；此处尚未接入标准动作描述、Composer、持久恢复记录和专业页面，也未获得 DSH 到真实 owner 的批量提交集成证据。

Host 到真实 Go HTTP 的两成员提交与响应丢失对账现已通过，证据 `temp/integration-test-runs/eikona-discovery-20260909131330Z-3128743`。测试在 owner 完成后丢弃 fetch 响应，Host 返回 unconfirmed；关闭批量 mutation admission 后仅凭原键读取，恢复同一成功 operation、一个 attempt、两个成员，错误 batch digest 被拒绝，提交计数始终为一。测试同时发现并推动修复 owner HTTP runstore 未绑定项目的问题，按 canonical 项目查得两个成员 run。此次未运行浏览器，标准动作/Composer/持久恢复和专业页面的批量执行仍未验收。

## 批量标准动作合同

`eikona-batch-action.ts` 增加标准 Pane descriptor、请求校验和 receipt 映射。描述只从 owner 的 ready 计划生成，核对 Host 指定的 owner 项目；target 固定 batch ref 与 plan digest，字段固定批次摘要、计划摘要及是否同意未知费用。批次 ref 留在 target，不受 select option 的 160 字符上限截断。预览显示成员数、预计调用数，费用未知时不输出数值 cost；已知零费用仍输出明确的 USD 0 估计。描述有效期为一分钟，派发 adapter 必须重新读取计划和 admission，不能仅凭描述创建时间或客户端字段执行。

请求拒绝正文、额外字段、不同会话或项目、target/plan/descriptor 不一致及无效原请求键。回执仅把 owner succeeded 映射为 completed，partial 保留部分结果并要求检查，未知或仍在运行保持可恢复；取消按既有 Pane 词汇显示 failed 并明确说明 owner 已取消，不表示成功产物。上述合同与传输共十八项 focused 测试通过。它们尚未装配到 adapter snapshot/dispatch/reconcile，不能视为标准动作或 UI 已交付；恢复还须保证无需当前选中计划即可读取原 operation。

批量 adapter 现已装配进 createEikonaStudioAdapter：显式读取 ready 计划只记录按完整 context 隔离的短期安全引用，最多保留 64 个 context；snapshot 和 dispatch 均重新固定连接、检查独立执行 admission 并读取当前计划，旧 descriptor 与变化后的 plan 不匹配时拒绝。并发读取以 entry 身份拒绝迟到结果，blocked 读取不会保留上一条可执行选择。计划读取不执行、不授予 owner 权限。

标准 reconcile 使用当前 Host 验证的项目与原请求键读取 owner operation，并复验目标 batch ref；无需当前选择、无需准备字段或重新计划，也不要求批量 mutation 开关打开。完整提交响应仍严格复验 batch digest 和 plan digest；恢复时以 owner 按 actor/project/key 找到的原 operation 作为不可变版本真源，不能用当前计划替代原计划。43 项 focused 与类型检查通过；真实 Go HTTP 标准 adapter 两成员 dispatch、响应丢失、重建 adapter 后对账通过，证据 `temp/integration-test-runs/eikona-discovery-20260909132428Z-3238812`。尚需客户端刷新动作快照、Composer 页面路径和 Host 持久恢复仓的批量验收；上述测试不代表浏览器或正式 profile 已通过。

客户端 readEikonaBatchPlan 现于每次合法查询结束后刷新 Host 动作快照，包括 ready、blocked、返回无效和响应丢失；Host 可能已清除或替换短期选择，不能保留旧动作。若已有快照读取，等待其完成再请求新快照，避免 refresh 合并吞掉这次动作更新；generation/context 已变化或 controller 已销毁则忽略。查询输入语法失败不发请求，不刷新、不派发。43 项 controller 测试及 client typecheck 通过，含三种计划结果、销毁迟到结果和旧快照并发覆盖。真实 Native 浏览器既有计划/翻页/生成/审阅路径回归通过 `temp/integration-test-runs/eikona-discovery-20260909132733Z-3279304`；该浏览器场景仍是 blocked 批次，不代表 ready 批次的 Composer 确认执行已验收。

批量持久恢复已在真实 Cordis Gateway、JSON storage/domain 和 Go HTTP fixture 上验收，复用原 operation recovery store，没有新增批量恢复仓。通过 Gateway 提交后丢弃 owner 响应，unknown 记录保留原 key、目标批次和 plan targetVersion，不保存 values；同一目标换新 key 提交被 Gateway 阻止。销毁 Host 后从相同存储目录重建，未选择计划且 batch mutation 关闭时仍列出原请求；403 对账保留记录，随后只读对账 confirmed completed 才移除。实际 submit 计数为一、项目内成员 run 数为二。证据 `temp/integration-test-runs/eikona-discovery-20260909133026Z-3345660`。此处覆盖 Host 重建与读取失权，不代表浏览器 ready 批次确认、进程断电或真实 provider 收费验收。

可运行批次的 Native 浏览器路径已通过：在测试 owner 创建固定两成员 fixture 批次，浏览器从已保存批次分页进入详情、检查运行计划，Host 动作刷新后共享 Composer 显示“执行图像批量计划”。执行按钮在确认前禁用，勾选确认本身不提交，点击执行后获得 eikona.batch.submit completed 回执；刷新页面不会重发，owner 端提交计数保持一。此路径沿用实际 Native Remote、Gateway、studio adapter 与 Go HTTP，不增加浏览器直连执行接口。证据 `temp/integration-test-runs/eikona-discovery-20260909133250Z-3385283`，完成态截图 `artifacts/eikona-native-batch-completed.png` 已检查。测试 fixture 将各区域纵向放置，截图不代表正式生成台页面密度验收；回执摘要仍含英文，批量候选查看、继续修改、部分失败处理、取消及正式 profile 仍有任务，不能宣布整个批量专业闭环完成。

成员读取已接入 Host client、studio adapter 和 Gateway.readEikonaBatchMembers。Host 按固定连接绑定 owner 项目，只向 owner 请求 operation/offset/limit；strict schema 拒绝附加字段、错误 operation、非连续页、重复 request、非法 run 引用和不支持状态。安全结果包含原 batch/plan digest，供客户端跨页固定身份；unknown 无 run_ref 仍显示为待核对，不能制造失败或重试权限。Gateway 再次验证当前 context、adapter generation 和请求分页匹配。实际 Go HTTP 两页成员经 Gateway 验证成功，证据 `temp/integration-test-runs/eikona-discovery-20260909134456Z-3516928`；Host 类型检查通过。Native Remote/bundle、客户端成员列表与候选组件接线尚待，不能将此 Host 证据描述为浏览器候选验收。

成员 Native Remote `creatorStudio.readEikonaBatchMembers@1`、bundle 注册和 controller 已接通共享 query/result schema。参数只有 operationRef、offset、limit，默认页大小 50、最大 100，拒绝 projectRef 或 confirmed；controller 复验 operation/offset/页长度，并沿用 generation/context 迟到保护。查询不派发、不刷新动作、不自动翻页，后续成员列表需固定第一页面的 batch/plan 身份。client 54 项 focused、bundle 15 项及两包 typecheck 通过，Host build 通过。尚未加入成员列表组件或在真实 Native Remote 上读取成员，现有测试范围不能替代该验收。

## 批量成员列表 UI Contract

- Surface classification: adopted；嵌入既有执行回执，不新增 Pane 主壳。
- Surface kind: workspace。
- First / second / third visual priority: 成员结果与状态／明确读取候选／分页和读取恢复。
- Existing components reused: SurfaceSection、Button、ys-list、EikonaRunCandidates、既有图片比较、预览与候选选择。
- Cards that earn existence: 仅既有执行回执；成员为列表行，不为每项增加卡片。
- Primary scroll owner: 专业 Pane 原内容滚动区，无嵌套滚动区。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 成员分页 | 禁用读取及翻页并显示读取状态 | 显示无批次内容 | 保留当前页，原 offset 重试；失权清除可访问内容 | 明确请求才读，每页20项 | 固定项目/operation/batch/digest/plan/total；错配拒绝替换当前页 | 没有传输能力时不挂载入口 |
| 成员候选 | 复用候选组件 | 无可读run显示原因 | 复用候选读取失败 | 用户主动读取后比较或选择 | unknown不自动重试，成功不自动采用 | 没有run引用不创建候选按钮 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单列换行，引用可折行，原分页按钮可见 | 同一列表与动作，媒体复用现有布局 | 保持同一数据与动作，不增加侧壳 |

### Accessibility

- Keyboard path: 读取、上一页/下一页、重试、成员内读取候选和比较/选择，均为原生Button。
- Focus owner/return: 使用宿主与按钮原生焦点，不新增弹窗或focus trap。
- Visible labels and accessible names: 中英成员标题、状态与动作；状态区使用role=status。
- Reduced motion and coarse pointer: 无新增动画；操作不依赖hover。

### Visual Exceptions

无。成员列表使用固定批次执行事实，首次只读不自动加载候选和媒体；页间版本错误保留当前结果，重试不自动派发。组件与Composer共17项focused、client typecheck、surface/plugin检查通过；既有六项页面视觉回归证据 `temp/integration-test-runs/ui-visual-2026-09-09T13-53-22-950Z-3603072`。现有视觉夹具未挂载成员列表，真实Native成员及候选读取、专属窄屏/键盘/200%验收仍待，不把回归通过当作新增页面验收。

真实 Native 成员路径已补齐：批量完成回执中通过键盘 Enter 读取成员，RPC 计数增加一次但候选读取数不变；随后 Enter 打开首成员候选，真实 Go review 返回非空版本摘要。测试校验仅一次批量提交，360/560/960宽度与CSS 200%放大无横向溢出，中英动作可见。截图检查发现原 ys-row 多列将英文按钮与引用挤成竖排，因此为复用 EikonaRunCandidates 增加限定作用域的纵向行布局，并加入英文候选按钮高度小于100px断言。修复后截图已人工检查，证据 `temp/integration-test-runs/eikona-discovery-20260909135907Z-3684608/artifacts/eikona-native-batch-members-en.png`；整条Native集成通过。一次既有重连步骤10秒超时后原测试重跑通过，失败证据保留在 `eikona-discovery-20260909135759Z-3668832`。surface/plugin及既有六项视觉回归通过 `temp/integration-test-runs/ui-visual-2026-09-09T13-58-14-257Z-3675621`。此处证明成员与候选读取，尚未证明批量候选媒体预览、选中后采用、跨成员比较或继续修改；CSS放大也不替代完整浏览器原生缩放/屏幕阅读器验收。

批量候选媒体读取已通过真实 Native 路径：从首成员的实际 artifact_001 候选打开预览提示，readEikonaCandidateImage 计数不增加；明确确认后经原 Host 媒体授权入口读取一次，浏览器 img 完成解码且 naturalWidth 大于零。候选引用由 owner review 返回，批量执行提交计数保持一。证据 `temp/integration-test-runs/eikona-discovery-20260909140113Z-3710504`，包含此前成员读取、键盘、中英及宽度回归。测试 fixture 的历史项目与新生成项目仍由测试 adapter 分别路由，不代表正式 profile 配置已验证。候选选择/采用跨完整正确项目、继续修改及跨成员比较仍待；媒体可见不授予采用或交付权限。

跨成员比较复用现有 EikonaImageComparison：批量结果区保存最多两项固定候选ref/digest，EikonaRunCandidates通过可选batchComparison消费同一选择，即使一个成员只有一个候选也可选入。选择跨分页保留，失权清除，用户可明确清空；重新读取候选不静默替换已选版本。没有批量比较宿主时仍保持原单运行比较行为。仅确认比较后读取两张图片，不自动采用或执行。八项成员/候选focused及client typecheck、surface/plugin检查通过；真实Native跨成员媒体对比仍待。视觉回归曾因夹具缺少ui-structured-content模块映射导致页面未加载，补充现有模块vendor/import map并恢复本地构建产物后，六项回归通过 `temp/integration-test-runs/ui-visual-2026-09-09T14-09-27-015Z-3812714`。该回归不替代新增跨成员比较的浏览器验收。

## 用户停止与视觉否决

用户明确要求快速保存进度后停止，并表示对图片渲染对比非常不满意。停止记录见 `docs/design/dsh-creative-stop-handoff-2026-09-09.md`。最后跨成员真实Native测试证据为 `temp/integration-test-runs/eikona-discovery-20260909141116Z-3830327`，只证明固定引用、两次媒体读取及模式切换不重复请求；不证明图片质量和视觉体验获接受。此前“截图已检查”不能视为用户视觉验收。5.2/5.3/5.4与完整路径继续未完成；不得以本次技术通过关闭这些任务。等待用户明确恢复指令，停止自主实现和测试。
