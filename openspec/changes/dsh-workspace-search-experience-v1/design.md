## Context

演进设计：[搜索中心与分类探索 v2](../dsh-search-center-v2/design.md) 在既有搜索基础上补充八类资源、探索首页与预览。v2 页面与来源待实施；本文件、原任务及交付证据保留历史原义，新设计不把未验证的历史正文搜索计为完成。

截图和当前 Workbench 的目录实现表明：命令、面板、会话分别做字符串过滤后串联渲染，会话结果截取前 30 个；未统一分组或分页。命令可能与面板同目标。已有管理合同支持 AbortSignal、cursor 以及 partial/offline/permission_denied/contract_mismatch；是否接入目标运行时需要实施前验证。

这份计划扩展搜索入口体验，不重做长期历史索引，也不把设计验证当作实现完成。

## Goals / Non-Goals

目标：分组搜索、筛选、可理解的等待与缓存、视觉美化、无重复实例的打开行为、可持续浏览的搜索 Pane。
非目标：浏览器全文索引、跨设备同步、语义／模型检索、自动执行搜索到的命令、复制正文到偏好存储、替换宿主布局 owner。

## Required Capability Ledger

| 能力 | 准入／owner | 交付阶段 | 验收 |
|---|---|---|---|
| 分组、去重、排序、本地匹配 | fit：统一搜索投影 | A | discovery spec |
| 分类和项目等筛选 | fit：统一搜索投影 | A | 组合条件、清除、计数 |
| 视觉与键盘美化 | split-owner：宿主 chrome＋插件描述 | A，随 B/C 补状态 | surface spec 与截图 |
| 历史分页、异步分组 | split-owner：历史服务＋查询适配 | B | lifecycle spec；不可用不计通过 |
| 内存缓存与等待方案 | fit：查询协调器，不拥有正文账本 | B | 时钟、取消、失效测试 |
| 最近使用与筛选偏好 | fit：宿主偏好服务 | A/C | 白名单、失败可用 |
| 固定搜索 Pane、结果拖入布局 | split-owner：搜索投影＋唯一布局服务 | C | open spec |
| 命名常用筛选 | fit：偏好服务 | C | 恢复仅查询、不执行 |

## Decisions

### 1. 入口、分组与去重

保留“添加面板”的旧调用接口，展示可使用“搜索与打开”。默认浮层；“固定搜索”转入一个搜索 Pane，复用同一搜索组件和模型。固定操作迁移当前查询后关闭浮层，不让两份结果争夺键盘焦点；移除搜索 Pane 只释放查询。

空查询按“最近使用（最多 5）、已打开（最多 5）、常用工具（最多 8）”展示，同一实体只占一个位置。无最近记录时省略该组。输入后按会话／面板／命令分组，每组默认最多 5 条，可进入该分类查看全部；分类内只允许再选择一层项目或功能分组。组标题固定，计数未知时写“已找到 N 项”，不将当前页当总数。

类别为“全部、会话、面板、命令”；默认当前布局项目，没有明确项目时显示“所有可访问项目”，不得隐式选一个项目。面板目录通常全局可见，项目筛选约束会话和动作上下文，不隐藏全局工具。已打开是独立筛选。时间仅作用于会话、插件筛选仅作用于工具，切换类别移除不适用条件并以可见标签表达；不可访问的项目不出现在选项。

稳定身份：会话用 owner＋sessionRef；面板用 owner＋viewKind＋resourceKey（适用时）；命令用 owner＋commandId。仅明确声明 open-only 和相同目标引用的命令可合并到面板结果，命令 ID 仍可搜索和显式调用；名称相同而目标不同必须保留。打开过程含额外业务动作的命令不可折叠。

匹配顺序固定：精确名称／ID > 前缀 > token／子串 > 可选的有限拼写回退；显式已打开和近期使用只在同匹配层内加权，最后按稳定 ID 排序。优先复用已有搜索工具，中文子串、中英文别名、代码标识符均测试；拼音不默认声称支持。查询规范化不改原输入或标识符。

兼容视图保留在“兼容与高级”分组，空查询默认折叠；精确 ID 搜索仍可发现，不删除注册或命令。

### 2. 数据流和增量合同

注册器／会话 provider → 安全结果适配 → 查询协调器 → 分组结果模型 → 浮层或搜索 Pane → 已存在的打开／命令 owner。

展示需要 kind、stableKey、title、description、semanticIcon、ownerRef、projectRef、openTarget、availability/reason；字段是设计需求，先映射现有描述，缺失时仅增补可选元数据，不能将这些要求直接改成所有插件必填接口。正文命中携带 owner 审核的 bounded snippet 与 messageRef，实际跳转由原 provider 完成。

旧插件缺少图标时按 view kind 映射；缺少能力来源时显示 unknown，不推测可用。当前 `PaneConversationSearchHostV1` 是单 workspace 请求，所有项目搜索只能扇出到已授权项目（建议并发上限 3）或调用实际可用的官方聚合查询。不能向单项目 API 塞入伪造的全局 ref。

