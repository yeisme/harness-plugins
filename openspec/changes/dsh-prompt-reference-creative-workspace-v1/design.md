## Context

本 change 由已确认的 grill-me 决策形成，文档交付后已获用户授权实施。上一轮 `dsh-web-composer-references-theme-v1` 已归档；现有主 spec 仍要求来源证明、会话隔离、发送确认和 V1 兼容。用户此次明确：引用本质是进入提示词的可编辑内容，客户端提供引用外观，不要求普通引用走成果候选／采纳流程。

事实源：现有 Conversation 输入合同、选区动作 registry、`pane-artifact-handoff`、`creator-studio-artifact-composition`、Creator Studio Runtime 和 [统一视觉系统](../../../docs/design/dsh-unified-panel-visual-system.md)。[产品文档](../../../docs/design/dsh-prompt-reference-creative-workspace.md) 提供线框、示例与追踪矩阵。共享工作区存在并行变更，当前方案不将其他任务的改动计为本 change 的实现。

## Goals / Non-Goals

**Goals:** 编辑、展示、预览和发送保持一致；减少重复目标信息和引用占位；覆盖所有既有引用入口；通过既有成果与环境 owner 提供完整创作闭环。工程成果与媒体成果同等纳入最终验收，分阶段交付不等于缩减媒体范围。

**Non-Goals:** 第二套 Composer、客户端领域仓库、自动工具执行、新调度器、跨工作区检索、生产预览环境、专业图层／多轨编辑器、发布部署。实施验证使用隔离测试 profile 和合成内容，不触发付费 provider 请求或改动用户会话。

## Decisions

### D1. 内容、来源和展示分离

新模式中可编辑 Markdown 内容由宿主草稿拥有。引用实例身份用于光标、撤销和发送确认；来源信息保存获取时的安全引用、版本、范围及原始摘要校验信息，只用于追溯，不能替代当前正文。用户编辑后显示“已编辑”，不更改来源证明或伪造新的 owner 摘要。实例的编辑正文与只读原始来源证明分开保存。

采用显式插入标记识别引用块，不从任意 `####`、代码围栏或普通 `@文本` 自动识别引用。显示元信息不混入用户文本；可编辑正文的换行、空白、围栏等在视图切换时原样保留。发送投影以确定的 Markdown 模板补充安全来源标题，再输出当前正文；用户可编辑正文中的标题，不能藉此更改来源权限或能力意图。

单个正文实例单独保存，重复引用可以分别编辑。相同媒体对象版本与相同区域／时间段的实际附件可去重，正文出现次数和顺序保持不变。代码引用模板使用不会与内容相撞的围栏长度；只在未修改的生成模板中调整包装，不将源码切换变成格式化操作。

插入引用前由来源 owner 授权并返回有界内容，目录不递归读取全部文件。文件路径只使用安全显示名或授权相对标识，跨插件交接传 opaque ref；原始正文仅进入授权 Composer／成果编辑边界，不进入共享事件日志或插件领域状态。

**取舍：** 全只读引用不满足自由改写；仅使用无身份的纯文本无法稳定维护折叠、光标与提交清理。因此采用宿主单一草稿内容加轻量展示与来源信息，不新增引用版本账本。

### D2. 固定快照与显式刷新

安全复审补充的实施约束：Host 在授权准备引用时签发有界、可过期的 opaque 编辑 grant，绑定会话、工作区、对象、类型、范围与原始证明；刷新和编辑投影提交均校验该 grant 和当前敏感内容权限，opaque 文件标识本身不充当授权。跨插件事件仅携带安全引用声明，正文只经认证的 Host RPC／私有输入接口和 editor-scoped 命令流转。

Creator 的 `artifact/body` owner 证明增量提供 `contentRevision`，并以完整 UTF-8 正文的小写 SHA-256 作为 digest。新引用解析要求读取回执的 contentRevision 与证明一致、正文摘要一致，且读取前后的 owner 代次、来源证明、完整 context 和工作区成员关系不变。该字段对旧展示投影保持可选；缺少正文版本绑定时不能启用新授权发送。此规则只校验获取时的原始正文，不限制用户后续自由改写。部分字节范围保留 window 并标记 truncated，不能宣称为完整成果。

