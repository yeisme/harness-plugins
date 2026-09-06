## Context

设计依据：docs/design/dsh-unified-panel-visual-system.md，以及既有 dsh-session-status-center、dsh-token-usage-ledger 和 dsh-token-usage-panel 主规范。

只读检查发现：

1. command-experience-core/src/inspect-resolve.ts 的 switch 缺少 status，默认返回 no inspect resolver for status。
2. ui-token-usage/src/client/index.ts 只在 apply 时探测 paneWorkbench；非 ready 控制器状态没有向面板传递具体错误。
3. ui-token-usage/src/client/controller.ts 的余额刷新可能忽略非 ready 状态下的成功结果，并吞掉异常。
4. dsh-token-usage/src/ledger.ts 的 currentSession 来自 lastActivityRef，bySession 默认只返回 20 条。该接口不能用来发现完整会话列表或定位当前 Pane。
5. dsh-token-usage/src/index.ts 当前余额凭据入口只读环境变量；service.ts 用最近 provider 选择余额路由。
6. 官方 token-meter 有投影、流式与最终用量测试，但完整请求账本、分叉归属和历史覆盖能力仍需通过 owner 合同验证，不能仅凭模块存在声明可用。

## Goals / Non-Goals

目标：/status 可执行；整个 session 的可验证消费统计；同一会话在小插件、Popover、Pane 和轨迹中身份一致；刷新、重启、HMR 后不重计，缺失数据可解释。

非目标：第二份消息/任务/计费账本、新 tokenizer、浏览器解析会话日志、自动发送模型请求、自动 compact、余额充值、付费生成、跨设备同步，以及重做宿主 Pane 几何。协议门完成后仍不得把缺历史 owner 的 capability 勾成“完整会话功能已验证”。

## Capability Ledger

| 能力 | 判定 | Canonical owner | 本仓责任与完成证据 |
|---|---|---|---|
| /status、/status tokens | fit | 既有命令 owner | resolver、适配与 command result；不能落入模型发送 |
| session 状态及 context | split-owner | DSH session/runtime/tokenMeter | 只读状态投影、缺失原因和一致 UI |
| 完整 session 消费 | split-owner | DSH 历史与请求用量 owner | query 聚合；要求历史覆盖和去重身份的合同证据 |
| 小插件展开与订阅 | fit | 插件；宿主负责布局/焦点 | 晚到、卸载、重连、HMR 与 session 绑定测试 |
| 轨迹定位 | split-owner | 官方会话 renderer | 安全 session/request ref 导航，缺失时说明原因 |
| Provider 余额/配额 | split-owner | 对应 Provider 与宿主凭据 owner | 独立 adapter；不把某一账户余额解释为会话消费 |
| 新建账本、抓浏览器密钥或自行估算缺失 Token | reject-now | 不属于插件 | 明确禁止 |

## Decisions

### 1. 入口共享，绑定明确

/status 无参数复用已发布 Popover → workspace.session-status Pane → 有界安全文本链。/status tokens 打开 workspace.token-usage 并传入 sessionRef；未知子命令返回支持的语法，不尝试模型补全。两者走既有 command lifecycle；结果不进入模型历史。完成反馈分别说明表面是否打开与数据是否可用，不能把导航成功当作完整统计成功。

发起时冻结 sessionRef、workspaceRef（可用时）、command correlationId。异步期间焦点切到其他 Pane 不改变目标。只有原 session 的 Popover 能满足降级链；如果只有另一会话的 Header，应打开原 session 的 Pane。没有会话时说明“请先选择会话”，不能借用最后活动会话。

Tokens Header 保留紧凑入口；点击显示本会话摘要，显式“展开统计”进入 Pane。/status tokens 直接进入详情。目录入口先选择会话。统计 Pane 默认固定绑定，每个 session 最多一个统计实例；同会话不同筛选复用，切换统计对象必须显式操作。选择器使用官方可访问会话目录及分页，不能使用旧 bySession 的前 20 条替代。

### 2. 扩展既有服务，不增加数据所有者

数据流：官方 session/request/history/context 来源 → Host 安全归一化 → 既有 token/status 服务 → 版本化 query / 变更订阅 → 共用 view model → 胶囊、Popover、统计 Pane。

不新建独立 daemon。Host 只保存可丢弃的聚合缓存；浏览器只保存表面偏好和引用。完整消息、原始 provider payload、凭据及请求正文不进入统计缓存、wire、DOM 或证据。历史只能经官方授权读取接口获得，不直接读私有日志文件。

