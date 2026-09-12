## ADDED Requirements

### Requirement: 严格会话目录范围采用可选owner合同
新会话搜索 SHALL 显式请求原owner确认范围，SHALL 仅接受scopeResolved:true的目录。原未请求严格模式的调用 SHALL 保持兼容；目录可见性、预设解析和完整性仍由原owner决定。

#### Scenario: 严格模式无法解析预设
- **WHEN** 会话搜索要求严格范围，但预设无法解析或缺少必要解析服务
- **THEN** owner不返回global目录冒充会话结果，客户端保留所选范围并显示不可用

#### Scenario: 严格Skills目录只有部分provider完成
- **WHEN** 范围已解析但原Skills snapshot不完整
- **THEN** catalogComplete保持false，搜索不得声称全库筛选、完整排序或精确总数

### Requirement: 显式Skill正文通道与目录隔离
Skill正文读取 SHALL 使用原owner授权的独立内容通道，不进入目录快照或搜索查询缓存。初始profile文件型读取 SHALL 校验原目录来源，返回有界正文与版本身份；未接通的会话、runtime来源、引用解析和阅读UI SHALL 保持明确未接入。

#### Scenario: 版本化正文续读
- **WHEN** 用户显式读取已安装Skill正文并继续读取截断内容
- **THEN** 每段不超过256KiB或5000行，游标绑定资源与版本；版本或来源变更时拒绝旧续读，不混合正文，不执行Skill

#### Scenario: 读取过程中权限或owner变化
- **WHEN** 原owner撤销访问、被替换，或用户取消读取
- **THEN** 不交付迟到正文，不暴露内部路径或错误详情，且不自动重试执行动作

### Requirement: 搜索中心与快捷浮层共享语义
搜索中心与快捷浮层 SHALL 使用同一结果身份、查询范围、筛选、来源覆盖和打开规则，SHALL 保留既有 `workspace.search` 与搜索 Pane 单例身份。形态切换 SHALL 由用户显式触发。

#### Scenario: 从浮层继续到已有搜索中心
- **WHEN** 用户在浮层输入查询、设置筛选、选中结果后选择“在搜索中心继续”
- **THEN** 复用已有搜索 Pane，移交查询、范围、筛选与选中 stableKey；交接成功后关闭浮层并聚焦中心，不留下两个键盘 owner

#### Scenario: 交接失败
- **WHEN** 搜索 Pane 无法打开或接受当前上下文
- **THEN** 保留浮层及查询并显示原因，不清空既有中心或记录成功访问

### Requirement: 分类账本覆盖完整资源范围
系统 SHALL 提供会话与历史、项目与工作区、文件与知识、素材与成果、提示词与模板、工具与能力、任务与执行、窗格与操作八个一级分类，并保留 design 中35个二级资源的能力账本。分类 SHALL 最多两层；最近、常用、已打开 SHALL 是快捷视图，项目和来源 SHALL 是筛选。

#### Scenario: 首次使用且无最近记录
- **WHEN** 用户打开空查询搜索中心且没有使用记录
- **THEN** 展示分类探索入口，省略无记录的最近组，不制造热门资源、使用频次或资源数量

#### Scenario: 来源尚未接入
- **WHEN** 选择一个没有查询适配的设计分类
- **THEN** 显示待接入与该类可搜索目标的说明，不发伪查询、不显示零结果；提供已存在的原 owner 导航时必须使用真实入口

#### Scenario: 分类层级与资源身份分离
- **WHEN** 同一资源符合文档和成果两个分类，或从最近切到全部
- **THEN** 保持相同稳定身份；只有 owner 明确的等价引用才能合并，同名不同来源或不同正式版本保持区分

### Requirement: 搜索表达实际能力与授权范围
每个来源 SHALL 声明实际目录、元数据或正文覆盖、授权范围、支持的筛选排序、分页及预览打开能力。未知能力 SHALL 不视为可用。全工作区 SHALL 仅指当前身份可访问范围，不含未经授权的其他 profile 或任意远端数据。

#### Scenario: 会话快照仅支持标题和ID
- **WHEN** 结果来自 `sessions.list` 标题／ID适配且snippet为标题
- **THEN** 界面标明元数据匹配，不声称历史正文命中、归档完整性或消息定位

#### Scenario: 请求项目范围但来源没有可信项目映射
- **WHEN** 用户选择当前项目且某会话来源不能限定该项目
- **THEN** 该组显示不支持项目范围，不返回未筛选的所有会话，不构造伪global引用

#### Scenario: 工具目录覆盖不完整
- **WHEN** MCP工具目录可用而资源目录或Skills目录失败
- **THEN** 保留已成功工具并标记部分覆盖，不把tools/list等同于resources/list，也不把缺失来源记为零条成功

### Requirement: 筛选排序不得伪装为全量生效
搜索 SHALL 显示当前scope、已应用筛选及来源覆盖。筛选和排序 SHALL 在完整可处理快照或owner能力下应用；不支持的来源 SHALL 明确限制，SHALL NOT 仅过滤第一页后宣称全库有效。跨来源 SHALL 使用固定分类顺序，不直接比较异构score。

