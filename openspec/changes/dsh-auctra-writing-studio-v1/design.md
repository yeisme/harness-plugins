## Context

依据 2026-09-07 创作台程序。Auctra Service API 与 text working copy（正文授权读取、候选、版本链）是消费真源。

## Goals / Non-Goals

目标：在 DSH Pane 内完成「打开文本项目 → 授权读取正文 → 编辑/Agent 候选 → 比较采纳 → 保存/冲突恢复」的一条真实路径。

不做第二正文存储，不绕过 owner 确认覆盖新版本，不把插件草稿当 owner candidate；自动保存复用已有确认与 CAS 合同。

## Decisions

1. Owner-fit：split-owner。Auctra 拥有正文、版本链、Canon 与保存回执；DSH 插件拥有 Pane 呈现与编辑入口。
2. 正文读取显式授权：内容与控制面摘要分离；未授权类型不渲染正文区，显示原因。
3. Agent 修改正文一律经 owner candidate（程序 §4）：变更摘要、可撤销，不修改已采纳版本。
4. 版本冲突保留编辑输入与候选，提供重新读取/比较/另存草案；不覆盖新版本。
5. 保存=owner receipt 确认；HTTP 成功或浏览器 pending 不改保存态。Checkpoint/Review/Canon/交付是独立动作。
6. 各文本类型（小说/剧本等）结构映射在 adapter normalizer，不建万能表单。

## UI Contract

Host读取路径增量：explicit-open客户端只接受可信连接解析器提供的完整scope、私有项目binding与已批准的DSH schema digest；缺省needs_contract，不从浏览器值或旧Workbench状态生成准入。固定major=1、loopback、禁重定向和有界读取；响应再经正文normalizer。它不建立审批权威或改变owner默认状态，实际消费准入与canary仍需完成。

正文适配增量：复用owner explicit open。Host normalizer先匹配私有project binding与typed openRef，再校验UTF-8字节长度/SHA-256；UTF-16 patch offset与字节长度不得混淆。screenplay draft的working_copy_ref与其bare unit_ref分别处理，投影引用使用不含原路径的项目命名空间避免跨项目碰撞。该函数只做已授权数据映射，不能绕过owner/readiness gate；授权与HTTP消费仍需独立实现和验收。

- Surface classification: adopted（ui-surface；画布节点内嵌文本摘录用 ui-visual-kit）
- Surface kind: workspace（文本主 Pane）+ inspector（结构/版本详情）
- First / second / third visual priority: 当前正文与版本 / 主要编辑动作 / 结构与来源
- Existing components reused: ui-visual-kit token、既有候选比较、diff 组件、官方 primitives
- Cards that earn existence: 候选/diff 卡；无统计卡片墙
- Primary scroll owner: 正文；结构与版本面板独立滚动

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 文本项目/结构 | 保留最后内容 | 解释空项目 | owner 原因 | 结构+freshness | 标明缺失 | 权限原因 |
| 正文读取 | 加载授权范围 | 无授权说明 | 读取错误 | 授权正文 | stale 标注 | 未授权禁用并解释 |
| 候选/保存 | 预检中 | 无候选说明 | owner 错误 | receipt 摘要 | 版本冲突保留输入 | 未确认禁用 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单栏+返回 | 导航/内容切换 | 正文+结构并列 |

### Accessibility

- Keyboard path: 结构→正文→候选→保存全程键盘；Escape 回发起位置
- Focus owner/return: 正文光标位置或结构行
- Visible labels and accessible names: 版本/冲突/保存态文本化
- Reduced motion and coarse pointer: 动画可关；触控 ≥44px

## Validation

focused adapter/组件测试先行；稳定后全门禁。真实写作闭环在 Auctra staging 验证并标注 fixture/real。证据写 `temp/integration-test-runs/<run-id>/`，不记录正文内容与原始 prompt。

## 页面、控件与验收补全

[完整页面设计](../../../docs/design/dsh-auctra-writing-studio.md)是本change的UI细化，和本design共同约束实施。所有页面均为required；复用既有artifact-workspace编辑/Diff/候选能力，不另造autosave服务。正文和结构联合变更遵循owner atomic change-set。UTF-16 patch按owner合同处理emoji/IME，不按视觉字数猜offset。插件草稿权限不授权Agent直接覆盖领域正文。