在旧 tokenUsage Remote 上增量提供可选 query(input)，新结果使用独立 session.insights.snapshot.v1alpha1 形状；旧 snapshot()、refreshBalance() 及 token.usage.snapshot.v1alpha1 不变。发布前以 capability probe 判断是否支持，不通过调用不存在方法猜测版本。现有 sessionStatus.snapshot({ sessionRef }) 保留状态 owner；组合失败时分别呈现子状态。命名空间挂载和能力声明沿用受支持的 Typert contribution；实时订阅能力与 query 分开探测，无流式 seam 时只支持明确标注的手动刷新，不用持续轮询伪装实时。

### 3. 查询合同

以下为待实现的合同，不是已可执行的 API。

| 输入 | 约束 |
|---|---|
| sessionRef | 必填 opaque ref；Host 每次校验访问权限 |
| scope | session（默认）、run、range；run 要求 runRef，range 要求 from/to |
| runRef | 必须属于该 session；不靠“最近运行”补齐 |
| from/to、timeZone | ISO 时间、半开区间 [from,to)；时区用于日历展示及今日/本周边界 |
| includeDescendants | 默认 false；只有 owner 提供权威关联和去重身份时可启用 |
| cursor、limit | 明细默认 50、最大 200；不改变整个范围的聚合总数 |

结果包含 schemaVersion、sessionRef、query scope、revision、generatedAt、freshness、coverage、source、totals、context、byModel、byProvider、requests、nextCursor、truncated 及 reasonCode/safeMessage。各子源可独立 unavailable；未知数字用 null 或明确缺席，不能以 0 补齐。固定 provider/model 摘要最多 50 行并显示截断；未展示行仍包含在已验证 totals 中。

coverage 至少区分 complete、partial、unknown，提供已知请求数、缺用量请求数（可确定时）、可用时间区间、缺失原因；只有 owner 确認范围完整且请求已归一化时才能为 complete。freshness 是时间新鲜度，不代替完整性。空范围只有在覆盖完整且确定无请求时才能显示 0。

明细 cursor 绑定 session、筛选及 snapshot revision；版本变化时返回 stale_cursor，客户端保留当前内容并提示重新读取第一页。分页读取不启动运行。大范围历史异步聚合，返回进度与 partial，禁止阻塞事件循环或一次传输整个会话。验收至少覆盖 10,000 条模拟请求和 200 行 wire 上限。

### 4. 用量与费用口径

- 消费按 owner 的逻辑请求/attempt 身份归一化。重发事件幂等；同一 attempt 的流式增量与最终累计不能双计；不同 retry attempt 各计实际消费。
- 非缓存输入、输出、缓存读取、缓存写入只有确认互斥后才求和。Provider 把缓存包含在 input 中时由 Host adapter 归一化；语义未知则标记 partial，不猜测减法。
- 缓存重分类即使总数不变，也必须更新各桶。最终用量修正可增可减并提升 revision；历史重放、HMR、重复订阅不能再次累计。
- 上下文压缩、消息隐藏和截断不抹掉已经发生的消费。若官方聚合仅代表当前可见上下文，该来源不能冒充历史消费；缺少请求历史 seam 时整段消费标记 unavailable/partial。
- fork 中继承的历史可单独显示，但不作为新会话新消费再次计费；项目聚合按权威请求身份去重。无归属证明时不提供合并总数。
- 子 Agent 默认分列且不包含在直接消费中；有 owner 关系及全局请求身份时才提供合并值，禁止再次叠加父会话已包含的部分。
- 取消/失败请求有 owner 用量就保留，无用量则未知。运行耗时与请求耗时之和分别展示，不能把并行请求耗时相加当墙钟时长。
- 新查询的今日/本周按请求实际发生时间归属，缺时间戳不归到今天；重启不迁移历史窗口。旧 process/today/week 接口继续原进程观察语义，UI 明示“旧版进程观察统计”。
- 费用分为 provider 结算值、基于有来源/生效时间/币种的价格快照估算、未知。没有价格来源不估算；不同币种不直接相加。
- 余额与配额使用独立账户引用和权限，复用宿主凭据解析，保留环境变量兼容。不把余额变动推断为某 session 成本；不把金额换算为上下文或周期配额。

### 5. 生命周期与恢复

共享数据绑定按 sessionRef + 查询范围 + 身份作用域去重；一个目标的多个表面共享订阅，最后消费者卸载时释放。首次先订阅版本通知，再读带 revision 的快照；读取期间有更新则补读，避免启动间隙丢事件。变更最多每 250ms 合并一次，不发起模型调用。