#### Scenario: 选择时间筛选
- **WHEN** 用户要求按更新时间筛选且部分来源无该能力
- **THEN** 支持的来源应用条件，不支持的资源组不给出未筛选样本；全局窗格目录标明不适用，范围仍清楚可见

#### Scenario: 切换分类移除不适用条件
- **WHEN** 用户从图片切到工具并保留查询
- **THEN** 移除图片特有条件并提示，保留有效项目／来源范围，不静默扩大搜索权限

#### Scenario: 聚合视图选择名称排序
- **WHEN** 所选来源具备完整名称排序能力
- **THEN** 按各组内名称排序并明确说明，不将已加载页的局部排序表现为全库跨来源排序

### Requirement: 来源生命周期保持结果与焦点稳定
查询 SHALL 复用IME保护、200ms debounce、AbortSignal、generation防乱序、有界并发、来源独立状态和分页。来源延迟或失败 SHALL 不清空其他成功结果。未知总数 SHALL 使用已找到数量。

#### Scenario: IME期间及旧查询迟到
- **WHEN** 用户中文输入尚在composition，随后更换查询且旧请求晚返回
- **THEN** composition期间不发远程查询，旧generation不覆盖新结果、计数、预览或选择

#### Scenario: 旧分页与重复页
- **WHEN** 用户改变范围后旧cursor页返回或同一页重复返回
- **THEN** 丢弃旧范围页，并按稳定身份去重当前页；不把已加载数量当精确总数

#### Scenario: 文件 owner 查询版本变化
- **WHEN** 文件搜索cursor格式无效、用于另一查询，或结果元数据在两页之间变化
- **THEN** 文件owner拒绝该cursor并要求从第一页刷新，不返回混合查询／版本的后续页；客户端保留查询并区分错误与离线

#### Scenario: 文件遍历达到既有限制
- **WHEN** 文件owner的既有深度、匹配数或目录扫描限制使遍历不完整
- **THEN** 返回truncated且不声称精确total，即使已找到零项也不得声明全库无匹配

#### Scenario: 异步结果改变排序
- **WHEN** 其他来源返回使列表增加行而用户已选中结果
- **THEN** 保留选中stableKey及其激活目标；结果消失才移动到最近有效项并温和播报

#### Scenario: 单来源超时
- **WHEN** 来源超过30秒未完成
- **THEN** 结束该次等待、保留其他来源结果并允许单来源重试；较慢提示与取消不阻塞本地搜索

### Requirement: 缓存与偏好不构成内容存储或授权
系统 SHALL 沿用32页／1000摘要的内存LRU、30秒TTL和最长5分钟stale边界，键区分scope、source及权限／数据generation。最近引用最多20项，命名筛选最多10项；持久化 SHALL 不包含自由查询词、正文、命中片段或结果集。

#### Scenario: 权限撤销
- **WHEN** 来源返回denied或profile／授权版本改变
- **THEN** 立即清除受影响结果、计数、片段和预览，阻止迟到请求回写，不通过offline缓存继续展示

#### Scenario: 无可信授权generation
- **WHEN** 来源不能提供可信的权限版本
- **THEN** 缓存只活在本次搜索打开周期，再次打开重新查询；失效项目不自动扩成所有项目

#### Scenario: 偏好写入失败
- **WHEN** 宿主偏好存储不可用
- **THEN** 搜索与打开继续可用，显示保存失败但不声称偏好已保存

### Requirement: 探索和结果使用适合任务的布局
空查询 SHALL 使用分类导航卡片，有查询 SHALL 默认使用紧凑分组列表，每组默认最多5项并可查看全部。媒体分类 MAY 由用户显式切换缩略图。UI SHALL 复用DSH主题、Surface和语义图标，不创建全局主题或指标卡墙。

#### Scenario: 输入查询后离开探索首页
- **WHEN** 用户从空查询输入关键词
- **THEN** 探索内容切换到分组结果，分类与范围保留，主滚动区为结果区域

#### Scenario: 媒体缩略图不可用
- **WHEN** 用户切换缩略图视图而某媒体没有授权封面
- **THEN** 显示语义图标与可读状态，不伪造图片、不自动抓取外部URL；列表与缩略图保持相同资源身份

### Requirement: 预览只读且绑定资源版本
首次正文预览 SHALL 由用户显式触发，并复用owner授权Reader／Viewer。文本 SHALL 默认限制256KiB／5000行，owner更严格时取较小值；续读 SHALL 保持版本。文档、Skill和模板中的指令 SHALL 仅作为内容。音视频 SHALL 不自动播放。

#### Scenario: 选择Skill条目
- **WHEN** 用户用方向键选中Skill且尚未打开预览
- **THEN** 只更新选择和安全元信息，不读取正文、不安装、启用或执行Skill

#### Scenario: 同名Skill来源不能消歧
- **WHEN** 目录不能提供足够的owner/source与资源身份以区分两个同名包
- **THEN** 标明合同缺口或导航原目录，不猜另一来源的正文、revision或引用文件