| 工作页 | 控件与动作 | 关键行为 |
|---|---|---|
| 结构与正文 | 小说章节、剧本场景、通用文本单元、正文编辑与结构动作 | Working Copy通过owner读写，浏览器仅有active edit buffer |
| Agent与候选 | 选区引用、候选、文本Diff、比较与采用 | Agent变更进入candidate，base revision/digest必须核对 |
| 版本与审阅 | Working Copy、Checkpoint、Review、Canon和历史 | 各动作独立；采用候选不自动创建检查点或晋级 |
| 导出与交接 | 固定文本版本、格式、用途与导出预览 | 按选定版本导出，源文件写回是另一动作 |

完整路径：打开小说/剧本/文本→编辑并确认保存→选区交给Agent→比较并采用candidate→Checkpoint/Review→固定版本导出。重点恢复：IME/emoji、并发编辑、candidate base过期、autosave失败、atomic change-set失败、采用不晋级Canon。第4组质量/真实验收依赖新增5.1–5.4，不能只交付列表和通用descriptor便关闭。

### UI Contract补全

- 内容主体是主要滚动owner，参数/证据独立滚动；不劫持Composer滚轮或IME。
- 复用CreatorActionComposer、artifact-workspace、ui-surface/visual-kit、官方Button/Input/Menu/Modal/DiffBlock与rich-media；不新建私有atoms。
- 图形/媒体选择必须有列表或菜单等价操作；新结果不抢焦点，关闭对话框回到触发控件。
- 视觉例外：无；不复制Workbench CSS，不增加第二主壳或万能领域表单系统。

## 依赖与回滚补全

本领域直接操作只依赖DSH host与`cli/auctra`；画布回填、跨领域编排按能力单独接入，不阻塞独立页面。已确认缺口在owner创建最小配套change，而不是在插件中实现领域状态。任务5.1必须留下负责方/操作/所需交付物/受影响任务/双向链接。

默认additive演进；旧kind、方法和closed schema保持兼容。新接口schema由CLI/owner生成，未知critical版本拒绝。禁用本Pane不删除草稿、资源或运行；原operation仍通过原owner查询/对账。采用candidate不自动写源文件、晋级Canon或发布。
# Working Copy 显式读取接入

短期pending候选增加完整Creator context绑定。snapshot仅在成果/version与context均匹配时发布该候选的采用/撤销动作；其他context的snapshot不能清除原绑定。dispatch也校验pending context，不能仅凭相同ref/version复用另一会话的候选。owner历史列表按当前身份独立授权；此约束不禁止合法共享项目读取，也不把内存pending提升为持久权威。

adapter 每次项目snapshot在独立列表准入可用时读取owner候选首页（最多50），与当前新建候选去重后投影；无内存pending的新adapter也能恢复历史候选元数据。候选内容通过当前项目/副本前缀与owner固定版本读取验证，不把pending当作正文授权。更多页明确显示未接通分页控件；当前采用动作仍按原内存候选绑定，历史任意候选采用与完整分页必须继续实施，不能把恢复首页宣称全量交付。

候选历史客户端 listCandidates 以独立 candidateListDigest 准入，绑定私有项目摘要和副本；默认50/最多100，游标限制长度与URL安全字符并按原值续页。normalizer拒绝超请求条数、重复候选、错误副本、正文泄漏及无效cursor；返回仅候选元数据和可选nextCursor。列表准入不自动授予正文或写入权限。该能力尚未替代adapter内存pending，分页UI/恢复要消费owner列表而非重建插件候选账本。

候选采用的并发拒绝验收：创建候选后由另一路真实owner保存推进head，再从仍显示旧base的浏览器点击采用。必须保留较新owner正文与版本，保留本地未保存候选输入，不生成checkpoint/review/version。拒绝后重新生成候选仍需明确读取与确认新base，不能自动把原候选绑定到最新head。

候选采用的浏览器联合验证检查实际owner正文和计数：采用仅推进Working Copy，ContentVersion、ReviewItem和checkpoint快照数量保持不变；本地未保存草稿不因采用回执自动清除。计数验证由一次性fixture helper的认证只读诊断提供，不作为产品API或浏览器权限。正式审阅和交付仍分别执行。

文本比较现在优先消费按context/ref/version隔离的显式正文缓存；候选有ArtifactRef时，原文与候选任一读取不可用便显示不可比较，不把摘要冒充全文。旧无候选ArtifactRef的摘要比较保持兼容。比较只使用owner已确认正文，不把当前未保存输入当作原版本。实际浏览器创建候选后仍保留源草稿，比较不执行采用。

工作区候选 ArtifactRef 现在使用与显式内容 normalizer 一致的项目/副本/候选命名空间，MIME 为 text/plain，不继承来源正文的操作 capability。adapter 只对当前 pending 候选的精确 ref/version 路由 readCandidateContent，读取后重查 selection 与 pending 身份；不缓存正文到 snapshot。读取准入缺失或选择/候选改变时拒绝。当前 pending 仍是短期投影，历史候选列表、恢复与浏览器 Diff/采用验收继续开放。