### 3. 查询与等待

本地目录在每次输入后立即过滤；中文 IME composition 期间不发远程请求，compositionend 后再查询。历史请求默认 debounce 200ms。每次关键词、范围或筛选变化生成独立 generation，AbortController 尽力取消；无论 provider 是否支持取消，generation 和 owner revision 不匹配的结果一律丢弃。

来源独立状态：idle/loading/ready/empty/partial/stale/error/disabled/unknown。局部加载不清空其他分组，不抢焦点。缓存可用时立即展示并标注更新中；无缓存仅该分组骨架。快速请求不显示闪烁 spinner，等待超过 150ms 才出现；8 秒仍未完成标注较慢并允许取消，30 秒适配器超时，保留已返回数据，重试仅当前来源。以上为初始交互参数，实施用固定测试时钟验证。

分页 cursor 不透明且绑定完整请求、来源和 generation；查询变更重置 cursor。同页去重依据 stableKey。加载更多由显式按钮触发，读屏和键盘均可用；不预加载所有历史。后台结果保留选中 stableKey，若该项消失选择最近有效项并温和播报。远程返回不能让用户即将按下的 Enter 指向另一条结果。

### 4. 有限缓存与偏好

| 内容 | 存储 | 初始边界 | 失效 |
|---|---|---|---|
| 工具和命令目录索引 | 内存 | 当前注册快照 | 注册／卸载／HMR／locale |
| 查询结果 | 内存 LRU | 最多 32 个查询页、合计 1000 条摘要；TTL 30s，最多 5min 显示旧结果 | scope、profile、权限 revision、owner generation、会话更新 |
| 最近使用 | 宿主偏好 | 最多 20 个稳定引用和时间 | 删除或无权限时不呈现，用户可清空 |
| 筛选／命名筛选 | 宿主偏好 | 最多 10 个命名条件 | project 不可访问时显示失效，不自动扩大范围 |

缓存键包含 profile、权限／owner generation、项目范围、规范化查询、类别、筛选、排序、locale 和 cursor。若 provider 不提供可验证的权限 generation，则远程结果只缓存到当前搜索打开周期；再次打开必须重新授权查询。权限拒绝立即清理该 scope 的缓存，不保留可读旧片段；offline 且原授权仍有效才允许 stale 展示。关闭所有搜索消费者后取消未完成请求，权限变化主动失效。

不持久化搜索词、命中片段、正文或结果集；命名筛选只保存结构化条件，不包含自由文本查询。持久化通过现有偏好 seam，布局中仅保存搜索 Pane 引用。存储失败保留可用界面并提示，不阻止查询。

### 5. 打开与命令

点击／Enter 定位已打开实体或按当前组规则打开；会话临时预览遵循既有规则，拖入和固定成为保留 Pane。会话与轨迹一起打开，不能另起消息账本。显式打开方式菜单提供右侧／下方分屏／悬浮，接入唯一布局协调器。

普通命令结果显示“执行”，具有副作用的命令仍走原 owner 的确认／权限流程。键盘选择、预览、缓存恢复或筛选恢复都不得执行命令。确认失败、资源缺失、未保存保护或打开异常保留搜索上下文并显示原因，不写最近使用为成功。未能选择项目时说明需要上下文。

## UI Contract

- Surface classification: excluded（宿主搜索 chrome）；embed（插件贡献的安全描述），不是绕过视觉检查。
- Surface kind: dialog；固定后 workspace。
- First / second / third visual priority: 搜索输入与当前选择／分组与主要动作／归属、状态和键盘提示。
- Existing components reused: 官方 dialog、input、宿主 token/locale、既有语义图标、搜索匹配 helper、Pane 注册与统一拖拽协调器；插件展示继续 ui-visual-kit。
- Cards that earn existence: 无结果卡片网格；单一容器＋紧凑行。
- Primary scroll owner: 结果区域；搜索、筛选、底部提示固定。

浮层目标宽度 680px、上限 720px，最大高度 min(640px, 视口高度减 64px)，避免当前截图的全高列表。搜索行 44px，结果行默认 48px（触控不低于 44px），标题 13–14px，辅助信息 11–12px；尺寸映射既有刻度。细边框、宿主层级背景、12px 外圆角、轻阴影，去掉高对比常驻白框。右上关闭，底部仅保留操作提示；无内容组不占空间。

