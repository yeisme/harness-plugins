# Tools引用阅读设计

## 现有事实与归属

- `packages/client/ui-mcp-inspector/src/client/McpInspectorView.tsx`已有目录详情、返回目录、状态和来源呈现；扩展该详情，不新增平行Tools主壳。
- `packages/host/dsh-tool-hub/src/wire.ts`的ToolHubItemV1是目录摘要，不应塞入整份Skill正文；`src/plugin.ts`现有Remote list/setEnabled，没有本文所需内容读取方法。
- `dsh-session-tools-workspace-v2`已归档；会话Tab和固定旁栏继续绑定明确session。`dsh-tools-location-command-ux-v1`保持独立归属。
- 文件预览复用`packages/bundle/dsh-file-document`与既有Markdown/代码renderer；Composer引用复用`dsh-prompt-reference-creative-workspace-v1`及原prepare/ack。实现前核对具体调用合同，不因模块存在就宣称已接通。

## 阅读路径

目录选中条目→详情“说明”→点击正文文件链接→同一详情阅读目标→返回原文原滚动位置。顶层保持条目名称、Skill/MCP/native类型、来源版本和状态；正文占据主要空间。文件使用小图标、文件名和可访问标签，悬停/聚焦展示包内相对位置和版本，不展示主机绝对路径。

“引用文件”列出当前正文直接引用，按正文出现顺序去重；明确“当前文档”，不称为完整依赖图。不递归预读所有文件。点击更深链接按需读取；循环引用定位已有历史项，不无限增长栈。历史最多50项，按source实例/revision/resource和阅读范围区分。

说明页支持渲染/源码、文内搜索及匹配跳转；源码模式保留行号和精确引用位置。Markdown链接和可解析的裸相对路径均可成为引用；行内代码中的文件名只有Host能唯一解析到来源包文件时才增加“查看文件”，普通命令和模糊名字保持文本。锚点跳到标题；不存在的锚点打开文件并提示未定位，不伪造高亮。

正常点击在详情内继续阅读；显式“并排打开”复用文件Pane，同一source/resource/version复用已有Pane。返回目录恢复筛选、列表位置和选中行。切换条目保存各自阅读位置，不让迟到响应替换新条目。打开链接不抢走会话输入焦点，只有用户主动导航时迁移焦点。

## 内容与引用合同（分阶段实现）

搜索中心v2的先决增量已在`dsh-tool-hub`提供`toolReferences.readSkill`：消费owner新增的可选getDocument，只读取profile范围、默认filesystem provider的Skill正文分段，返回opaque资源身份和正文摘要版本；输入拒绝路径和runtime来源。普通get不能证明文件来源，因此当前未应用owner增量的staging仍返回Reader不可用；owner补丁已在隔离副本验证并回退。它不是完整`tools.reference-reader.v1alpha1`：已接入原Tools详情的显式源码分页UI；渲染模式、文内检索、相对文件解析、文档历史／并排打开、会话范围与引用prepare/ack仍未接通，下表这些要求继续保留。具体当前合同和证据见[搜索中心设计](../dsh-search-center-v2/design.md)与[实施记录](../dsh-search-center-v2/implementation-baseline.md)。

沿用现有目录item ID，新增独立版本化`tools.reference-reader.v1alpha1`读取能力；具体Remote命名须在实现任务核对后确定，不能把拟议名字当可调用API。

| 操作 | 输入 | 成功输出 | 关键约束 |
|---|---|---|---|
| 读取说明 | itemId、明确scope、来源revision或当前版本请求 | resourceRef、sourceRef、revision/digest、mediaType、授权内容段、截断/续读信息、引用列表 | 首次选定版本；正文不进入目录snapshot或日志 |
| 解析引用 | 当前resourceRef/revision、owner生成的linkId | 目标resourceRef/version、类型、可用状态、可读原因 | 浏览器不提交任意文件路径；Host重新校验来源和授权 |
| 读取资源 | resourceRef、expectedRevision、内容游标/范围 | 同版本正文或媒体预览授权 | 游标绑定资源和版本，不能跨资源复用 |
| 引用到会话 | 已授权resource/selection版本、用户选择的session | 既有prepare/ack回执 | 查看、插入、发送、执行是四个不同动作 |

sourceRef必须区分同名Skill的不同安装来源、全局/项目scope和包revision。安装、升级、停用或卸载不会让旧ref静默指向新文件。初版不新增磁盘内容缓存；只有owner能继续提供旧版本时允许旧版本续读，否则保留界面中最后获授权的内容并标记来源失效。显式刷新采用新版本且清理不再适用的锚点/范围，原阅读位置尽力恢复。

