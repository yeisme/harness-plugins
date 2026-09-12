# 搜索中心 v2 实施基线与推进记录

2026-09-11 用户要求建立 Goal 并推进 spec 任务，实施阶段已开始。目标是完成本 change 的27项任务与16个场景验收；不能以分类占位、接口声明或fixture通过代替真实owner接入。

## 工作范围与顺序

当前为 `current-checkout`，由当前任务直接完成，不启动子agent。首批写入范围是 `packages/client/ui-pane-workbench` 的搜索源码、直接测试与既有证据入口，以及本 change 和任务管理脚本。首批共享只读范围包括host目录、Tools、Creator Studio、Explorer和Ordo合同；进入逐owner目录阶段后，写入范围扩展到 `ui-mcp-inspector` 的搜索适配、原详情导航及相关验证。进入已授权的Skill正文接入后，进一步包含host `dsh-tool-hub` 的独立只读Reader、Gateway登记和直接验证；不改动其已有目录业务修改。其他已有修改、Skills配置、真实会话／凭据／领域数据与远端发布不属于写入范围。

执行顺序为来源基线和兼容 → 现有来源的搜索中心／浮层 → 逐owner目录元数据 → 明确合同的正文搜索 → 稳定后的完整验证。只有证据支持的任务通过脚本勾选。脚本初始化默认不覆盖进度，完成命令需要本项目内已通过的run summary。

## 35类资源的实际消费合同盘点

本表记录已检查的消费路径，不声称远端部署已提供相同能力。具体运行时是否available必须在接入时probe。字段未列出即不承诺；排序／时间筛选／全文／分页不能从一个list/read接口推断。

| 二级资源 | 已检查来源与字段 | 范围／筛选／完整性 | 打开／预览 | v2状态 |
|---|---|---|---|---|
| `session` | `conversation-search-host.ts`：快照ID、displayTitle、updatedAt | profile元数据、query、limit/cursor；新增显式sessionRef过滤；拒绝未知workspace范围 | 真实sessions.open；标题摘要，不提供正文锚点 | legacy适配可用，范围测试通过 |
| `message-hit`、`archived-session` | `dsh-session-manager/src/adapter.ts`：sessionPersistence/sessionQuery/workspaceRegistry元数据；现有desktop global-search按标题／标签／workspace过滤 | 相邻元数据入口不证明正文搜索或消息锚点；归档集合归workspaceRegistry | 原SessionManager／history owner；不得读raw日志自行全文索引 | 正文与归档搜索适配待接入 |
| `project`、`workspace` | `management.ts`：workspace context、listWorkspaces、聚合search，返回title/ref/kind/source/owner | 授权workspaceRefs、query、limit/cursor；原适配截取前三个ref已修复，不能据workspace列表推断领域project目录 | workspace provider.open需按真实来源路由；不以本地同名项目替代 | workspace合同已有，project目录待接入 |
| `canvas-node` | `ui-pane-domain/src/project-canvas-controller.ts`：canvasRead返回固定scope/document及nodes | 一个已知project/document的读取；不是全project画布搜索接口 | 原画布读取和节点定位；不调用canvasSave | 待接入；需明确文档发现范围 |
| `file`、`folder`、`document` | `ui-pane-workbench/src/explorer/runtime.ts`：roots/listChildren/可选search、inspectMetadata；tree node ref/name/version | 绑定workspace；search仅返回tree nodes，没有正文／分页／全库时间排序声明 | openResource、元信息；正文由原Reader能力提供 | 待接入；不递归扫描冒充全文 |
| `note` | CreatorStudioOwnerDirectory含pinax owner；snapshot/listAssets可选；readArtifactContent独立 | 绑定CreatorStudioContext与owner；是否笔记集合完整必须实际确认 | Pinax／通用artifact Reader；只读能力需probe | 待接入，listAssets不证明vault全文 |
| `knowledge-entry` | 本次搜索消费链未绑定Inferrum知识查询接口 | 未证实query/scope/filter/cursor | 未绑定，不用笔记目录替代知识库 | 待接入；保留Inferrum owner |
| `image`、`video`、`audio`、`subtitle`、`text-artifact`、`delivery-package` | `creator-studio/src/types.ts`：CreatorOwnerAdapterV1.snapshot/listAssets；可选readEikonaAssetPage/readCandidatePage/readArtifactContent/readArtifactImage；`directory.ts`按owner/transport选择 | context有project/principal/membership/runtime版本；listAssets请求只含scope/projectRef，不能传伪query或声称全文；专用页cursor需独立适配 | resolveArtifact和各read方法可选；必须保留ref/revision及媒体授权 | 六类均待接入真实搜索路径；不以snapshot条数当全库计数 |
| `prompt`、`template`、`reusable-reference` | 本搜索链未绑定Prompt Repository／Template Registry查询；Creator Studio已有artifact与会话引用合同 | 当前仅已知资源引用，不提供任意prompt/template全库检索；不读取隐藏system prompt | 原Reader、明确目标会话prepare/ack | 三类待接入，不创建第二模板库 |
| `skill`、`native-tool` | `ui-mcp-inspector/src/client/installed-search-source.ts` → 原ToolHub Remote／Sidecar；ID、名称、说明、来源、领域状态 | 已安装profile目录；全量状态筛选／名称排序需complete，partial不冒充全量；cursor绑定目录快照 | 原Tools details与工具管理Pane；目录版本不等于Skill正文版本 | 已安装目录适配已有实现，宿主与会话待验证／接入；Reader待接入 |
| `mcp-tool` | `session-catalog.ts`：referenceTools.list(sessionId)；session-search-source.ts适配 | 单个会话的工具公开说明；global ToolHub的MCP项只是服务器汇总 | 原会话Tools；不得将服务器汇总当成工具 | 适配已有实现，严格scope owner增量已隔离验证；运行注册与范围UI待接入 |
| `mcp-resource` | 上述工具目录不含resources/list或resources/read能力证明 | 未证实资源scope、分页、MIME和读取 | 仅允许实际provider资源读取 | 待接入，禁止推断工具目录等于资源目录 |
| `plugin`、`preset` | dsh-tool-hub catalog可接pluginEntries；Pane/command registry含已注册视图与命令，不能当完整preset目录 | 插件安装／注册／会话可调用三者不同；preset全目录未在搜索链绑定 | 原管理详情，选择不应用preset或启停插件 | 两类待接入 |
| `task`、`run`、`approval`、`verification`、`evidence` | `packages/host/ordo-agent-ops/src/remote.ts`仅转发实际Ordo gateway；Creator Studio含operations/run/approval安全projection类型 | 不是五类完整search API；需逐owner验证scope、状态、query/cursor；不能扫描raw执行记录 | 原Ordo／领域详情；禁止调用dispatch完成搜索 | 五类待接入，保留原状态owner |
| `pane`、`command`、`compatibility-entry` | `search-identity.ts`消费Pane/command注册快照：标题、ID、别名、关键字、描述、owner、状态 | 本地完整注册快照；稳定匹配层级、open-only同目标合并、已打开／偏好；兼容项精确ID可发现 | 原controller/command owner；动作失败不写最近 | legacy已有；v2分类映射测试通过 |
| `settings-entry` | 本搜索链没有独立settings registry；已有设置类命令仅按原command注册 | 没有设置值搜索合同，不检索凭据或配置正文 | 后续只打开原设置页 | 待接入 |

上表源码路径均相对于 `packages/` 下的相应owner：搜索模块在 `client/ui-pane-workbench`，会话／创作／工具host在 `host/`。所有未接入项继续保留，不因为相邻owner缺少接口而勾选B/C任务。

## 第一批实现与验证

- 新增内部 `search-catalog.ts`：8类35资源，与V1 `session/pane/command` union分离。
- 新增内部 `search-source.ts`：来源scope/filter/sort/pagination能力检查、legacy/source结果分支和owner/ref/revision身份。尚未接入页面，不标为完整provider注册或领域查询实现。
- 修复会话快照忽略workspace/session范围、宽松cursor前缀、缺open入口／失效session仍成功以及异步打开错误未传播；保留V1消息字段兼容，但在metadata适配输出中移除虚构的message锚点和project引用。
- 修复查询permission/profile/locale失效后的迟到响应、永不settle来源的timeout、重复load-more；只取消搜索请求，不取消owner业务工作。
- 回归发现controller默认的`session:root`是管理持久化范围，不是真实会话筛选；搜索入口不再把该值发送给会话查询。真实项目范围继续保留。