结果行左侧语义图标，中间标题和一行截断说明，右侧非颜色独占的状态与动作。匹配文本使用安全文本节点高亮，不拼接 HTML。Hover、active、disabled、focus-visible 分离。危险命令使用图标／文字说明，不大面积红底。深浅与系统主题实时继承 DSH。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 本地目录 | 初始化简短占位 | 无工具或无匹配分开 | 注册来源提示 | 分组行和真实计数 | HMR 更新保留选择 | 插件缺失原因 |
| 历史来源 | 分组骨架＋可取消 | 当前范围无结果 | 单来源错误和重试 | 分页摘要 | 已找到数量／缓存时间 | 权限或合同不可用 |
| 筛选 | 不阻塞输入 | 提供清除筛选 | 条件失效说明 | 可移除标签 | 保留有效条件 | 不适用条件不伪装生效 |
| 打开／执行 | 当前行 busy | 不适用 | 保留查询＋失败原因 | 成功才记最近 | owner 未确认显示 unknown | 不可用且有原因 |
| 偏好恢复 | 本地读取 | 默认布局 | 保存失败但仍可搜 | 最近／命名条件 | 失效项目标注 | 无存储不伪称已保存 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 近全屏，安全区和软键盘可视高度，筛选 sheet | 两侧 16px 边距，筛选折行 | 680px 对话框，结果固定滚动 |

搜索 Pane 按容器宽度而非浏览器宽度适配。200% zoom 不遮挡输入和关闭；软键盘不将当前选中行推到不可见处。

### Accessibility

- Keyboard path: 搜索输入使用 combobox＋listbox 的单一选择模型，aria-activedescendant；上下键跨可见组移动，Enter 打开，右键盘方向键进入动作菜单，Escape 先关闭子菜单再关闭浮层；Tab 访问筛选和固定／关闭按钮。输入光标和 IME 期间不拦截正常编辑。
- Focus owner/return: 浮层陷阱焦点，关闭回触发点；固定为 Pane 后由宿主 Pane 焦点管理，不在非模态页面困住 Tab。结果刷新按 stableKey 保留选择。
- Visible labels and accessible names: 分组计数、项目、状态原因可读；结果 listbox option 内不嵌套可聚焦按钮，动作菜单为独立受控菜单；数量变化 aria-live polite 节流，不逐字符播报。
- Reduced motion and coarse pointer: 过渡 100–140ms，减少动效禁用；触控无需 hover 即能进入动作菜单，不增加拖拽与列表滚动冲突。

### Visual Exceptions

宿主 chrome 使用官方 primitives 与 CSS Modules，不强行将 Yeisme Surface 注入上游；插件贡献描述仍遵循共同 token。回滚到旧搜索 presentation，不删除目录或偏好。以实际 DSH 深浅主题和相邻 Pane 无污染截图验证例外。

### Cross-host Semantics

- Canonical data/action/receipt owner: DSH 会话／历史服务、插件注册器、原命令 owner。
- Same capability in Workbench: 当前搜索浮层与新增搜索 Pane 共用查询模型；不创建第二个历史浏览器。
- DSH role: primary。
- Shared states and wording: provider 状态规范化但保留 reason；未知不显示成功。
- Handoff trigger and target: 显式打开／执行／拖拽 → 原 owner 与 workspaceLayout。
- Semantic differences allowed: 浮层轻量聚合，搜索 Pane 持续浏览；结果身份、权限和动作相同。
- Pixel differences intentionally ignored: 浮层与容器尺寸不同；图标、字体层级与状态语义相同。

## Compatibility and Rollback

Affected surfaces：旧 command ID、view kind、openView/registerView、PaneWorkspaceContextProviderV1、PaneConversationSearchHostV1、持久化字段。分类为 additive：可选描述、适配器和独立版本偏好命名空间；不删除／重命名旧接口。deprecation window：none，本轮不弃用。消费者：宿主目录、插件适配器、搜索 Pane和现有管理入口。

原查询接口不支持筛选时显示明确不可用，不能仅过滤第一页却宣称全库已筛选。全文／跨项目 provider 未就绪只阻塞相应 B 阶段任务，A 阶段可交付；整个计划不能因此标为完成。宿主改动经 upstream-prs；插件协议验证与宿主联合验收分开记录，官方上游合入不是插件门禁。

## Delivery Sequence and Verification

A：身份适配、分组筛选、视觉和键盘一起交付，不先上线裸列表。B：owner probe、异步分页、缓存和等待状态。C：搜索 Pane、拖拽、常用筛选与联合回归。阶段先后不授权任何自动发布，也不授权子 agent。

任务详见 tasks.md；每项先跑关联包测试。稳定后运行项目 Surface／视觉／插件门，最终类型、构建与 bundle 门按改动范围执行。联合证据放在所属项目 temp/integration-test-runs/<run-id>/，包含 summary.json、command.txt、stdout.log、stderr.log、env.json、artifacts/，失败同样落盘，授权 token、真实查询词和会话片段必须脱敏。视觉基线人工检查后才能更新。

目标性能：本地 5000 条安全目录样本，输入到结果 p95 ≤100ms；滚动和方向键不触发每行重复远程调用。测量环境和数据量随证据记录，不以截图宣称性能通过。优先现有虚拟列表，仅在量测证明需要时启用，保留读屏中的正确 item 位置。