引用 provider 随 registry、Gateway、workspaceRegistry 的生命周期绑定。卸载先撤销 provider 的可调用状态，再尝试所有清理操作；任一 disposer 失败不能跳过其余 provider、Gateway 和目录清理，错误集中报告。

生成刷新候选不消费当前 grant，取消或晚到响应丢弃后仍保留当前草稿；仅成功提交可消费对应授权，重复请求按原身份确认。grant 过期或容量淘汰提供明确恢复入口并保留用户编辑，不自动替换正文。具体 TTL／容量为实现资源界限，不作为永久存储承诺。

引用插入时固定，来源后续更新不自动替换。来源不可定位与草稿不可发送是不同状态：已授权保存的文本快照在权限合同允许时继续编辑；访问被撤销、旧快照不可授权或媒体不可解析时显示具体限制，不靠复制成普通文字自动绕过校验。

刷新先获取授权新内容，再展示“当前草稿／新来源”差异。确认替换时校验草稿 revision，期间发生编辑则重新展示差异；取消或失败不改草稿。替换是一次可撤销编辑，源文件始终不受影响。自由编辑文本不拿当前文件 digest 校验为原文，原始来源权限与来源证明仍保留自己的作用域。

### D3. 单一 Composer 与无损投影

组件职责如下；这些为组合职责名称，不预先声明新的包或已存在的接口：

```text
Host Conversation / InputState
├─ Target control（当前对话已由宿主清楚标识时复用该处，不加第二条 Target）
├─ Existing editor
│  ├─ Text
│  └─ Prompt reference view ↔ Inline source editor
└─ Composer actions（添加、引用数、预览、既有设置、发送）
Host Pane slot
└─ Creative Surface / Source inspector
   ├─ Preview / Source / Compare
   └─ Owner actions and receipts
```

引用默认标题加三行内容，超出部分截断展示并提供展开；媒体用缩略图或时间段摘要。展开后由当前编辑区域滚动，不再为每个引用嵌套正文滚动容器。全部折叠保留实例位置与正文顺序。编辑动作在同一宿主编辑器事务中进入源码视图；完成恢复展示，Escape 退出编辑视图但保留已输入内容，撤销用于回退编辑；IME 合成时 Escape／Enter 按编辑器既有语义处理。

紧凑模式正文超过可用高度时滚动，用户可显式放大输入区域；展开复用宿主布局能力并保持同一草稿、光标和 undo history。操作栏保持可访问，预览和成果容器不能遮住发送动作。

### D4. 目标、入口和提交

@ 按文件目录、选区、消息、终端、图片、Agent、技能、工具分组，检索当前工作区的授权对象。拖入内容先区分授权资源与本地附件，经既有文件／附件入口处理；不将 DataTransfer 文本自动提升为工具指令。

跨面板请求捕获 workspace、conversation、草稿 revision、光标与请求身份，消费者重验目标，不以最后焦点推断。批量确认时冻结目标；目标关闭需重新选择。添加成功留在来源，回执通知提供跳转；生成中仅追加下一条草稿。

发送预览与实际提交使用同一纯投影与附件解析结果，预览展示用户正文、引用展开内容、实际媒体范围及能力说明，不显示隐藏系统提示词。预览绑定 revision；发送时草稿已变化则重新投影并更新预览，不能提交旧预览对应的不同内容。正文预览不自动截断实际发送内容；有内容上限时明确阻止并提供缩小范围动作。

发送冻结正文、实例 revision、附件与提交标识。ack 仅消费冻结且未被后续改写的实例／文字范围；等待期间修改同一引用也必须保留，不能只保护新追加的节点。已知失败保留草稿，结果未知沿用原请求对账，不自动生成新请求重发。历史记录实际发送投影和附件快照，随后编辑不影响历史。