候选内容客户端 readCandidateContent 使用独立可选 admission.candidateContentDigest，匹配 owner 新增内容合同后才 GET；不由 writeApproved 或旧读取准入推断权限。私有项目绑定摘要、副本、候选、base revision/result digest、正文 UTF-8 长度及 SHA256 全部匹配后才生成 Auctra 候选安全引用（实际前缀 `auctra:candidate:`）。读取不改变工作副本或选择；当前正文仍受共享编辑器256 Ki字符上限，大文档不截断。此函数尚未接到工作区候选 ArtifactRef 与 Diff 入口。

未知保存的交互：生命周期 pending 通过 `executionBlocked` 禁止再次执行，按钮和提交入口使用同一判断；对账按钮不因此禁用。结果未知时编辑器保留输入，按原请求键向 owner 对账，已提交正文与对账期间新增草稿分开确认。此行为已在真实浏览器→Gateway→Auctra 路径验证，仍需正式 Host 的原键持久化才能支持关闭/重启恢复。

联合验证入口为 `node scripts/run-auctra-owner-http-integration.mjs --browser`：沿用一次性 Auctra HTTP/app/storage helper、Creator directory/Gateway 与真实 React 编辑器；Playwright 暴露的 scope 固定测试桥仅替代 DSH Host RPC 和项目选择更新，不把凭据或私有路径送入浏览器。浏览器连续保存两次，均以 owner 回执及显式重读确认；首次确认后测试 Host 更新选中版本，再验证后续操作可用。端口已占用时失败，不终止其他服务；退出关闭本次浏览器、服务和临时项目。该验收证明通用文本保存路径，不能代替正式 bundle/profile、小说/剧本、候选/Canon、大文档或重启恢复验收。

返回同一项目时，即使完整 context 值恢复相同，也属于新的编辑器访问。访问标识只在本地 React 生命周期内存在，不进入 owner 协议或持久化。异步正文读取、保存确认和生命周期提交/结算须匹配本次访问；切换时清除旧读取占位，旧请求完成时仅删除自己对应的占位。由此避免 A→B→A 后旧确认与重置的计数碰撞，将新正文回退为旧内容。该不变量已用先失败后修复的保存回归及悬挂读取回归验证，不代表草稿持久化已经实现。

项目切换时移除旧项目的生命周期 UI 锁与动作面板，owner 操作不取消；保存确认同时匹配调用时 context epoch、pending 原 context epoch 和当前 context epoch。即使两个项目使用相同成果 ref 与 descriptorRef，旧回执也不能消费新项目的 pending 保存或触发新项目正文重读。此变更解决界面串态，不宣称跨项目未保存草稿、原幂等键或关闭/重启恢复已持久化；这些仍需项目存储合同和真实恢复路径验收。

共享编辑器的候选完成语义已修正：只有 saveDraft 完成才进入正文持久化确认；createCandidate 完成保留源草稿和未保存保护，不重读源正文以冒充保存。复用既有 Surface、状态提示、编辑器和动作控件，无布局/token/locale 变动；验证采用组件状态测试及现有 workspace/creator 360/560/960px 视觉基线。该修正不代表候选已采用或已晋级 Canon。

不可变版本保存后的本地编辑续接已实现：按唯一匹配 owner/ref/kind/MIME 的 outputArtifact 重读新版本，校验返回版本、正文、作用域与确认代次后写入新版本缓存；保存期间新增编辑迁移到新版本草稿，已有目标草稿冲突时两份内容都保留。旧缓存不覆盖，旧动作/来源证明不用于新版本。此处只推进编辑视图，不修改 Canon 或领域采用事实；等待 owner 新投影提供匹配动作后才继续保存。

保存动作接入：Host 选择可显式提供 `canSave`，但 adapter 必须再通过 owner 的无正文 status GET，确认相同固定版本、可变状态和 `apply` 能力以及 writeApproved，才发布 `working-copy.save` / `saveDraft`。dispatch 重新校验 context、descriptor、目标版本、base 内容与当前选择后调用客户端；成功回执携带新 ArtifactRef，不改写旧选中版本。显式读取新版本仍通过 owner 版本校验。可选 Host `resolveOriginal` 按安全成果引用解析原 owner 对象，使关闭选中对象后仍能原键对账，不创建插件任务账本。