定向命令：

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test:workspace-search-stage-a
pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck
```

第一批组件证据：[58项通过的run summary](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T01-22-38-340Z-2730423/summary.json)。5000条目录p95为16.00ms，预算100ms。证据是本地模块/组件与fixture合同，不是新页面截图、真实历史正文或所有owner的在线验收。

完整Surface／视觉／插件与宿主链门留给稳定的页面阶段；本记录不据此勾选2.8或D阶段。

## 分类探索的首个页面切片

已实现8类35资源的两层导航、最近／已打开／常用快捷视图、空查询探索卡片、输入后分组列表、查看全部和显式待接入说明。新的资源分类不进入旧V1 union；已有会话／窗格／命令继续走原查询和打开路径。

组件测试同时覆盖：选择未接入Skills仍保留查询、空查询浏览未打开的注册窗格、从5项展开结果、两Pane combobox/result ID隔离，以及IME／左右光标／分类选择不被结果导航拦截。侧栏按共享 `yeisme-surface` 容器查询展开，不能使用被Surface覆盖的另一个容器名称。

- [64项组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T01-44-00-763Z-2897499/summary.json)：通过；5000条本地目录p95=14.77ms。
- [13项独立浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T01-45-26-055Z-2909537/summary.json)：360／560／960px × zh/en × dark/light，以及快捷浮层编辑键。测试使用真实组件源码和官方primitives，owner数据为fixture；不是运行宿主或领域服务验收。
- `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run typecheck`、`pnpm run check:surfaces` 通过。
- `pnpm run check:plugins` 未通过：已有 `packages/bundle/dsh-context/src/client/latestVersion.ts` 的浏览器fetch与 `meta.ts` 的原始URL被safe-projection检查发现；这两个文件本轮未修改。其他五个检查器通过。报告位于 `temp/toolchain-runs/2026-09-11T013510976Z-toolchain/`；不修改无关模块来消除此失败。

浏览器证据入口复用现有runner，新增 `visual-search-center.spec.ts` 与 `/search-center` fixture；没有建立平行测试框架或更新黄金截图。宽屏截图复查发现官方primitive在该预览构建中的默认白底，已补充scoped token样式，并增加背景／文字继承与最多三列的浏览器断言。

补充样式后的[13项浏览器回归](../../../temp/integration-test-runs/ui-visual-2026-09-11T01-48-06-575Z-2926966/summary.json)通过；已检查960px深色探索页截图，侧栏白底回退已消除。该记录仍是组件fixture验证，不提升真实owner接入状态。

```bash
pnpm run test:visual -- visual-search-center.spec.ts
```

该切片完成时，1.1、1.2、1.3、2.1共4项已有证据。后续继续范围／筛选、预览布局和浮层交接；不能因为分类入口齐全就关闭整个Goal或归档change。

## 范围、条件与来源覆盖（任务2.2）

本次推进补齐可见的搜索范围、来源、资源状态、更新时间与组内排序。默认采用明确的当前项目；用户手动选定范围后，邻Pane的活动项目变化不会改写它，清除条件也不扩大范围。项目不再位于授权目录时保留失效标识并移除其结果，不回退全局查询。

已实现的查询与兼容行为：

- 完整本地窗格／命令快照支持来源、状态和名称排序。它们不提供更新时间，时间条件会明确排除这些组，不把未筛选样本混入结果。
- 当前profile的 `sessions.list` 元数据快照支持名称／更新时间排序、UTC起始日期与已知running/idle状态，在分页前筛选整个当前快照；未知时间／状态不伪装成已知值。这仍不代表完整历史正文、归档或所有领域内容检索。
- 专用元数据游标绑定查询条件和快照变化stamp，保留最多32个有界位置，可供不同查询消费者使用；每页重新读取授权快照并应用条件，stamp不承担授权作用。旧V1游标和请求保持兼容。
- 高级条件为内部 `SearchCenterControls`。适配器只有显式声明 `negotiatesControls` 才能处理这些条件，否则首次查询和重试都不调用未知来源。旧远程来源没有条件合同就显示限制，不在第一页过滤后宣称全库有效。
- workspace来源承接实际的单项目／跨项目查询；超出请求scope的结果不展示，permission_denied优先保留以触发缓存失效。打开保留原owner和目标，重新检查可访问workspace，不在当前项目伪造一个同名本地窗格。
- 权威远程结果不再经过浏览器的片段二次匹配或重新排名。即使命中关键词不在有界片段中，也不会被客户端丢弃。
- 分类切换保留仍适用的来源和状态，移除不适用的时间等条件并提示。旧偏好服务尚不能保存新增高级条件时明确禁用保存，不丢条件后假装成功。

验证证据：

- [79项模块／组件验证](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T02-41-49-611Z-3353351/summary.json)：通过。5000条本地目录投影p95=66.75ms，预算100ms；这不是正文索引或真实网络的性能指标。
- [15项浏览器验证](../../../temp/integration-test-runs/ui-visual-2026-09-11T02-17-37-260Z-3133512/summary.json)：通过。新增分页前时间／状态筛选、项目撤权、清除条件保留scope和原owner导航路径，使用真实组件及fixture数据。
- 一次[组件失败记录](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T02-17-33-438Z-3130301/summary.json)来自同时运行Surface重建和消费者测试，构建清理短暂移除了入口文件；归因为验证编排冲突，改为顺序运行后通过，不修改业务逻辑掩盖失败。
- 包typecheck、build与 `check:surfaces` 通过；`check:plugins`仍只有此前dsh-context的两项safe-projection问题，报告在 `temp/toolchain-runs/2026-09-11T023618476Z-toolchain/`。本轮没有修改该bundle。

实施任务现为5/27完成，Goal仍在进行中。下一前沿为2.3：只读预览、媒体显示合同与完整响应式页面；其后落实2.4的查询／范围／选择／焦点交接。2.5–2.8以及B/C/D完整验收保持未完成，不以本次fixture验证替代真实owner接入。


## 只读元数据预览切片（任务2.3进行中）

搜索结果增加明确的“预览选中结果”入口。预览只读取当前授权结果集中的安全元数据，展示来源、项目、匹配字段与来源摘要；旧结果合同没有版本字段时显示“来源未提供”。不挂载资源组件，不读取任意URL，不执行命令；命令预览不提供执行按钮。来源摘要最多显示8192字符，这不代表已具备正文预览合同或全文检索。

360px容器以详情替换结果内容，返回或Escape恢复输入焦点，保留查询、筛选、选择和仍挂载列表的滚动位置。1200px容器并排显示320px预览，结果区域至少480px；1120px以下不并排。结果离开当前结果集或scope失效后立即移除其元数据及打开动作，提示返回刷新。

- [81项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T02-58-33-083Z-3509440/summary.json)通过，新增预览无执行、无资源挂载、返回焦点和结果失效检查；5000条本地目录投影p95=16.65ms。
- [17项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T02-59-25-675Z-3518440/summary.json)通过，新增360px详情返回和1200px并排预览的尺寸、无横向溢出与焦点验证。浏览器来源仍为fixture，不代表领域owner生产接入。
- 包typecheck通过。本切片不勾选2.3；媒体缩略图、owner版本化正文、紧凑浮层和完整页面合同仍待落实。任务总数保持5/27完成。


## 浮层到Pane的临时状态交接（任务2.4进行中）

新增controller隔离的内存交接通道，只传查询、分类、快捷视图、显式范围、筛选、排序、分页展示上限与选中稳定身份，不保存正文或写入偏好存储。已挂载Pane订阅交接；新Pane挂载后读取待交接状态。消费按对象身份确认，旧确认不能清除后来的交接。

继续操作复用原Search Pane种类和resourceKey。先确认提供者注册及controller中目标存在，失败保留浮层和所有输入；成功关闭浮层时不调用旧触发器的restoreFocus，新Pane在浮层卸载后聚焦输入。手动交接的项目范围固定，随后由授权目录重新校验，不能因新Pane的活动项目不同而扩大范围。命令及资源均不因交接而执行。

[18项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T03-08-39-966Z-3617379/summary.json)通过，覆盖新Pane挂载、保留第二个选中结果、查询及输入焦点、无旧焦点恢复与无业务执行。已有Pane重复交接和缺少提供者恢复另由组件检查覆盖。

一次[浏览器失败](../../../temp/integration-test-runs/ui-visual-2026-09-11T03-05-12-900Z-3589208/summary.json)定位为夹具Modal布局缺失：安装包CSS stub使portal处于普通文档流，fixture遮挡了按钮。夹具依据本地上游 `ui-primitives/src/Modal.module.css` 补上root/mask/card布局，组件通过官方Modal的className设置搜索专属680px宽度、12px圆角及headless内边距，重跑使用普通点击通过，没有force绕过遮挡。此浏览器证据仍不等同真实宿主的CSS、焦点陷阱和保存保护验收。

另一次[组件超时](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-02-38-165Z-3558052/summary.json)发生在旧分页用例：宽泛role查询重复遍历整个dialog含分类select的选项。将结果匹配限定到已有listbox后该用例从约5.5s降至约2s，未提高超时或减少分页／打开断言。

任务仍为5/27完成；2.4核心交接已实现，完整验收保留给2.3页面合同、2.5生命周期、2.6可访问性及真实宿主链路。

最终[83项模块／组件验证](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-09-28-411Z-3624002/summary.json)通过，包括controller隔离、不可变交接快照及旧确认不清除新交接；5000条本地目录p95=15.92ms。包typecheck通过。


## 来源通知、撤权与失败缓存（任务2.5进行中）

会话元数据搜索已接入现有 `sessions.list.subscribe`。来源事件先清空当前结果、缓存和旧generation，再以原查询／范围重新读取；预览只跟随当前结果集，因此移除的会话不会继续展示摘要。组件卸载释放订阅，已dispose的协调器不会因迟到通知重启查询。

读取offline、timeout或异常时，仅有静态permissionGeneration不足以保留摘要；适配器须提供当前授权仍有效的可选证明，否则清空内容和缓存。有证明时可保留stale内容，所有失败路径移除旧cursor并从第一页重试。同步抛错也转为可恢复来源错误，owner原始错误文本不进入UI。

公开V1缓存serializer及缓存默认构造保持原格式。新协调器显式使用新增V2 JSON tuple，区分分隔符、真实open-cycle版本与缺省版本，保留owner的查询大小写，并将browse开关及结构化筛选纳入键。缓存保存实际单页；超过1000项的单页不缓存，避免截断后游标越过未展示内容。dispose清除内存摘要和缓存。

[19项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T03-18-23-347Z-3713914/summary.json)通过，新增来源移除会话后即时清除只读预览、移除打开动作、返回后保留查询且无旧结果。来源仍为fixture；不提高领域owner接入等级。

一次[组件断言失败](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-15-34-825Z-3688908/summary.json)来自预览详情替换列表后继续查找可见listbox。测试改为执行真实“返回结果”操作再检查列表；保留即时清除预览和订阅释放断言。

2.5仍未勾选；完整选择稳定性、所有分页异常、扩展偏好、HMR与真实来源授权矩阵尚待补齐。整体保持5/27完成。

最终[91项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-19-12-203Z-3720491/summary.json)通过，包含来源刷新取消迟到响应、授权有效／无效时的offline分支、同步owner异常、大小写和空查询browse隔离、V1兼容与V2缓存键防碰撞、超容量页不跳行。5000条本地目录p95=18.02ms，包typecheck与OpenSpec严格校验通过。


## 打开动作与真实回执（任务2.7进行中）

修正旧搜索把maximize_group当作float成功的错误。当前UnifiedWorkspaceHost和本地Pane合同没有可验证的float动作，菜单明确禁用悬浮；此能力仍保留在任务账本，不能通过删除要求或伪造最大化回执关闭验收。会话、workspace owner和命令没有placement合同的非默认动作同样不执行。

local Pane打开前校验viewId与kind/resourceKey一致，拒绝失效身份而非打开别的资源。默认激活需确认实际activeGroup/activeTab；右／下分屏以打开前的活动group为锚点，确认布局树方向、目标group和activeTab后才记录成功。只有意图accepted而实际布局未变化时返回unconfirmed。无有效锚点不先移动单例；现有脏内容保留，关闭与保存仍由原宿主决定。

标准PaneActionReceipt只有completed记为命令成功。pending、accepted、failed、approval_required、unknown等回执保留上下文并提示到原工具检查，不写最近成功记录，也不自动重试。旧void/Promise<void>处理器完成语义保留；其他未声明返回值不猜成功。执行仍经原PaneCommandRegistry处理器，不在搜索中自行授予权限、批准或安装。

单个浮层同一时刻只允许一项激活动作，避免连续Enter或点击重复提交。关闭或交接后迟到完成不再次恢复旧焦点、关闭新上下文或更新最近记录。

[20项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T03-29-11-979Z-3803440/summary.json)通过，新增普通点击打开动作菜单、悬浮禁用、右侧分屏后两个真实controller group不同、未最大化且无业务执行。仍是组件＋本地controller fixture，不代表真实宿主所有保存／关闭保护通过。

初次新增打开测试因fixture漏传候选投影必需profile失败，保留[失败证据](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-26-15-408Z-3776902/summary.json)；补传真实controller management profile后通过，不放宽生产合同。任务2.7保持未完成，实际宿主placement、领域owner的引用和确认边界仍需完整验收。整体5/27不变。

最终[104项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-30-14-070Z-3812426/summary.json)通过，含11项打开回执测试、重复Enter隔离及关闭后迟到完成保护；5000条本地目录p95=15.49ms。包typecheck与OpenSpec严格校验通过。


## 可选owner来源登记与安全目录查询（领域接入基础）

新增 `SearchCenterSourceRegistry`，并在真实Pane Workbench runtime提供可选 `registerSearchSource`。旧客户端无需新增此字段。注册表与controller绑定，runtime teardown释放来源订阅和在途读取；尚未把新来源装入统一查询协调器和页面，因此所有领域分类的真实接入状态保持原账本结论。

查询先验证来源scope、资源种类、筛选、排序和分页能力；session/workspace资源必须显式匹配请求范围。结果走既有source分支，安全投影仅保留已声明字段，来源/ref/revision稳定身份不混入旧V1枚举。保留partial、未知total和owner的opaque cursor，不把catalog列表升级为全文检索。拒绝访问、离线及错误页不透出资源样本、数量或cursor。

每个source绑定独立失效版本。来源变化、卸载、替换及外部AbortSignal会终止只读等待，即使owner忽略信号且永不返回也可结束等待；旧结果不可再打开。打开必须使用注册表实际签发的资源对象、原scope和原owner回执，不接受同名新造对象，也不凭请求发送成功确认导航。当前目录注册要求preview:false，待版本化Reader适配后才开放正文／媒体读取；原有元数据预览不受影响。

[119项模块／组件验证](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T03-42-05-256Z-3916242/summary.json)通过，其中15项来源注册测试覆盖能力拒绝、越界scope、源移除／替换、版本身份、跨类别去重、失败页脱敏、取消、生命周期与旧回执隔离。5000条本地目录p95=14.50ms。包构建（含声明文件）和OpenSpec严格校验通过。

本轮未安装／修改Skills，未执行工具、启停插件或修改任何真实owner数据。登记／查询基础不构成3.1–4.6的真实领域接入证明；整体仍5/27完成。下一前沿是由现有协调器统一调度source分支，并接入实际Tools／Skills目录和原详情导航。


## Source分支进入原协调器与结果页

原WorkspaceSearchCoordinator已接入可选来源注册表，snapshot.sources与旧local/history并存；旧消费者不连接sources时保持原接口行为。source与legacy共享并发预算3，source使用同样的200ms debounce、IME抑制、150ms loading延迟、30s超时和取消边界。来源单独分页与重试，不让失败／超时阻塞其余成功结果；重复加载手势不重复请求，游标循环显示partial并终止旧cursor。

搜索页面现能显示真实注册来源返回的source资源，按资源类别默认5项、查看全部后扩展，并显示目录／元数据／正文覆盖声明。注册来源不支持当前scope或条件时保留范围并明确说明，不能悄悄改成profile。计数采用已找到的分类条数，不把跨类别的source.total当成该分类总数。source资源加入输入框键盘选择和只读元数据预览，保留owner/ref/revision；打开仍经原注册owner确认，不改写成旧pane或command。

[124项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T04-05-25-483Z-4166507/summary.json)通过：新增共享并发预算、队列推进、IME、迟到结果、重复分页、游标循环、单来源超时／重试，以及分类展开、版本预览与owner打开验证。5000条本地目录p95=19.88ms，包typecheck通过。

[21项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T04-02-08-919Z-4129110/summary.json)通过，新增真实组件注册fixture的scope拒绝、显式切换范围、5项展开7项、版本元数据预览、原owner打开及卸载后清除预览。该fixture不代表生产Skills已经接入。

首次[浏览器失败](../../../temp/integration-test-runs/ui-visual-2026-09-11T03-58-22-344Z-4071020/summary.json)暴露实际交互缺陷：展开后的第6行出现在静止鼠标下，mouseenter把选中项从第1行改成第6行。修复为仅鼠标实际移动才更新悬停选择；保留原测试的第一项预览断言，未改测试去接受意外目标。

Source最近访问完整恢复、长引用偏好、Reader正文与媒体、实际Tools/Skills桥接仍待完成，未将此管线fixture计为3.1–4.6的真实owner验收。整体仍5/27完成。下一前沿是从原Tools owner读取真实目录并打开其原有详情，保留全局目录与当前会话目录的区别。

此接线切片的最终包构建（含新协调器与client声明）通过；OpenSpec严格校验和目标diff空白检查通过。


## 已安装 Skills／原生工具接入原 Tools owner（B1 部分实现）

`ui-mcp-inspector` 已在具备可选搜索登记接口的Pane runtime中注册 `dsh.tools.installed`，经原ToolHub Remote解码与Sidecar目录读取已安装Skills和原生工具。它仅声明profile范围，不把项目或会话请求改成全局；全局MCP项是服务器汇总，不能当作单个MCP工具，因此mcp-tool仍等待会话目录接入。

目录名称、ID、说明、来源支持中文和规范化英文匹配。完整目录先过滤／排序再分页；不完整目录保持partial，不给出total或伪全库状态筛选／名称排序。Skills来源缺失时仍保留可用原生工具元数据。目录游标保存有界摘要与位置，并复核每次读取的快照；重叠查询合并一个不可取消的实际目录读取，避免不断叠加RPC。

Source资源新增领域status和sourceLabel，与能否打开详情的availability分开。禁用工具仍可进入原Tools details；`catalog:<generation>`是目录版本而非Skill文件版本。相同item ID的不同来源保持不同引用和显示标签，原owner不能精确定位时标为暂不可打开详情，不猜第一个。资源消失、目录版本／来源变化或打开时权限撤销会通知搜索撤下旧结果；连续拒绝查询不会形成重试循环。

打开重用原ToolsViewState和tools-manager Pane，选择原details区域并核对实际activeGroup/activeTab。只读Remote仅暴露list时也可以读取，管理视图的canToggle降为false；没有为搜索要求客户端取得写权限或安装产品CLI。401／403权限信号通过附加accessDenied标记传给搜索，旧错误码集合保持不变。

验证与边界：

- [36项Tools集成检查](../../../temp/integration-test-runs/2026-09-11T05-15-14-564Z-708039/summary.json)通过，包含真实ToolHubSidecar、原Remote解码、搜索注册和原详情组件；完整／只读端口均验证成功，setEnabled和存储put调用为0。目录输入和存储口是受控测试数据，不是已部署服务数据。
- [124项搜索模块／组件回归](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T05-04-44-678Z-617853/summary.json)通过，5000条本地目录p95=15.19ms。
- [22项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T04-47-34-346Z-489788/summary.json)通过，新增从搜索进入真实Tools详情组件的禁用Skill路径，并断言启用／存储／执行计数为0。测试使用真实owner实现与受控目录，不能提升为完整部署宿主验收。
- 两个包typecheck与build、OpenSpec严格校验及目标diff空白检查通过。未改动Skills文件或调用启停／安装／工具执行。

早期[集成收集失败](../../../temp/integration-test-runs/2026-09-11T04-33-11-948Z-381530/summary.json)来自MCP包缺少共享primitives的Vitest内联配置，按Pane Workbench已有配置补齐后通过。另一次[浏览器失败](../../../temp/integration-test-runs/ui-visual-2026-09-11T04-41-45-024Z-448801/summary.json)来自夹具会话getSnapshot每次返回新对象；改为符合宿主合同的稳定快照后保留原详情断言通过。SSR检查保留Menu的useLayoutEffect提示，浏览器路径另有独立证据。

能力账本已更新已安装目录的实现状态；任务仍5/27完成。3.1尚缺会话目录与正文Reader，3.2尚缺会话单个MCP工具和MCP资源；没有以本切片勾选整个B1或宣称所有35类已可用。

## 交接活动态与延迟选择保护（A1 部分实现）

浮层交接现在核对搜索 Pane 的实际 activeGroupId 与 activeTabId；仅有目标 view 存在不足以确认成功。目标未激活时不覆盖旧交接包，保留浮层上下文。交接恢复的选中引用尚未返回时显示等待／不可用提示，不默认选中其他本地结果；原引用返回后恢复选择，用户改变查询或主动使用方向键后重新选择。项目范围的显式切换也随交接保留。

搜索输入框中的非 IME Enter 始终消费默认事件，等待原引用或没有结果时也不提交祖先表单。预览和选择不执行业务动作。

- [127项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T05-53-50-564Z-1039550/summary.json)通过；5000条本地目录 p95=18.21ms。
- [23项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T05-55-47-776Z-1059910/summary.json)通过；新增原选中 source 延迟返回、禁止替代打开和祖先表单零提交断言。浏览器使用真实搜索组件与受控 source，不代表部署宿主已验收。

2.4仍未完成：当前交接确认停留在目标布局活动态，发送方尚未等待接收组件确认应用上下文；挂载失败与完整宿主焦点交接仍需独立实现和验证。整体保持5/27，不因本切片的保护测试通过勾选完整任务。

## 浮层等待接收组件确认（A1 后续实现）

上节记录的接收确认缺口已在插件内补齐：发送方激活单例后等待接收组件确认，目标提交查询／范围／筛选与延迟选择状态后才确认同一临时交接包，随后关闭浮层并聚焦目标。旧同步入口保留，新浮层路径采用带取消信号的请求。

3秒未接收时保留浮层上下文并允许重试。关闭／卸载、修改查询／类别／范围／条件会取消待确认包；旧包被替换、取消或过期后不能被迟到确认接受。等待期间禁止重复点击；查询结果本身的迟到不阻塞接收确认，也不改变原引用的延迟选择规则。

- [129项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T06-05-53-631Z-1153121/summary.json)通过，包含无接收方超时、修改查询取消、迟到确认拒绝、请求替换、单例复用与选择／焦点恢复；5000条目录 p95=14.63ms。
- [24项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T06-04-51-636Z-1142757/summary.json)通过。受控宿主改为在浮层关闭前根据真实controller状态挂载目标，验证新挂载接收与未挂载超时两条路径，没有用关闭浮层触发挂载来回避接收确认。
- Pane Workbench typecheck、声明构建、OpenSpec严格校验及目标diff空白检查通过。设计正文和用户说明已更新。

整组任务仍5/27：2.4的插件接收路径已有上述证据，但其2.3前置布局／媒体要求及2.6相关宿主焦点矩阵尚未整体完成；未用受控宿主代替部署宿主，未勾选完整阶段。后续推进剩余A阶段界面与生命周期要求，再集中核对任务闭环。

## 官方结果菜单与局部键盘路径（A1 后续实现）

结果操作已替换为官方Menu，删除旧手写菜单样式。新增可Tab到达的“选中结果的操作”入口及输入框Shift+F10／ContextMenu入口；菜单上下键跳过禁用项，Home／End到首末可用项，Escape返回本搜索输入框，Tab从输入框继续。浮层菜单Escape不会同时关闭浮层；点击外部控件仅关闭菜单，不夺回相邻Pane焦点。分屏与命令仍经原打开合同，不支持的悬浮保持禁用。

结果option不再嵌套“更多”按钮；按钮作为行内兄弟元素，独立工具栏承担键盘入口。上下结果导航消费已处理的事件，避免父层同时处理。预览期间输入框不再指向隐藏结果的aria-activedescendant。粗指针的行内“更多”触控区域补齐44px宽度。

- [130项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T06-16-12-004Z-1240695/summary.json)通过，覆盖入口、循环导航、禁用项、Escape、外部pointerdown关闭与焦点、无父层键盘重复处理和option语义；5000条目录p95=14.78ms。
- [26项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T06-17-13-413Z-1251294/summary.json)通过，新增Pane／dialog的实际菜单焦点与键盘返回，保留原真实分屏布局断言。
- 包typecheck、声明构建、OpenSpec严格校验与目标diff空白检查通过。用户说明与设计键盘合同已更新。

[首轮组件失败](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T06-11-50-813Z-1200992/summary.json)来自新增测试未限定资源类别，方向键选中了命令，以及JSDOM缺少scrollIntoView。测试改为明确pane类别并为被测行提供滚动桩；滚动及菜单行为另由真实浏览器覆盖，未更改生产代码回避失败。

2.6仍未整体完成：已安装官方Modal实现仅有Escape监听，没有Tab焦点约束；完整浮层焦点闭环、读屏与触控／缩放矩阵仍需补齐。官方Menu内部条目的完整触控尺寸也需进一步核验。整体任务仍5/27，后续优先补齐实际发现的浮层焦点缺口。

## 浮层Tab约束与触控尺寸（A1 后续实现）

搜索浮层已补上局部Tab／Shift+Tab循环，使用当前可见且未禁用的控件，跳过隐藏结果、inert和负tabIndex；预览标题的Tab跳转遵循DOM顺序。Pane模式不启用该约束。官方Menu的portal继续处理自己的键盘返回，没有增加全局focusin监听或修改官方Modal，因此不拦截浮层转Pane的接收确认与目标聚焦。

粗指针下搜索按钮、输入框、选择器补齐至少44px宽高，官方菜单用搜索专属label扩展触控高度；不改变其他owner的Menu样式。减少动效继续关闭搜索区过渡。

- [29项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T06-24-02-827Z-1311376/summary.json)通过：新增浮层首尾循环、预览标题／隐藏列表、portal返回、Pane进入相邻控件，以及hasTouch粗指针下全部可见控件和菜单项44px尺寸、减少动效检查。原交接测试仍通过。
- [130项模块／组件回归](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T06-25-30-247Z-1324950/summary.json)通过，5000条目录p95=15.19ms。包typecheck、声明构建、OpenSpec严格校验及目标diff空白检查通过。

[首次浏览器失败](../../../temp/integration-test-runs/ui-visual-2026-09-11T06-21-33-008Z-1284687/summary.json)来自测试误把“选中结果的操作”视作末尾控件，忽略其后结果区的实际可见按钮；改为从可见按钮中定位真实末尾，保留首尾循环与相邻Pane可达性断言后通过。

本轮未声称完成读屏、完整缩放／软键盘、来源生命周期或媒体要求。2.6及其前置任务仍保留未完成状态，整体5/27。剩余A阶段按真实缺口推进；部署宿主证明与插件内行为证据仍分别记录，不把官方上游合入作为插件完成条件。

## 协调器effect重放与迟到打开隔离（A1 后续实现）

修复搜索组件在React StrictMode effect重放后不再查询的缺陷：原cleanup永久dispose了保留下来的memo协调器。现在复用既有open／close周期，在同一effect内连接UI、来源与owner订阅；cleanup释放订阅、断开来源、使请求失效并取消在途读取。runtime层真正销毁来源注册表的dispose合同未变。

查询／类别／范围／条件／协调器生命周期变化还会递增打开动作的UI世代。旧动作迟到完成不会关闭已编辑的查询、恢复旧焦点或写入当前最近访问；原owner已经接受的执行不因此撤销，也不自动重试。原一次只等待一个打开动作的约束保持。

- [132项模块／组件检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T06-30-00-223Z-1363617/summary.json)通过。新增实际StrictMode effect重放后的会话／source查询、唯一活动订阅、卸载后订阅归零、AbortSignal取消及迟到资源隔离；新增编辑查询后旧动作完成不关闭／不记最近、后续新动作仍可用。5000条目录p95=15.76ms。
- [29项浏览器回归](../../../temp/integration-test-runs/ui-visual-2026-09-11T06-31-17-134Z-1376332/summary.json)通过；此项为UI回归，不替代StrictMode组件测试。
- 包typecheck、声明构建和OpenSpec严格校验通过，设计正文补充生命周期与动作回执边界。

任务仍5/27。2.5还需结合来源偏好恢复等剩余要求整体核对；未以局部生命周期验证宣称整个A阶段完成。下一步推进尚未满足UI Contract的窄屏分类／筛选面板与剩余布局要求，继续保留媒体、正文和领域owner接入任务。

## 窄屏面板与交接任务核对

≤420px按Pane容器宽度展示分类／筛选面板入口，复用官方Modal＋Surface及既有导航／字段组件。主界面始终显示scope，高级筛选收进面板；条件由同一搜索状态管理，不增加草稿副本。一级分类展开二级列表，二级或快捷视图选择后返回；“完成”保留当前选择。关闭恢复入口焦点，容器扩宽超过420px后关闭面板、恢复搜索框焦点并保留条件。面板自行消费Escape／Tab，嵌套浮层不会一起被关闭。

- [132项模块／组件回归](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T06-37-08-027Z-1421024/summary.json)通过，5000条目录p95=15.19ms。
- [31项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T06-39-29-485Z-1445757/summary.json)通过：中英文／深浅主题360px分类面板；1200px浏览器内360px Pane的筛选面板、条件保留与容器独立扩宽；嵌套面板Escape只关闭子面板。原交接、焦点和触控断言继续通过。
- 包typecheck与声明构建通过，设计和用户说明更新。

本轮重新按spec核对2.4：组件测试直接断言query、w2范围、pane分类、name排序、选中项与目标焦点；channel测试覆盖controller隔离、匹配确认、超时／取消／替换及无法激活时保留旧包；浏览器覆盖新挂载目标、缺失接收方、延迟选中项与旧触发点不抢焦点。测试使用实际搜索组件和Pane controller，受控来源不冒充部署数据。

先前把2.3尚缺的媒体能力和独立部署宿主证明同时作为2.4完成阻塞过宽。2.4依赖的基础布局和交接行为现已具备，上述证据覆盖其明确验收；按项目AGENTS的插件完成门，不额外要求官方上游或真实部署宿主。已用仓库脚本仅勾选2.4，当前6/27。2.3、2.5、2.6及领域／正文任务保持未完成，其剩余要求不删除、不降级；整个goal仍需完整实现与验收。

## Skill正文Host通道与原owner来源证明

核实原Skills的list/get后发现，普通get不能证明文件来源：runtime注册可以复制provider/source/resourceBase元数据。因此没有将普通get作为正文兜底。新增原owner可选getDocument，由registry核对实际provider实例，拒绝runtime注册及被覆盖／移除的来源。增量放在`upstream-prs/skill-document-reader-v1`，固定原文件blob，当前staging源码和用户Skill文件未改。

ToolHub新增独立`toolReferences.readSkill`，保留旧list/setEnabled及目录快照；只消费list/getDocument，缺方法返回reader_unavailable。当前支持profile、默认filesystem已安装文档；输入不含文件路径。每段最多256KiB／5000行，Unicode不截断，返回opaque资源身份、正文版本摘要、起始行／续行与绑定资源版本的cursor。读取前后检查owner与来源；撤权不交付内容，旧版本不续读，取消可结束不配合的只读等待，错误只返回固定原因。正文不落目录、日志或持久缓存，不执行／启用／安装工具。

[15项Host验证](../../../temp/integration-test-runs/2026-09-11T07-14-03-685Z-1791537/summary.json)通过，包括原Gateway路由与Loader回归、行／字节分页、版本及跨文档cursor拒绝、Unicode、权限错误脱敏、取消、来源撤销、owner替换，以及缺getDocument拒绝普通get兜底。owner测试在该run的artifacts中复制原Skills源码、检查／应用补丁、严格类型检查、加载实际registry，验证普通文件provider与伪装文件元数据的runtime注册；之后反向应用并逐字确认原文件。provider正文是受控测试数据，不能声称读取了真实用户安装文件或已部署宿主。

[中间失败](../../../temp/integration-test-runs/2026-09-11T07-03-43-017Z-1679552/summary.json)暴露Cordis每次返回新作用域代理，直接对象比较会误判owner替换。修复为通过公开symbols.original比较原服务身份，而实际读取仍用作用域代理，保留原授权上下文。后续测试保留动态ctx.get路径，不把getter固定成假常量以绕开验证。

Host包typecheck/build、补丁shell语法／当前staging只读apply检查、两个OpenSpec严格校验和目标diff空白检查通过。当前staging确实没有getDocument，未应用补丁的运行宿主会诚实禁用正文通道。搜索来源preview:false未提升；阅读UI、相对引用解析、会话范围及完整正文搜索仍待接入，3.1未勾选，整体保持6/27。

## 原Tools详情的显式源码阅读入口

通过可选renderReference扩展原Tools详情，已安装Skill可以显式点击“阅读正文”；目录选择不挂载Reader namespace、不读取正文。客户端按需挂载独立toolReferences Remote，验证协议版本、资源身份、字节／行数上限并只保留白名单字段；缺合同／缺endpoint与权限错误分别显示不可用／拒绝，不回退任意文件读取。

正文当前为转义源码分段，显示内容版本、起始行与续行标记。前后段经owner重读，固定resourceRef／revision，最多保留50个游标；没有正文历史缓存。版本变化、拒绝和错误清除当前内容，显式重新读取才接受新版本。取消／关闭、返回目录、切换条目或目录版本会释放旧请求，迟到结果不能覆盖新条目。会话范围禁用profile正文兜底，禁用工具仍可读其已授权文档。

- [44项客户端检查](../../../temp/integration-test-runs/2026-09-11T07-36-20-629Z-2018952/summary.json)通过。新增显式读取、HTML／链接不执行、取消及迟到响应、版本固定／变化／拒绝、wire边界、namespace按需挂载／释放、条目切换取消，以及原Tools详情→客户端decoder→真实Host Reader调用链。Host文件owner输入为受控数据；启用与存储写调用为0。
- [32项浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T07-33-13-586Z-1991382/summary.json)通过。新增搜索→原Tools→显式正文→前后分段→撤权清空路径；外部URL请求、工具执行、启用与存储写均为0。正文Remote为受控browser fixture，不代表部署宿主已可读。
- 客户端typecheck/build、两个OpenSpec严格校验及目标diff空白检查通过。SSR中的既有Menu／Tools layout-effect提示保留，浏览器路径另有验证。

原ReadBlock要求准确totalLines，当前协议没有全文总行数，因此先用起始行标注的转义源码，而非伪造总数。渲染模式、文内检索、逐行引用、相对文档导航、会话范围和完整Reader仍在账本。当前staging未应用getDocument增量，会显示Reader不可用；未安装或修改用户Skills。3.1及完整正文搜索任务不勾选，整体仍6/27。

## 会话Skills／MCP／原生工具目录适配

新增Session目录路由器，复用原已安装目录的查询／分页／打开逻辑；不同会话独立状态和游标，实例最多32个。同名资源ref加入sessionRef，拒绝跨会话打开、跨会话cursor及会话删除后的迟到结果。会话目录原generation固定为1，现以目录摘要生成catalog-sha256版本，元数据变化后旧目标不可直接打开。未执行工具、读取Skill正文或修改目录状态。

同时修复说明字段的匹配边界：敏感说明在匹配前清除，而非命中后只隐藏展示摘要。原session-catalog保留权限拒绝信号，不再一概折成离线。新增严格模式要求响应提供scopeResolved证明，旧Tools调用不启用该模式。

[50项客户端检查](../../../temp/integration-test-runs/2026-09-11T08-04-49-124Z-2264900/summary.json)通过，包括原Session目录解码→适配→真实搜索来源注册表的双会话身份／打开隔离、单个MCP工具分类、跨scope拒绝、cursor隔离、固定owner generation下的变化检测、会话移除、权限拒绝，以及旧宿主没有范围证明时disabled且旧目录仍可读。正文和执行计数为0。目录输入为受控RPC数据，不能据此宣称实际宿主已有严格范围证明。

核查staging的tool-catalog.ts／skill-catalog.ts发现，预设解析失败明确回退global，且当前没有requireResolvedScope／scopeResolved字段。因此适配尚未注册进运行时搜索、也未开放会话范围UI；后续须先补原owner的可选严格合同，再接线验证。客户端typecheck/build与目标diff检查通过，3.1／3.2保持未完成，整体6/27。

## 原会话目录owner的严格范围合同

新增`upstream-prs/session-catalog-scope-v1`，固定types.ts、tool-catalog.ts和skill-catalog.ts的原文件blob。请求只有布尔requireResolvedScope:true才启用严格模式并允许scopeResolved:true；无法解析预设或指定了预设却缺少解析服务时，拒绝global回退并返回固定scope不可用原因。无预设且无preset服务的已知global基础组合仍可确认。原未请求严格模式的调用保留原行为。

严格Skills查询改用原snapshot.complete，不再把部分provider目录标为完整；legacy调用仍保持旧输出。客户端将固定scope失败映射为disabled，维持所选范围。该增量不创建Agent、不读取Skill正文，不改变安装／启用／执行入口。

- [16项Host检查](../../../temp/integration-test-runs/2026-09-11T08-39-26-341Z-2562127/summary.json)通过。隔离复制实际owner源码、应用补丁、严格类型检查、加载实际类，验证旧回退、严格失败无目录读取、scope证明、非布尔flag无证明、partial完整性、缺服务和已知global组合，最后反向应用并逐字核对三个原文件。依赖数据为受控输入，未改当前staging。
- [51项客户端检查](../../../temp/integration-test-runs/2026-09-11T08-33-12-570Z-2507309/summary.json)通过，包含scope失败不被视作成功global目录；客户端typecheck/build通过。
- 补丁shell语法、当前staging只读apply检查、OpenSpec严格校验和目标diff检查通过。

初始隔离编译[失败](../../../temp/integration-test-runs/2026-09-11T08-17-32-253Z-2372678/summary.json)缺少owner项目的ambient service声明及正确decorator模式；[后续失败](../../../temp/integration-test-runs/2026-09-11T08-21-53-791Z-2408953/summary.json)定位到缺少agent-presets主声明。测试补齐实际SDK声明与原现代decorator配置后通过，未放宽strict或用自造接口代替owner类型。

当前staging未应用此增量，也未重建host/client生成合同。单个owner方法验证不代表完整部署SDK通过；后续需注册会话来源、开放范围选择并验证原Tools打开链。3.1／3.2不勾选，整体仍6/27。

### 会话来源运行时注册与原 Tools 打开链

MCP 客户端现在同时注册安装目录和 `dsh.tools.session` 来源。会话来源只读取 sessions.list 中的会话，生产查询显式要求 requireResolvedScope；会话列表变化、服务替换和连接重置会使已签发结果失效。卸载注销两类来源及会话订阅。打开会话资源通过原 SessionToolsWorkspace 刷新、恢复会话范围并选择详情，再调用原 openSessionTools，检查实际活动 group/tab；查询和打开均不执行工具。

[52项客户端检查](../../../temp/integration-test-runs/2026-09-11T08-49-00-420Z-2643421/summary.json)通过，新增实际客户端注册、严格请求参数、原绑定窗格打开、会话移除后的旧结果撤销及订阅清理验证。目录响应仍为受控测试数据，不能视作已部署 owner 验证。客户端类型检查及构建通过；原 SSR useLayoutEffect 警告保留。

范围选择 UI 尚未加入会话入口，当前 staging 也尚无 scopeResolved 合同，不能据此声称用户已可搜索会话工具。会话目录变更目前在重新查询/打开时复核，尚需补齐主动目录变更通知，避免刷新原 Tools 控制器时误取消搜索打开回执。3.1／3.2继续未完成，任务状态仍为6/27。

### 显式会话范围选择

搜索范围选择器新增原 sessions.list 的会话选项，复用安全标题投影，未从 management 的合成 session:root 推导范围。内部 controls.sessionRef 进入查询缓存键和瞬时交接数据；V1类别枚举及持久化筛选schema不变，带会话范围的命名筛选暂不保存。

显式会话范围下，来源请求携带 session/ref；会话元数据仅使用已知完整快照按session ID筛选，不将scope传给不支持它的旧owner。全局窗格和命令不混入结果。清空查询／筛选保留会话，切换到项目或所有项目才移除会话限定。会话移除时选项保留并显示不可用，拒绝自动扩大范围。新目录订阅与已有元数据订阅分别清理，StrictMode验证二者卸载归零。

[133项搜索检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T09-01-05-802Z-2754645/summary.json)通过，5000条本地目录p95为16.90ms。新增用例同时检查原会话元数据隔离、已注册资源scope、查询清空和撤销后失效。类型检查通过。

失败证据保留：[初始订阅计数断言](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T08-52-48-256Z-2677974/summary.json)、[浏览器定位及语言条件](../../../temp/integration-test-runs/ui-visual-2026-09-11T08-55-35-447Z-2706287/summary.json)、[浏览器会话结果丢失](../../../temp/integration-test-runs/ui-visual-2026-09-11T08-57-26-675Z-2722249/summary.json)、[补充回归复现](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T08-59-44-550Z-2741418/summary.json)。最后一项为本轮引入的通用过滤错误：错误地拒绝所有携带sessionRef的候选，已改成比较原session打开目标；修复后133项通过。

会话工具真实宿主仍需严格scope合同，不能用目录范围UI或受控目录数据替代接入验收。3.1／3.2未勾选，任务状态仍6/27。

[33条浏览器路径](../../../temp/integration-test-runs/ui-visual-2026-09-11T09-02-12-080Z-2767026/summary.json)最终全部通过，包含原会话标题唯一结果、清空条件仍保留session范围及owner移除后的不可用状态，并保存session-scope-revoked截图。浏览器使用真实组件和受控会话目录；不证明当前staging支持严格会话工具合同。

### 软键盘可视区域、低高度布局与焦点对比

新增搜索局部visualViewport hook，监听resize/scroll并在卸载清理；只修改当前搜索根元素或其原Modal卡片的自有CSS变量，未修改host尺寸、body样式或相邻Pane。可视区域缩小／偏移及高度≤480 CSS px时，浮层定位于可视区域内，Pane以自身滚动保留可达动作。恢复时移除临时样式并恢复外层scrollTop，内部查询／选择／结果滚动不被重置。分类／筛选紧凑面板复用同一hook。

[39条浏览器检查](../../../temp/integration-test-runs/ui-visual-2026-09-11T09-17-03-784Z-2893837/summary.json)通过，覆盖受控keyboard viewport下的Pane／dialog、原host高度不变、底部滚动可达和恢复，以及960×850物理区域在scale2下480×425 CSS px的200%等效reflow；截图已保存并检查。这些是受控视口与真实Chromium布局测试，不是手机硬件键盘、浏览器工具栏缩放命令或真实读屏软件验证。

浏览器新增检查发现浅色focus对比仅1.907:1及低高度preview返回裁切，见[失败证据](../../../temp/integration-test-runs/ui-visual-2026-09-11T09-14-29-072Z-2871537/summary.json)。搜索及紧凑面板的局部focus token现由既有accent55%与text-primary45%混合，host token保持不变；低高度同样启用搜索内部滚动。最终深浅主题输入文字≥4.5:1、focus≥3:1及preview返回／关闭可达断言均通过。

[134项搜索检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T09-18-04-001Z-2903143/summary.json)通过，5000条本地目录p95=14.46ms，类型检查通过。初轮旧项目撤销用例[5秒超时](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T09-09-03-772Z-2821713/summary.json)未出现产品断言失败；将结果查询限定到既有listbox减少整页可访问名称计算后通过，未放宽超时或删除断言。

2.6尚有明确剩余：结果数量变化及选中项失效的节流读屏播报、完整控件／非文本边界对比矩阵尚未补齐；截图还显示Chromium搜索输入的原生清除按钮与自有清除按钮并存，需统一成一个可访问动作。媒体与来源生命周期仍归其原任务。继续保留6/27，不将本轮视口与输入对比的局部验证升级为全部无障碍完成。

### 结果状态播报与单一清除动作

新增独立SearchResultAnnouncement组件，结果键只用于判断可见数量及选中项是否消失；播报文本不含查询、资源ID、标题或摘要。500ms内合并更新，role=status／aria-live=polite／aria-atomic=true；IME期间清空待播报内容，卸载清理timer。同一上下文内原选中项从可见列表消失才提示，箭头选择其他仍存在结果不触发数量播报。数量明确为当前显示条数，不伪装来源总数。Chromium原生搜索清除装饰已在搜索局部隐藏，保留原具名按钮及清空后输入焦点。

- [135项搜索检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T09-22-44-434Z-2942016/summary.json)通过，5000条目录p95=15.51ms；新增受控计时验证合并、IME、失效提示及timer清理。
- [40条浏览器路径](../../../temp/integration-test-runs/ui-visual-2026-09-11T09-24-36-052Z-2959131/summary.json)通过，新增真实React结果更新、owner移除、polite／atomic属性、清除后焦点与零执行验证，保存single-clear-action截图。

验证覆盖DOM可访问语义和Chromium事件，不声称运行了真实读屏软件。2.6的剩余收口仍需核对整个控件／必要非文本边界矩阵及任务前置能力；本轮不扩大局部证据含义，任务状态保持6/27。

### 会话目录主动失效与首次读取竞态

会话来源新增observe入口，订阅原SessionToolsWorkspace的ready目录变化；失败／不可用状态触发来源失效。相同内容的原Tools刷新不通知，因此不取消正常打开；变更只撤销已签发结果、游标和旧响应，不把legacy观察目录当成严格scope查询数据。未查询会话的观察不会创建来源缓存。首次目录读取尚未完成时，新观察也会使其epoch失效，迟到的旧Skill不会重新出现。

[54项工具客户端检查](../../../temp/integration-test-runs/2026-09-11T09-32-14-460Z-3023114/summary.json)及类型检查／构建通过。新增验证覆盖相同观察无通知、变化后原回执不可用、搜索仍读取严格目录、首次迟到旧资源被丢弃；原客户端注册测试进一步通过真实SessionToolsWorkspace控制器刷新移除工具，确认旧搜索结果被撤销。目录RPC响应仍为受控数据，不代表已部署严格scope合同。

原先记录的“主动目录变更通知尚未接入”缺口在本轮补齐；整体来源偏好及领域资源仍未完成，保持6/27。

下一领域来源盘点：文件owner已有FileTreeProjectionCapabilityV2.search／reveal，FileTreePageV2提供workspaceRef、generation、revision、nextCursor、truncated及节点版本。应直接消费该分页合同。现有ExplorerRuntimeV2.search经桌面bundle的rememberPage仅保留nodes、固定limit200，丢弃完整性及游标，不能把它当成全量文件搜索。文件搜索本身不走legacy fallback；仍须在聚合适配中核验返回workspaceRef、敏感／忽略项、版本、打开回执及当前owner切换。文件／目录与Pinax／Inferrum继续分别登记，不因已有文件接口而勾选4.2。

### 文件与目录名称搜索接入

桌面bundle已注册`dsh.files`，直接消费FileHost的treeV2分页合同，保留workspaceRef、generation、query revision、节点stat版本、cursor和truncated。source只支持名称元数据、relevance下的owner顺序及file/folder分类；未提供时间／标签／正文筛选，未把ID或别名当作已支持字段。空查询使用owner根目录页，profile查询明确partial，不虚构全项目总数。显式workspace不匹配时拒绝，敏感／隐藏／忽略和不安全链接不进入结果。游标绑定查询、范围、owner上下文和revision，最多64条；签发引用最多256条。owner切换、权限失败和版本失效撤销旧引用，重复失败不重复发变更事件形成自动重试循环。

文件打开经原reveal、inspect准入和再次reveal验证，随后将准入proof交给原desktop.file／desktop.preview打开机制，确认实际活动group/tab后才报告成功。查询阶段不inspect、不读取正文、不写入业务数据。目录暂无原Explorer定位合同，元数据可检索但打开标为不可用。metadata stat与inspect内容digest属于不同版本域，分别保留，不作错误等值比较。

实际owner测试定位并修复了自有dsh-file-host的revealV2问题：根文件曾把workspace标识传成父目录file ref；原定位只检查父目录第一页。现在根目录使用正式roots请求，其他父目录沿owner分页找到目标，不绕过opaque ref或fd边界。[初次失败](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911094801Z-3155943/summary.json)及[直接owner复现](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911094921Z-3168800/summary.json)均保留。

使用原Explorer证据脚本的新增可选路径运行：

```bash
node scripts/run-explorer-file-manager-integration.mjs --search-center
```

[最终证据](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911095918Z-3267397/summary.json)：34项原文件Host检查和40项桌面bundle检查通过。真实临时目录包含中文文件、目录和501个填充文件，覆盖原HTTP处理函数→浏览器FileHost→搜索适配的名称召回、owner分页、超过第一页的reveal、inspect及内容变化后拒绝旧打开。另一条注册测试使用原Pane控制器确认desktop.file打开和卸载清理；原Reader的运行宿主浏览器全链尚未验收。两处修改包的类型检查／构建通过，保留已有bundler提示。

本轮仅推进4.2中的file/folder元数据部分。项目引用与文件owner workspace映射、目录定位、document语义分类、Pinax、Inferrum、文件变更watch和正文查询继续留在账本；不将这些缺口降级为已完成。任务状态仍6/27。

### 文件 owner 游标版本、遍历完整性与错误分类

原searchV2的cursor此前只提取offset，未核对格式和revision；query revision仅含refs，无法拒绝元数据变化后的续页。本轮保留字段格式，将revision绑定规范化查询、遍历完整性以及ref／stat版本／名称／可见性标志；无效、跨查询、超界及旧revision游标返回原bad-request合同的409错误，旧游标按过期处理。

未降低既有搜索限额。深度>32、匹配达到20,000且还有未遍历内容、或owner目录页自身被截断时，搜索显式标为truncated并省略精确total。可返回的结果继续保留，零已找到项也不伪装全库无匹配。真实35层临时目录及元数据变化测试覆盖了对应边界。

FileHost transport保留原HTTP status；文件来源将forbidden／401／403归为denied，缺方法／能力归为disabled，无效请求、stale cursor及协议解析错误归为error，网络故障保留offline。新增实际FileHost transport的HTTP403检查，不只测试手造error对象。

[最终验证](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911101109Z-3377776/summary.json)：53项文件Host检查、47项桌面bundle检查通过；两个修改包类型检查／构建通过。原字段、旧入口和其他未提交修改保持，未发布或部署。

目录定位已确认仍需原Explorer接收端与渲染后的确认：现有组件只有本地filter／focus状态，打开Navigator本身不证明目标目录已定位。此项是可继续实现的本地接入工作，不是需要用户授权的外部阻塞；未用裸openView假装完成。整体仍6/27。

### 文件目录定位交接与取消边界

`dsh.files`目录结果现在可通过原Pane Workbench的可选`revealExplorerResource`交接到单例Explorer。文件owner继续核验ref、stat版本、workspace/generation和敏感／隐藏／忽略状态；Explorer接收端请求owner定位后，显示受控breadcrumb和目标目录，等待目标行提交、选中并获得tree焦点后才确认。确认成功才关闭搜索并记录打开；未渲染、超时（3秒）、owner切换、目标Pane离开或版本变化均拒绝并保留搜索上下文。返回复原原Explorer实例与滚动位置。

交接是每个Pane controller的瞬时通道，不进入持久化或业务状态。查询／范围变更取消待完成来源打开；旧来源默认不接收第三参数，只有`cancellableOpen`显式声明的来源才接收AbortSignal。搜索来源registry对声明能力的打开也有本地取消闸门；未声明owner不能被假报为已中止。Explorer未完成操作草稿／预检时导航拒绝且不清空输入；目录定位不inspect正文，根目录无用户焦点时也不自动inspect其他文件。owner运行时替换先清空旧树，再加载新owner根。

[136项搜索检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T11-03-08-984Z-3924067/summary.json)通过，5000条目录p95=16.62ms。Explorer／文件／bundle回归[最终证据](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911112254Z-4181577/summary.json)通过：35项Explorer、53项文件Host、49项bundle检查。搜索相关浏览器路径42项此前通过；新增目录定位／迟到响应路径由[精确2项浏览器证据](../../../temp/integration-test-runs/ui-visual-2026-09-11T11-35-41-601Z-132055/summary.json)通过。全套视觉命令曾误接收行号参数并运行185项，其中其他模块149项通过、36项既有选择／工具路径失败；该结果归为错误调用范围与并发共享产物干扰，不作为搜索验收证据，失败原始证据保留。

本轮构建通过：`ui-pane-workbench`、`dsh-desktop-workbench`；OpenSpec strict和diff检查通过。4.2文件／folder元数据与目录交接已有本地及真实临时owner证据；项目映射、document语义、Pinax／Inferrum、正文搜索和媒体／成果仍未接入，不能勾选4.2或4.6。任务状态仍6/27。

### 项目画布节点元数据接入

新增 `dsh.project-canvas` source，挂在现有 DSH domain Pane plugin 的 creatorStudio owner。它先读取 owner snapshot 取得可信 workspaceRef/projectRef，再用已有 canvasRead 读取当前文档，按节点 title／id 做有界元数据匹配；workspace不匹配返回denied，文档缺失返回offline，不把缺失文档伪装成零结果。结果revision固定为owner canvas revision，打开只生成原 `creator.canvas` Pane request并带 projectRef/nodeId，不保存文档正文、不执行节点动作。

直接Vitest运行的2项画布来源检查通过（本次没有统一证据脚本六件套，因此只作为本地诊断证据，不作为任务验收证据）。客户端类型检查通过。由于当前 domain plugin 的测试 harness没有真实 Pane Workbench search registry，暂未勾选4.1；必须补真实bundle注册与打开回执、项目切换和迟到响应浏览器路径后才可宣称完成。

画布来源已接入真实 domain Pane plugin 的 `paneWorkbench.registerSearchSource` seam。apply harness现在提供creatorStudio snapshot/canvasRead与真实注册入口，新增2项domain apply测试通过；其中1项验证当前workspace下节点元数据检索和卸载注册。由于该测试尚未通过项目统一的integration evidence runner，且未覆盖真实Creator bundle浏览器打开回执、项目切换迟到响应和canvas owner失败恢复，4.1仍不勾选。后续不能拿这组本地测试替代B阶段真实owner验收。

画布来源类型合同已修正为直接使用现有Pane Workbench client类型，`ui-pane-domain` typecheck通过；apply测试仍为2项通过。当前domain plugin真实注册入口已存在，但统一integration证据和浏览器bundle验证仍缺，4.1继续未勾选。

画布来源已纳入统一 Explorer/file integration evidence runner：

```bash
node scripts/run-explorer-file-manager-integration.mjs --search-center
```

[统一证据](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911115149Z-277396/summary.json)通过，包含 domain apply／canvas-source、Explorer、FileHost 和 desktop bundle 检查；本轮新增的 domain 测试证明真实 `paneWorkbench.registerSearchSource` 注册和 creatorStudio owner 查询。仍未覆盖浏览器中已安装 `pane-domain` bundle的搜索结果点击、项目上下文切换和晚到owner响应，因此4.1保持未完成，避免把统一单元／组件证据升级为完整owner场景。

画布浏览器 fixture 已尝试接入现有 visual runner，使用 `case=canvas`、真实 SearchCenterOverlay、source registry 和 creator.canvas 打开请求。首轮浏览器证据失败：source 查询在 fixture 中被聚合器标记为 Source query failed，未宣称4.1完成；失败证据为 `temp/integration-test-runs/ui-visual-2026-09-11T11-57-44-824Z-338931/summary.json`。下一步需从该真实聚合路径定位 source 合同错误（直接source单测已通过），再重跑项目切换与迟到响应浏览器场景。4.1继续未完成。

### 项目画布浏览器验收完成

修正画布来源的scope身份：SearchCenter workspace资源的`projectRef`必须是workspaceRef，真实projectRef保存在opaque资源ref（`project:p1:node:<id>`）和打开metadata中。此前浏览器失败正是registry按workspace scope拒绝projectRef，失败证据保留在[12-01失败记录](../../../temp/integration-test-runs/ui-visual-2026-09-11T12-01-28-635Z-374997/summary.json)。修正后source registry、原creator.canvas打开请求及owner notify均通过。

[2项浏览器画布路径](../../../temp/integration-test-runs/ui-visual-2026-09-11T12-07-06-355Z-431718/summary.json)通过：节点搜索后打开原canvas请求，项目上下文变化触发来源失效且不扩大到其他项目。测试使用真实SearchCenter组件、来源registry和当前代码的画布source；fixture owner只提供受控snapshot/canvasRead，不代表已部署Creator host。统一domain/file证据仍见[dsh-explorer-file-manager证据](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911115149Z-277396/summary.json)。

任务脚本已按浏览器证据勾选4.1；其余领域owner与正文任务保持未完成。整体进度由6/27变为7/27。

画布浏览器路径最终通过后，补充修正了source测试对workspace projectRef身份和opaque nodeId的断言；当前4项domain画布检查全部通过。最终浏览器证据：[canvas owner两路径](../../../temp/integration-test-runs/ui-visual-2026-09-11T12-07-06-355Z-431718/summary.json)。

### A阶段查询生命周期任务收口

按验收范围核对后，2.5已由任务脚本勾选。证据覆盖IME与200ms debounce、generation乱序、AbortSignal、并发来源、分页重复cursor、未知total、offline/denied、30秒timeout、重试、授权证明和存储失败路径；[136项阶段检查](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T11-03-08-984Z-3924067/summary.json)作为任务证据。2.6仍未勾选：浏览器已有触控、reduced motion、200%等效布局、对比度和polite live region，但完整读屏软件、全部控件非文本边界矩阵仍未完成。整体进度由7/27变为8/27。

### Creator Studio 素材元数据来源盘点与首版适配

现有 Creator Studio owner 已提供 `assets(query)` 合同：scope 为 current_project/all_projects，结果含 asset ref、version、kind、title、status、summary、owner/projectRef，状态可为 ready/partial/needs_contract/permission_denied。新增 `dsh.creator-assets` 来源仅消费 current_project 的安全元数据，映射 image/video/audio/subtitle/text-artifact/delivery-package；保留分页cursor和asset version，scope不匹配或owner contract缺失时拒绝／disabled，不读取正文或媒体、不自动播放、不执行生成动作。打开只交给原 creator.canvas owner request并携带ref/version/kind。

2项素材source测试通过，覆盖partial分页、版本身份、owner denied/needs_contract；domain typecheck通过。当前未接入统一真实Creator bundle浏览器和媒体Reader/thumbnail合同，因此4.3不勾选，素材来源适配仍是局部实现。Pinax、Inferrum、字幕正文及完整六类媒体预览仍待各owner合同。

Creator 素材 source 已纳入统一 evidence runner；[统一证据](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911122244Z-597851/summary.json)包含4项domain/asset检查、35项Explorer、53项FileHost和49项desktop bundle检查。素材 source 的owner分页、partial、version、needs_contract和打开元数据边界可追溯，但真实媒体缩略图、Reader版本续读、手动播放和完整六类资源浏览器路径尚未接入，因此4.3仍不勾选。

### 设置入口与兼容入口来源

搜索中心现注册一个独立的`dsh.settings` profile source，使用已有settingsNavigation owner，提供Plugins and Skills、Workspace settings两个稳定入口ID。来源缺少原navigation能力时返回unavailable，不伪造打开；打开只调用原settingsNavigation.open，不执行安装、启停、应用或其他业务动作。旧Pane／command／compatibility-entry路径保持原local catalog与V1身份。

该入口已通过Pane Workbench typecheck，但尚未补统一浏览器场景和完整插件／preset owner目录合同；3.3保持未完成。不能把MCP plugin inventory中投影的mcp-tool条目升级为plugin/preset资源。

设置入口来源加入后，A阶段搜索回归仍为136项通过，5000条本地目录p95=17.88ms。[新证据](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T12-36-23-651Z-791182/summary.json)确认旧V1/local、来源registry、session范围、分页和UI生命周期未受影响。3.3仍只完成设置入口局部适配，plugin/preset目录和浏览器打开路径未达验收。

### A阶段交互与Ordo owner验收补充（2026-09-11）

- 搜索中心视觉验收补充通过：[可访问性与响应式证据](../../../temp/integration-test-runs/ui-visual-2026-09-11T12-56-36-544Z-1020309/summary.json)包含键盘焦点、coarse pointer、reduced motion、keyboard visualViewport、深浅主题对比共7项；[预览与owner交接证据](../../../temp/integration-test-runs/ui-visual-2026-09-11T12-57-12-862Z-1026471/summary.json)包含360/1200px预览、handoff超时、撤权清理和只读打开共5项。
- A阶段最终运行[136项组件证据](../../../temp/integration-test-runs/workspace-search-stage-a-2026-09-11T12-57-52-552Z-1033393/summary.json)通过，5000条本地目录p95=16.03ms；live history owner仍明确标记为未探测。
- Ordo source 新增只读 task/run/approval/verification/evidence 元数据投影与 denied 失败闭合；[统一owner证据](../../../temp/integration-test-runs/dsh-explorer-file-manager-20260911125502Z-995577/summary.json)已包含 Ordo source 测试，未调用批准、重跑或业务写入。4.5据此完成；4.2/4.3仍保留Pinax、Inferrum、媒体Reader/缩略图等未接入缺口。

### 当前任务状态（2026-09-11 最后核对）

`tasks.md` 当前由脚本维护的状态为 **15/27 已完成、12/27 未完成**。文档中早期阶段记录（例如“6/27”）保留为历史快照，不代表当前状态。未完成项仍包括插件/预设、Pinax/Inferrum、完整媒体 Reader、Prompt/Template、History 正文和最终 B/C 阶段验证。