### D5. 增量接口与兼容矩阵

接口扩展在现有引用、输入和 artifact handoff 合同上实现，精确导出名称由基线任务对应现有类型确定，禁止创建平行协议。

| 扩展面 | 必须表达的最小语义 | 权威方 |
|---|---|---|
| 草稿引用模式探测 | 是否支持可编辑正文、无损视图切换、发送投影 | Host Composer |
| 引用实例 | 当前正文、稳定实例标识、编辑 revision、可选来源与媒体 refs、改写状态 | Host draft |
| 来源获取／刷新 | 授权有界内容、来源版本／范围、结果与失败原因 | 来源 owner |
| prepare／ack | 冻结投影、已提交 revision、附件、原请求身份与消费范围 | Conversation submission |
| 成果 action | 编辑草稿、候选、比较、采纳、写回的 descriptor 与 receipt | 成果 owner |
| 环境预览 | 当前工作区环境、安全显示名、会话访问句柄、状态、启动／恢复 action | Host／环境 owner |

| 输入模式／情况 | 处理 |
|---|---|
| 既有 V1／结构化引用 | 原版本权限、stale、发送及历史合同保持不变 |
| 新模式能力齐全 | 固定正文可编辑，经过显式声明的提示词投影发送；保留来源与附件权限 |
| 新模式未提供 | 显示不可用原因，保留现有 V1 和普通文本入口，不暗中转换现有草稿 |
| 新模式提交失败 | 保留本次新模式草稿，不切换旧接口或拼文本重发 |
| 自由输入标题／@／HTML | 仍是用户文本，不自动升级为引用、工具调用或宿主可执行 HTML |

新模式作为 additive capability 独立启用，旧版“无静默降级”始终成立。归档时将四份新增 spec 同步至主 specs；如将来计划替代旧模式，必须另立迁移 change，不能通过本次 UI 变更重新定义 V1。

### D6. 成果工作台与版本权威

复用 Creator Studio Runtime、Pane artifact intents、已有 Markdown／Mermaid／表格／媒体 renderer 和语义编辑器。客户端只保留临时编辑值和安全投影；自动保存通过成果 owner 的草稿能力完成。能力缺失时明确提示“草稿仅保留在本次编辑中”，离开前保护未保存内容，不伪造持久保存或写入第二个浏览器成果库。

文档、代码、Mermaid、表格和 HTML 可直接编辑；图像提供缩放、框选、批注和基础裁剪；音视频提供播放、时间段标注与基础裁剪。裁剪与 Agent 修改均产出 owner 候选，不覆盖已采纳成果；媒体不增加专业图层或多轨能力。比较使用文本 diff、图像并排／切换、音视频对应时间段切换；不要求音视频同时播放。

候选采纳与写回分别调用当前 owner descriptor，只在成功回执后更新投影。写回显示目标和差异并携带来源版本条件；版本冲突重新比较。unknown、partial、cancel_unknown 等保留原动作身份等待 reconcile，不客户端自动重试。缺少候选、比较、采纳或写回 seam 时列明外部依赖及原因，本产品相应场景保持未验收。

成果再次引用捕获选定版本与范围，发送 `attach_context` intent；目标 owner 授权展开为提示词内容或媒体附件后插入明确草稿。后续编辑引用不反写候选。能力提及、点击预览、添加标注均不自动调度 Agent；用户提交修改动作才进入已有任务与权限流程。

### D7. 开发环境预览

默认使用当前工作区已有的开发／测试服务，无服务时显示 owner 提供的启动 action。服务状态由环境 owner 判断，HTTP 可达不等于应用功能验收成功。显示环境名、工作区、连接状态和安全身份提示；未知身份明确显示未知，不复制宿主 cookie、token 或认证头。