当前动作协议 `actionValueChars` 为 16,384，adapter 沿用该限制并在 preview 说明，超限零 PUT。大文档是 required 能力，不据此缩减验收：1.2/2.5/5.1 需补版本化正文传输合同，保持现有确认、准入、digest 与幂等绑定；不得静默提高旧 wire 合同或截断正文。

`confirmPersistedBody` 已使用保存回执中的新版本；含糊/错引用回执和返回版本不符时保留原草稿。旧的无 outputArtifacts 可变引用合同保持兼容。组件与中英文三宽度浏览器 fixture 已验证续接；真实 Auctra 浏览器联合路径、完整 IME、关闭/重启恢复仍归 2.5/5.3/5.4。候选生成不触发源正文保存确认。

Host 客户端现在提供通用 Working Copy `save` 与 `reconcileSave`。保存接收固定 base 内容/ArtifactRef，核对正文 SHA256、revision、UTF-16 范围、Unicode 与编辑器上限，调用既有 owner PUT；对账只发送原幂等键，不重交 patch。`writeApproved` 是现有 DSH Host admission 的可选增量字段，默认不启用，不能由浏览器或旧 Workbench 开关提供。对账沿用 owner reconcile 的权限语义：它可能恢复 owner 的 conflict 状态，因此不标为纯只读。

写入前核对 ArtifactRef 内项目摘要与当前私有 owner 绑定，写入后若绑定或准入变化则返回 unconfirmed。只将匹配 owner envelope 的 409 working_copy_conflict / 422 idempotency_conflict 标为 conflict；其他未知响应不得触发自动重试。成功必须核对原提交版本、结果 digest 与字节长度。剧本兼容引用仍拒绝通用 PUT，继续留给 text.draft.save adapter。

客户端方法、Gateway saveDraft 动作与共享编辑器的新版本确认均已分层实现。实际 Host 的项目选择更新/动作刷新与真实 owner 浏览器联合验收仍未完成；编辑草稿只在对应 owner 回执及显式重读确认后处理。

写入回执消费使用 `normalizeAuctraWorkingCopyReceipt`：校验原副本身份、digest、字节长度、revision/journal 一致性及 applied/replayed/no-op 互斥，剥离私有元数据。reconcile 必须具备 integrity_verified 和绑定同副本的 last_receipt；顶层当前版本可以更高，但不替代原操作结果。未知或混合版本回执不能触发采用、写回确认或自动重试。该 helper 不拥有授权，也不改变画布/编辑器选择。

Host `createAuctraWorkingCopyAdapter` 消费已授权显式打开产生的选中引用；选择解析属于 Host 项目绑定，不接受浏览器文件路径。快照只投影固定版本 ArtifactRef，freshness 保持 unknown，工作区标为 partial，不自动读取正文、提供写入动作或宣称 Canon。共享工作区的 `acceptedVersion` 在这个读取切片仅表示当前固定的显示版本，不代表领域审阅或正式版本晋级。

正文使用既有 `readArtifactContent` 入口，重新调用 owner 并核对选中对象、版本、MIME 和返回引用；读取结束后重新检查选择仍然有效。沿用当前 256 Ki 字符编辑器上限，超限返回不可读，不截断。完整大文档体验仍属待办。

共享 Gateway 在异步读取完成后检查完整 context、directory generation 和选定 adapter；项目、权限或 adapter 变化使迟到正文失效。该规则同样保护其他专业 Pane。
# 历史候选选择与采用动作

采用/撤销 descriptor 绑定当前 Working Copy 引用与固定版本，不绑定候选列表第一项。共享候选选择器通过既有 `candidate_ref`、`candidate_version`、`source_version` 三个字段提交当前选择；Host 拒绝多余字段、错误上下文、目标及源版本，再经 owner 查询候选身份、状态和版本。owner 最终执行仍校验基线，不能因为列表中曾出现某候选而跳过校验。旧 descriptor 不再匹配时拒绝并刷新投影，不把旧请求重新解释为新动作。

存在与当前源版本一致的 ready 候选且 owner 明确可写时，才发布采用动作；过期候选保留比较价值，但不能用于覆盖新 Working Copy。重建 adapter 后从 owner 查询历史候选，不依赖当前进程的 pending 缓存。历史分页 UI 与未知采用结果的持久对账仍需后续任务验收。
# 候选分页增量合同

本增量新增 `creatorStudio.readCandidatePage@1`、query/page 两个 alpha schema 与可选 adapter/runtime 方法；已有快照和正文读取方法保持原状。分类为 additive，breaking_surfaces 为空，无废弃窗口或数据迁移。旧 adapter 默认 unavailable；回滚撤除分页注册及消费即可，owner 数据不变。