本地链接相对当前文档所在目录解析，规范化后及实际打开前校验realpath/symlink仍位于批准的来源包root；包内合法../可用，越界、编码越界、符号链接逃逸拒绝。读取与权限检查必须防止检查后文件替换；实现任务需验证实际文件句柄/来源身份。跨包引用只经来源服务明确授权，不将工作区root当默认全盘授权。

HTTP(S)链接标为外部网站，用户点击后由宿主打开；不自动抓取远程网页。MCP resource URI只通过已发现且授权的resource读取能力处理，不直接fetch任意URI。file/javascript/data等未授权scheme不执行。代码块、脚本、文档内指令均为内容；阅读不会启用Skill、运行工具、安装依赖或触发Agent。Markdown禁用可执行HTML和事件处理；远程图片不自动加载，授权媒体复用现有预览设施。

Skill正文属于用户显式请求查看的安装文档，允许通过独立授权内容通道展示；不能扩展为查看隐藏系统提示词、运行时拼接prompt、凭据或私有工具参数。敏感配置和未授权文件拒绝读取。日志只记安全ref、状态、长度和耗时，不记正文、绝对路径和令牌。

初始文本段上限256KiB且最多5000行（任一先到）；超限显示截断并提供有界续读，不假装已读完整文件。目录引用列表分页，不后台遍历依赖。二进制仅复用已支持的授权预览；不支持时说明类型，可通过既有文件能力打开。正文请求可取消，Pane关闭不改变工具执行；恢复界面不触发执行。

## UI Contract

- Surface classification：adopted；Surface kind：inspector，复用现有Tools workspace内详情。
- 第一优先级：当前文档正文及引用；第二：来源、版本、返回路径；第三：并排打开、复制、引用到会话等动作。
- Existing components reused：ui-surface、ui-visual-kit、官方Button/Input/Menu、已有Markdown/代码及文件Pane、Composer prepare/ack。
- Cards that earn existence：无新增卡片墙；仅现有工具详情容器，正文不再套多层卡片。
- Primary scroll owner：当前文档正文；目录列表和展开的引用列表各自滚动，整页不出现第三层嵌套正文滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 正文 | 保留标题/版本及阅读位置 | 无文档说明，保留元信息/schema | 重试读取且保留上次合法内容 | 渲染/源码/搜索 | 明确截断、旧版与刷新 | 缺失读取能力及owner任务 |
| 引用 | 目标行loading可取消 | 当前文档无引用 | 缺失/越界/失权分别解释 | 文件名/锚点导航 | 源版本变化不替换 | 不支持类型或scheme |
| 会话引用 | prepare/ack进度 | 未选会话提示选择 | 失败保留文档和选区 | ack后显示插入成功 | 过期/冲突要求重选 | seam缺失，仍可阅读 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 目录/说明/引用单面切换，显式返回；操作收进菜单 | 正文主区、引用列表按需Sheet | 列表+详情，引用列表可折叠；并排由Pane宿主管理 |

### Accessibility

- Tab访问引用，Enter打开；前进/后退使用可见按钮，不劫持输入框快捷键；返回恢复原链接焦点。
- 文内搜索与源码搜索支持中文IME；链接可访问名称含目标文件及是否外部，不仅依赖颜色。
- Esc只关闭当前Sheet/弹层，不丢阅读记录；控件焦点交还调用者。代码横向滚动限制在代码块，不挤破Pane。
- 验证360/560/960px、200%缩放、中英文本、减少动态效果、触摸目标；无自动播放。

### Visual Exceptions

无。遵循`docs/design/dsh-unified-panel-visual-system.md`；不复制截图的大尺寸浮层、卸载按钮或“Try now”执行入口。

## 兼容、恢复与交付

增量添加读取能力与optional详情元信息，旧list/setEnabled、目录完整性、会话可用性和启停语义不变。没有服务时仍可用既有目录/调用功能。回滚移除新增读取与正文入口，不删除Skill包、会话、布局或用户文件。

当前只创建设计文件；实现阶段分别交付协议测试、交互fixture、真实已安装Skill/真实宿主路径证据。缺少Host来源读取接口时在`upstream-prs`记录最小缺口及配套任务，不在浏览器兜底读磁盘。真实路径要求从Tools打开一个安装Skill、点至少两层相对文件引用、返回原位置、显式引用到所选会话且零执行。