#### Scenario: 正文截断与版本变化
- **WHEN** 正文超过上限，或续读时owner revision已变
- **THEN** 标明已读范围；版本变化拒绝混合拼接，允许显式重读，不静默升级引用

#### Scenario: 预览中包含脚本或绝对路径请求
- **WHEN** 内容包含执行命令、脚本、恶意链接或要求读取任意路径
- **THEN** 安全渲染为内容并按owner资源合同读取，不执行指令、不暴露原始工具参数或任意文件访问

### Requirement: 打开与执行由原owner确认
资源打开、分屏、定位、命令执行 SHALL 委托原owner与唯一布局协调器。选择、预览、缓存恢复 SHALL NOT 执行业务命令。最近记录 SHALL 只在owner确认成功后更新；缺少open能力不构成成功。

#### Scenario: 已打开窗格被再次激活
- **WHEN** 用户显式打开已存在目标
- **THEN** 聚焦已有实例，不生成重复Pane；支持的显式右侧／下方／悬浮动作交给原布局服务

#### Scenario: 来源不支持分屏或打开
- **WHEN** 结果没有对应placement或open能力
- **THEN** 该动作禁用并说明，不把普通session.open或可选空调用当作分屏／打开成功

#### Scenario: 搜索目录定位到原Explorer
- **WHEN** 用户打开目录且原Explorer提供定位接收能力
- **THEN** owner核验目录引用与版本，原单例Explorer渲染并选中该目录后才确认成功；超时、版本失效或有未完成操作草稿时保留搜索上下文，且不读取文件正文

#### Scenario: 查询改变时目录定位尚未完成
- **WHEN** 用户修改查询或范围，而目录owner的定位响应尚未到达
- **THEN** 取消待完成交接，迟到响应不改变新查询、关闭搜索或抢焦点；已确认的位置仍在owner变化时失效

#### Scenario: 搜索审批或命令
- **WHEN** 用户选中审批、重跑相关命令或预设并查看说明
- **THEN** 不批准、重跑或应用预设；显式业务执行仍走原owner权限、确认与receipt

### Requirement: 引用明确绑定目标会话
引用到会话 SHALL 复用既有目标选择与prepare/ack流程，绑定resource ref、revision和session；搜索 SHALL 不直接发送消息或采用成果。

#### Scenario: 引用过程中活动Pane切换
- **WHEN** 用户为会话A引用资源后切换活动Pane到B，且ack仍在等待
- **THEN** 保持A为目标或报告其失效，不插入B；ack前不报成功，插入后不自动发送

### Requirement: 响应式与可访问路径完整
搜索 SHALL 按容器宽度适配：≤420px单列、421–720px紧凑分类选择、>720px展开192px分类栏；仅≥1120px且结果宽度≥480px时展开320px预览。快捷浮层 SHALL 使用官方焦点约束，中心 SHALL 不困住Tab。

#### Scenario: 窄屏进入预览后返回
- **WHEN** 用户在360px容器中打开详情再返回
- **THEN** 恢复分类、查询、选中项和滚动位置；搜索、返回和动作在软键盘与200%缩放下仍可达

#### Scenario: 仅用键盘完成全路径
- **WHEN** 用户以Tab、方向键、Enter和Escape操作查询、筛选、更多、预览和继续到中心
- **THEN** combobox/listbox有唯一选择，option不嵌套可聚焦动作；关闭按层级返回焦点且不抢IME／输入光标

#### Scenario: 主题和辅助模式变化
- **WHEN** 使用浅色／深色、粗指针、reduced-motion或长中英文label
- **THEN** 状态不只靠颜色，动作不只靠hover，对比和触控目标满足设计，邻Pane不受样式污染

### Requirement: 新来源不破坏V1消费者
新增分类与来源 SHALL 通过可选元数据和独立适配接入；SHALL NOT 直接扩大旧V1 kind/open target并假定旧消费者兼容。旧命令、Pane身份、偏好和历史owner数据 SHALL 保持原义。

#### Scenario: 旧插件未提供新元数据
- **WHEN** 插件仍只注册旧session/pane/command描述
- **THEN** 以原映射和语义图标继续搜索与打开，不要求同步升级

#### Scenario: 停用新增来源或回退页面
- **WHEN** 回退到v1 presentation并停用v2来源适配
- **THEN** 原入口、布局与偏好可用，领域数据不迁移或删除，旧接口不收到未知resource kind

### Requirement: 设计验收与实现证据分开
本change SHALL 保留设计校验、fixture验证和真实owner／host业务验收的区别；仅文档交付 SHALL 保持实现任务未完成。场景 SHALL 复用现有测试入口，非unit运行 SHALL 保存脱敏证据。

#### Scenario: 本轮只通过文档校验
- **WHEN** proposal/design/spec/tasks与使用说明完成且OpenSpec严格校验通过
- **THEN** 只报告文档设计完成，页面、35类接入和真实正文搜索不标记实现或验证通过

#### Scenario: 测试来源只有mock或失败
- **WHEN** 后续测试仅验证mock合同或真实来源测试失败
- **THEN** 保留对应待实施／未验证状态和失败证据，不拿截图、旧v1性能或其他owner通过记录代替本来源验收