每次请求包含精确 ArtifactRef、limit（1–100）和可选游标。Host 从可信上下文选择 adapter，并在 await 后复核目录实例、generation、adapter 和当前上下文；Auctra adapter 再复核当前选择的 unit/ref/version，继续使用独立列表 admission。返回元数据禁止正文、重复候选及无界数组，候选正文仍走既有显式读取。客户端 Remote/controller 复核 schema、引用版本、页大小与提交上下文，旧服务缺方法时诚实 unavailable。

UI 后续以当前选定项目/引用/版本为页状态边界，保留同域上页、提供加载/失败/刷新入口；不静默累积无限历史，不在失败时清除已显示内容。未接入控件前，不能因 Host/客户端合同通过而勾选完整分页任务。
# 候选分页 UI Contract 补充

复用 [统一面板视觉系统](../../../docs/design/dsh-unified-panel-visual-system.md) 与现有比较区，在候选选择器上方放置「加载历史 / 刷新首页」「下一页」和当前页条数；无独立主壳、弹窗或新配色。按钮使用官方 Button 和 `vk-btn`，状态通过 `role=status` 报读，中英文案进入现有 locale。Host 仅在独立 owner 列表准入通过时，在既有开放能力集合加入 `candidate.history.read`；旧消费者忽略此能力，未准入不显示分页入口。

点击加载后读取 50 项，成功才替换当前候选列表；后续页不无限追加。失败保留当前页及当前选择，可显式重试下一页或刷新首页，不自动请求。请求中禁用翻页，重复点击不重复请求；采用等动作未决时锁住分页，避免替换该动作的候选上下文。刷新页面、切换 artifact/version/context 均创建新分页组件；卸载后的结果丢弃，页状态只保存安全元数据。

当前页无后续游标时禁用下一页；空页以既有无候选态显示；源正文与候选正文仍经显式读取，不进入分页回包。翻页成功清除旧动作配置，用户重新选择候选后才配置采用。采用动作绑定 Working Copy，owner 每次复核所选候选，不能因首页没有当前基线候选而阻塞后续页的合法采用。

验证分层：组件测试覆盖失败保留、明确重试、重复点击、卸载；实际 owner 浏览器测试创建超过 50 个候选，覆盖第二页、一次模拟换页故障、手动重试、比较与采用；固定版本编辑器视觉回归继续覆盖中英 360/560/960。分页本身窄宽与完整键盘走查仍需专项补齐，不能用其他控件视觉测试替代。
## 采用原请求键与未知结果恢复

DSH 将原 PaneActionRequest.idempotencyKey 原样交给 Auctra `request_key`，可信 Host binding 需单独声明 `candidateRequestRecovery: v1alpha1`；旧普通写入准入不隐式启用该能力。未准入不发布采用绑定，直接调用带键 client 也在 I/O 前拒绝。此字段为可选增量，旧 client 的无键调用保留；回滚关闭新准入即可，不迁移 owner 正文。

unknown 采用仍锁住执行按钮。reconcile 仅携带原请求键与原目标引用，由 owner 持久映射查询原回执；重建 adapter 不需要本地 pending map，不通过候选状态/当前正文 digest 合成成功。已有原来源 resolver 可在选择变化后解析安全原引用；无法解析时保持 unknown。返回 receipt.actionId 保持采用语义，采用不会被误标为保存或 Canon。

验证覆盖独立准入零请求、提交后撤销准入无法确认、原请求键发送、较新正文下返回原版本；实际浏览器丢弃采用响应，在原执行仍锁住时 dispose/register 新 adapter，再点击「核对原操作」，采用 POST 计数保持一次，正文及未保存输入保留，正式版本/审阅/检查点计数不变。浏览器本身关闭后的未决请求持久恢复仍另验。
# 大文档保存的兼容传输增量

分类：additive，沿用实验性 Pane v1alpha1。普通 `values` 字符串仍限 16,384 字符。动作描述可选声明 `textBody`（字段名、最大 UTF-8 字节数）；新客户端只在该描述允许且正文超过普通限制时发送独立 `textBody`，不与同名 value 混用。最大 2 MiB，拒绝不合法 Unicode、越界、未知字段、重复正文和未准入动作。

Host 按当前描述重新校验上下文、目标版本与正文限额，保存继续消费同一原请求键与原回执。正文不进入操作身份持久化或回执。Auctra 通用保存和剧本 `text.draft.save` 继续保持独立 owner 路由；候选采用与正式版本晋级不变。旧请求不变；缺扩展支持时保留输入并显式禁用超限保存。回滚可撤下描述中的扩展，旧短正文路径继续使用，不迁移持久数据。