应用通过宿主受支持的 Browser Pane／预览 seam 在独立 origin 与受控容器中运行。目标由 owner 发布，不接受任意 URL bridge，不把生成 HTML 放入宿主 DOM 执行；不绕过 CSP、frame 限制或权限。若不支持嵌入，显示原因并提供 owner 授权的外部开发页面入口，内嵌体验保持待验收。

页面可连接该开发测试服务并进行真实交互，因此 UI 持续显示“开发／测试”，写操作遵守应用自身权限；本 change 不注入生产身份、不自动接生产服务。切换环境使旧连接句柄失效。断连保留成果和编辑草稿，重新连接是读取 owner 状态／受支持的恢复动作，不重新执行上次启动或页面业务操作。

## UI Contract

- Surface classification: 引用块和输入框扩展为 embed；成果面板与来源 inspector 为 adopted；纯投影为 excluded。
- Surface kind: 输入扩展 micro；成果 workspace；来源 inspector。
- First / second / third visual priority: 当前内容与明确目标；引用／成果与主要操作；来源、版本、状态与次要操作。
- Existing components reused: 宿主 editor、Button、Menu、Modal、Pill、DiffBlock；ui-surface、ui-visual-kit 与既有媒体／结构化内容 renderer。
- Cards that earn existence: 可整体操作的引用块和独立媒体／版本预览；普通列表、说明、空态不另套卡片。
- Primary scroll owner: 对话归 Host；输入正文单一滚动；成果正文单一滚动，源码／媒体专业视口按规范独立滚动。无每条引用的多层滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 发现／插入 | 保留查询与目标 | 无结果与筛选说明 | 原因、合法重试 | 添加通知及跳转 | 范围不完整先说明 | 无目标／无权限原因 |
| 引用编辑／刷新 | 保留当前正文 | 空正文可编辑 | 草稿不变 | 更新展示、可撤销 | 对比后显式刷新 | 缺来源能力仍保留草稿 |
| 发送预览 | 解析附件状态 | 沿用空消息规则 | 定位问题项 | 展示本 revision 实际内容 | 超限／失效不静默删项 | 缺发送能力原因 |
| 发送 | 锁定本提交，允许下一草稿 | 不适用 | 保留草稿 | 按 ack 消费 | unknown 对账，禁止重发 | 问题引用未修复 |
| 成果／版本 | 显示已有安全内容 | 尚无成果及可行入口 | 保存失败保留编辑 | owner 确认候选／采纳 | partial／冲突要求处理 | 缺 descriptor 原因 |
| 开发预览 | 连接中与环境名 | 未运行，显式启动 | 断开／嵌入失败原因 | ready 与身份提示 | 状态未知不标 ready | 无环境权限／seam 原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 对话／成果切换，工具条主动作＋更多，引用三行或折叠 | 单栏默认，可展开编辑；来源与成果复用详情视图 | Host 有足够可用宽度时对话＋侧边成果两列，否则保留视图切换 |

依据容器宽度，不依赖全局 viewport 强制分栏；可用宽度不足以容纳两个各 360px 内容区及宿主间隔时使用单视图。360/560/960px、200% zoom、长名称均不得裁切主操作。输入框展开和成果放大均通过宿主能力，不修改插件外的 Pane 几何。

### Accessibility

- Keyboard path: @ → 分组 combobox → 方向键／Enter 插入 → Tab 到引用动作 → 编辑／完成；Escape 关闭弹层并归还焦点。IME 期间不触发候选确认或发送。
- Focus owner/return: Host primitive 管焦点；跨面板插入保持来源；关闭来源预览返回引用触发项；视图切换恢复阅读位置和草稿 selection。
- Visible labels and accessible names: 目标、来源、已编辑、展开、刷新、删除、环境、状态均可读；中文／英文／pseudo locale 走现有字典。
- Reduced motion and coarse pointer: 复用现有 motion token，reduce 关闭非必要位移；触屏关键目标至少 44px，唯一动作不依赖 hover。

### Visual Exceptions

无。唯一视觉依据为项目统一视觉系统；不增加颜色表、字体栈、portal 或 z-index 体系。浅色／深色／跟随系统由 Host 唯一拥有，第三方页面不强制换肤。