每次查询记录 generation；切换对象、关闭、权限撤销后取消读取或丢弃迟到响应。HMR/provider replacement 先释放旧订阅再绑定新 source；普通 transport 恢复只重读权威只读快照，不重放命令、余额查询或模型动作。数据错误重试必须显式，保留旧值并标 stale。

用量加载/重试与余额刷新独立。查询余额需要显式动作、当前支持的账户和宿主凭据；失败显示原因，不吞异常，不因 token 子状态非 ready 而丢掉余额结果。无余额能力时保留用量面板，并禁用余额刷新且解释原因。locale provider 晚到或切换时重算译文。

### 6. 轨迹联动

请求行只携带 opaque sessionRef、runRef、requestRef/attemptRef 或 owner 提供的 eventRef。点击后定位已有 session Pane 内的官方 Trajectory，不创建脱离 session 的轨迹账本。目标不存在或定位 seam 不支持时保留统计位置并说明原因；不跳转其他活动会话，不暴露原始路径。

### 7. 考虑过的替代方案

| 方案 | 决策与原因 |
|---|---|
| 给旧 snapshot() 换成全历史总数 | 拒绝：改变已发布进程语义；新增查询可回退 |
| 客户端扫 DOM 或运行 tokenizer | 拒绝：不能证明真实消费，也破坏 owner 边界 |
| 新建独立统计数据库/服务 | 暂不采用：先复用权威数据与可丢弃缓存，避免第二账本 |
| 每个小插件各自查询与订阅 | 不采用：会导致多 Pane 重计、请求竞争与状态不一致 |

## UI Contract

- Surface classification: 统计 Pane adopted；胶囊和紧凑入口 embed；Host/纯投影 excluded。
- Surface kind: 统计 Pane inspector；Popover micro，受宿主原生焦点与定位能力管理。
- First / second / third visual priority: session 与范围；用量和完整性；模型/请求明细及恢复动作。
- Existing components reused: ui-surface 的 SurfaceContextBar、SurfaceSection、SurfaceState、SurfaceActionBar；ui-visual-kit tokens；官方 Button/Input/Menu/Popover 或 Modal；现有状态 view model。
- Cards that earn existence: 无 KPI 卡墙；概览使用一行指标，余额为独立可刷新的账户区块，普通列表不套多层卡。
- Primary scroll owner: Pane 内容区；明细分页，Popover 不嵌套表格滚动。

默认“整个会话”，顶部单一上下文栏包含会话、范围、freshness/coverage 与刷新。正文顺序为概览、用量构成、模型/Provider 分布、分页请求列表；context 明确为单独指标。余额与价格依据折叠在次级区，不抢占主视觉。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| /status | 命令 pending | 无会话提示 | 安全文本与失败结果 | 对应表面打开 | 保留可用事实及原因 | 缺命令 owner 时解释 |
| 用量 | 首次骨架；保留旧值 | 已确认无请求显示 0 | 紧凑错误条+重试 | 指标与明细 | 明示范围/缺失；旧值标过期 | 缺历史能力不显示版本猜测 |
| Context | 单独读取状态 | 未形成上下文 | source 错误 | used/limit/remaining | 缺 limit 则不用百分比 | 不支持时显示未知 |
| 余额 | 单独 busy | 尚未查询 | 具体原因且保留旧值 | 币种/金额/时间 | 陈旧金额不作实时值 | 非支持账户解释且禁用刷新 |
| 请求明细 | 分页加载 | 范围内无请求 | 保留已有页 | 可定位轨迹 | stale cursor 提示重读 | 缺定位能力显示原因 |
| 目标切换 | 目录加载中 | 无可访问会话 | 目录读取失败+显式重试 | 显式选择后重新绑定并重读 | 迟到旧对象回包按 generation 丢弃 | 目录 seam 缺失时禁用并说明，目标保持固定绑定 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 紧凑指标换行；请求列表为标签值行，详细字段展开；Popover 使用官方窄屏表面 | 两列指标；模型和时间列次级展示 | 紧凑概览+分页表格；不增加永久 rail |

### Accessibility

- Keyboard path: /status 提交 → 摘要 → 展开统计；Tab 遍历筛选、刷新、请求行与轨迹动作，全部按钮有语义名称。
- Focus owner/return: Popover 由原会话触发点持有，Escape 返回原输入；Pane 焦点交给宿主；被卸载触发点回退至同会话标签。
- Visible labels and accessible names: 中英文、单位、范围、统计覆盖与估算标签始终可读；图表提供数值文本等价。
- Reduced motion and coarse pointer: 不滚动数字、不强制动画；44px 触控命中区；更新公告合并，避免 aria-live 连续播报。