### Cross-host Semantics

- Canonical data/action/receipt owner: Conversation 拥有草稿／提交，成果与环境 owner 拥有持久状态和动作回执。
- Same capability in Workbench: 复用既有 artifact handoff；本 change 不复制 Workbench UI 或领域账本。
- DSH role: primary（交互前台），领域动作通过 owner。
- Shared states and wording: ready、running、stale、partial、unknown/reconcile 与现有 locale 一致。
- Handoff trigger and target: 显式打开、修改、再次引用、采纳、写回；每次绑定目标与原 action identity。
- Semantic differences allowed: 显示布局可不同，授权、风险和回执语义相同。
- Pixel differences intentionally ignored: 第三方内容、外部开发页面及其他宿主内部样式。

## Migration Plan

1. 先完成来源／草稿／投影增量合同与能力探测，旧模式保持原行为。
2. 文件／选区贯通编辑、预览、发送和历史，再扩展其他引用及成果类型；每阶段独立验证。
3. Host 变更通过独立 `upstream-prs` 补丁，记录基线、前置补丁、apply 检查和协议结果。没有 seam 不以 DOM 注入代替。
4. 成果与开发环境逐项 probe，缺失外部能力登记为实施依赖；不得以 mock 关闭真实产品验收。
5. 回滚关闭新能力注册并回到旧入口；新模式已有草稿保持可恢复且不自动重解释，历史继续读取冻结投影。旧版客户端无法编辑的新草稿须明确提示兼容限制，不能静默丢失。

## Risks / Trade-offs

- [可编辑正文被误当成来源证明] → 原始来源与当前正文分离，编辑标识和反例测试覆盖。
- [源码／渲染转换修改围栏与空白] → 保留单一正文，仅派生 HTML；使用多种语言、嵌套围栏、长文本和 IME 往返测试。
- [发送等待期间改写同一节点被清空] → ack 比较冻结 revision，保留所有未提交修改而非仅新增节点。
- [媒体／候选服务能力不足] → 显式 owner 依赖账本；协议完成与产品运行验收分开，缺少范围不视为完整交付。
- [运行页面具有真实副作用] → 开发测试环境标识、独立执行容器、现有权限与显式服务启动，不把预览可达当成功。
- [并行工作污染检查] → 限定文档路径，验证结果区分本变更、既有问题与并发改动。

## Open Questions

产品决策已确认，无待用户选择项。具体运行 Host 版本、可用候选／写回／环境 descriptor 和能力导出位置属于任务 1.1–1.3 的技术核验，不在文档阶段假称已支持。发现能力缺口需记录 owner、缺失操作、依赖交付物与受影响验收项；用户要求的真实 Web 完整可用目标不因此自动缩减。


### Creator 图片授权读取增量

`CreatorOwnerAdapterV1.readArtifactImage` 为可选 Host 内部能力，返回 ArtifactRef、contentRevision、固定 image MIME 和 Uint8Array；旧 adapter 无此方法时图片发送保持不可用。`CreatorStudioGateway.readArtifactImage` 仅供同进程授权解析，不能带 Remote 装饰器或加入 Typert invocation。共享 snapshot、浏览器 preview 和日志不得承载二进制正文。

图片 proof 延用 contentRevision；artifact/media 的 digest 表达完整原始资源的 lowercase SHA-256。resolver 先验证完整上下文与所选版本的 proof，再读取并复制字节、核对版本／类型／revision／摘要，最后重新核对 owner generation 和权限。接入层最多接收 16 MiB，拒绝共享内存与空资源；最终 Host attachment owner 继续执行自身大小、像素、MIME 和解码门禁。框选坐标只作为明确的 image-region 范围传给现有 deriveImageRegion，普通 image 不接收隐藏区域，任一失败不降级。此增量不宣称音视频附件能力存在；音视频仍需 Host 与模型接收端单独能力协商。