### Visual Exceptions

无。遵循项目视觉系统，不修改宿主主题、全局 CSS、Pane 几何或自建 portal。

### Cross-host Semantics

canonical data/action owner 为 DSH 和 provider；Workbench/其他宿主可消费同一安全投影，保留 complete/partial/unknown、费用来源和恢复语义。像素尺寸可随宿主变化，消费口径与 session 绑定不可变化。

## Compatibility and Migration Plan

| 表面 | 分类 | 兼容方式 |
|---|---|---|
| /status | 实现修复 | 保留既有命令身份、事件和结果不入模型历史规则 |
| /status tokens | additive | 增加明确子命令，不抢占现有其他命令 |
| tokenUsage Remote | additive | 新增可选 query 能力与独立新 schema；旧两方法不改签名 |
| 旧 currentSession/today/week/process | 保持 | 新 UI 不依赖其推断当前会话；仍标注旧观察口径 |
| Pane、Header、DOM 标识 | 保持 | workspace.session-status、workspace.token-usage、token-usage-open 保留；新实例按 session 定位 |
| 小插件绑定字段 | additive | 可选 sessionRef/query 范围，旧调用保留原全局进程视图 |
| 存储 | 无破坏性迁移 | 不复制旧进程聚合为全历史；保留现有布局与偏好 |

先实现 typed probe 和 pure query/view-model，再接入 owner 数据与 resolver，最后迁移入口。旧客户端+新 Host、新客户端+旧 Host、新新组合均需测试。旧 Host 回退显示旧观察统计或明确缺失；协议降级通过不等于完整 session 统计通过。

本轮不移除接口，因此无需启动删除窗口；未来移除必须另立 change，至少一发布周期弃用期并迁移消费者。回退时停用新入口/新 query 适配并恢复旧 bundle；保留会话与偏好，新可丢弃缓存可忽略，不要求改写业务数据。

## Risks / Trade-offs

- 历史 seam 无法证明全覆盖 → 返回 partial/unknown，登记 owner 阻塞，不用进程数据冒充 complete。
- 各 provider 桶语义不同 → 每个 adapter 建归一化 fixture，未知模型只报可证明事实。
- 多窗口/热更新竞争 → revision + generation + 有界共享订阅，测试迟到回包和卸载。
- 价格和账户信息敏感 → 默认不查询余额，不读/输出真实密钥；价格不新鲜时不给精确费用承诺。
- 同仓并行改动 → 实施只修改声明的 owner 包；门失败先区分 introduced、pre-existing、concurrent、environmental。

## Validation and Evidence

复用现有 Vitest、Testing Library 和 Playwright 体系，不另建测试框架。unit 覆盖解析、桶归一化和去重；integration 覆盖官方 adapter 测试源、Remote、controller 与分页；组件覆盖可访问状态与双 session 绑定。浏览器夹具覆盖 /status → 摘要 → 整段统计 → 同 session 轨迹，以及 360/560/960px、200% 缩放、中英文、触控、焦点、减少动效和相邻样式隔离。

协议门为本仓完成条件；真实 DSH canary 单独记录，不要求官方合入，不把宿主实现纳入插件代码责任。缺历史 owner 的 capability 仍标记未验证，不能因为协议门绿而勾选“完整会话功能已验证”。任何真实模型调用、余额线上查询或外部写入不在默认测试内。

所有 integration/component/e2e 入口通过项目 runner 生成 temp/integration-test-runs/<run-id>/，至少有 summary.json、command.txt、stdout.log、stderr.log、env.json、artifacts/；失败保留证据和原退出码。记录 scope/revision/coverage、预期与实际聚合、订阅计数、命令事件和截图；严格排除凭据、正文、provider payload、私有工具参数和绝对路径。快照更新前人工检查合理性。

稳定后运行现有命令：

~~~bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check:bundles
pnpm run check:surfaces
pnpm run test:visual
pnpm run check:plugins
openspec validate dsh-session-insights-and-status --strict --no-interactive
~~~

## Open Questions

没有等待用户决定的产品问题。实施前需要核实以下 owner 事实，并记录 capability 结果：完整历史读取的 revision/cursor 保证；跨重试/分叉/子 Agent 的权威 request identity；原生轨迹定位入口；账户凭据与价格来源。缺失项经 upstream-prs seam 请求处理，不扩大成 core fork，也不偷换统计口径。
