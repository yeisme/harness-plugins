## ADDED Requirements

### Requirement: Explorer 与 resource content 必须是不同 view providers
文件/文档 bundle MUST 将 Explorer 注册为 singleton navigator，将具体文件/文档注册为 non-singleton resource content views；不得继续用一个 singleton 页面同时承担导航与所有预览。

#### Scenario: 打开 Explorer
- **WHEN** 用户从 Rail、Quick Pick 或 DSH sidebar additive action 打开 Explorer
- **THEN** Workbench 激活唯一 `workspace.explorer` navigator view，不创建第二套会话 sidebar

#### Scenario: 打开两个文档
- **WHEN** 用户固定文档 A 后打开文档 B
- **THEN** A 与 B 作为不同 opaque resourceKey Tab 存在，且各自内容/状态不互相覆盖

### Requirement: 文件选择必须遵循 preview 与 pin 生命周期
Explorer 单击 SHALL 选择并打开可替换 preview；双击、Enter、编辑或 Pin SHALL 固定当前 resource Tab。同一 resource 再次打开 MUST 优先激活既有 Tab，除非请求显式 duplicate。

#### Scenario: Preview 被替换
- **WHEN** 用户依次单击未固定的文件 A 和文件 B
- **THEN** B 替换 A 的 preview Tab，已固定或 dirty 的资源不受影响

#### Scenario: 编辑 Preview
- **WHEN** preview document 首次进入 dirty/editing state
- **THEN** Workbench 原子将其转为 pinned，后续 preview 不得替换它

### Requirement: Explorer 必须使用紧凑、真实且可键盘操作的树
Explorer MUST 使用真实文件/目录/type icons、紧凑行、disclosure、selection 与 focus 状态，并支持 ArrowUp/Down/Left/Right、Enter、Home/End。加载和错误 MUST 在相关目录行附近呈现。

#### Scenario: 展开懒加载目录
- **WHEN** 用户展开尚未加载 children 的目录
- **THEN** 该目录显示 inline loading，owner loader 只加载该节点；成功后展开 children，失败后提供该节点的 Retry

#### Scenario: 窄宽度文件名
- **WHEN** Pane 太窄而无法同时显示 name 与 metadata
- **THEN** name 保持单行省略并通过 Tooltip/accessible label提供完整值，次要 metadata隐藏而不是把行高扩大为卡片

### Requirement: Document view 必须内容优先
Document view MUST 以 compact breadcrumb/title/actions + content viewport 组成，MUST NOT 显示重复营销标题或大面积虚线空卡。Viewer SHALL 把owner-authorized resource交给Resource Preview Registry选择renderer；不得在组件内维护独立的image/PDF/text URL分支。

#### Scenario: 显示文本文件
- **WHEN** owner 返回可预览的 text media type 与安全内容/stream
- **THEN** 文档内容占据主要 Pane 空间，toolbar 保持紧凑，滚动发生在内容 viewport

#### Scenario: 无可预览内容
- **WHEN** resource 不支持 preview 或 owner 暂无内容
- **THEN** view 显示短说明与一个可用主动作（例如 Download/Open externally/Retry），不渲染 250px 以上空卡

### Requirement: Document toolbar与mode必须按格式渐进披露
Document toolbar MUST 始终优先显示resource title/breadcrumb、Pin、Find与More。Rendered/Source/Split、Tree/Raw、Table、Outline/Page thumbnails等secondary modes MUST只在renderer支持时出现；窄Pane MUST折叠secondary navigator而不挤压主内容。

#### Scenario: 打开纯文本
- **WHEN** resource只有Source mode
- **THEN** toolbar不显示无意义的mode tabs或空outline，内容直接占据viewport

#### Scenario: 打开Markdown
- **WHEN** renderer支持Rendered、Source与Split且Pane宽度允许
- **THEN**用户可切换mode；窄Pane仍提供Rendered/Source，Split disabled并说明空间要求

### Requirement: 文本与代码预览必须支持bounded window和长内容virtualization
Text/code/log renderer MUST消费owner-provided encoding、line/byte window、cursor、loaded/total/truncated facts；长内容 MUST virtualize rows并按需继续读取。React state MUST NOT保存完整大型文件。

#### Scenario: 大型日志文件
- **WHEN** initial window只包含文件的一部分
- **THEN** status显示loaded range与total/truncated，Find/Go to Line调用owner window/search capability或明确限制，不把“未找到”误报为全文件结果

### Requirement: 小型代码优先复用DSH Shiki，大型高级视图按需加载Monaco
Bounded code selection SHALL 使用现有DSH `CodeBlock`/Shiki。Desktop用户显式选择advanced read-only、Go to Line或Diff时 MAY lazy load raw `monaco-editor`；Monaco MUST使用opaque model URI并对称dispose model/editor/worker。Mobile/390px MAY安全fallback到virtualized source。

#### Scenario: Monaco加载失败
- **WHEN** dynamic import或worker因CSP失败
- **THEN** source viewer仍显示内容，advanced mode显示typed compatibility error，其他Document Tabs保持可用

### Requirement: Markdown预览必须复用不受信任内容策略
Markdown renderer MUST复用DSH `MarkdownText` 的GFM/KaTeX/safe-link/raw-HTML策略，并可提供Rendered、Source、Split与Outline。Markdown中的文件mention与图片 MUST经过DSH/owner resolver，不得直接读取相对路径或任意远端URL。

#### Scenario: Markdown包含raw HTML
- **WHEN** source包含script、iframe或raw HTML block
- **THEN** renderer不得执行或同源注入该内容；Source仍可安全显示文本

### Requirement: JSON与结构化文本必须提供Tree和Raw并有界解析
JSON/`+json` renderer SHALL复用DSH `JsonTree`与raw CodeBlock，支持expand/collapse、search、copy value/path和parse error location。YAML/TOML MUST至少支持Source；只有owner返回无custom tag/constructor的安全projection时才显示Tree。

#### Scenario: 超大JSON
- **WHEN** payload超过client parse/node budget
- **THEN** renderer使用bounded raw windows和owner summary/search，Tree disabled并说明原因，不在UI thread构建无界object tree

#### Scenario: YAML custom tag
- **WHEN** YAML包含owner未允许的custom tag或constructor
- **THEN** Tree mode不可用，Source可显示，浏览器不得实例化或执行该tag

### Requirement: CSV/TSV必须使用owner schema与virtualized table
CSV/TSV renderer MUST消费owner-provided delimiter、encoding、columns、cursor rows与loaded/total。UI SHALL使用TanStack Table/Virtual或等价headless primitives提供sticky header、column resize/hide、copy cell/row和bounded navigation；公式 MUST作为纯文本。

#### Scenario: Partial表格排序
- **WHEN**只加载部分rows且owner没有global sort capability
- **THEN**全局Sort disabled并说明范围；系统不得只排序可见rows却声称完整文件已排序

#### Scenario: Spreadsheet formula文本
- **WHEN** cell以 `=`, `+`, `-` 或 `@` 开头
- **THEN** UI按纯文本显示/复制，不执行公式或创建spreadsheet runtime

### Requirement: PDF必须使用受控PDF.js worker而非生产iframe
PDF renderer MUST lazy load `pdfjs-dist`并提供page thumbnails/outline、page jump、search、text layer、zoom/fit/rotate。PDF scripting、embedded attachment auto-open、unsafe external action与form submission MUST禁用。PDF iframe MAY只存在deprecated test/story，不进入production profile。

#### Scenario: PDF正常打开
- **WHEN** owner提供range-capable PDF rendition
- **THEN** PDF.js按需读取pages并显示page/total、search与zoom；关闭Tab时worker/range handle被释放

#### Scenario: PDF渲染失败
- **WHEN** PDF损坏、受密码保护或worker不可用
- **THEN** view保留title/size与typed原因，提供Retry/Download/Open externally（按capability），不显示空白iframe

### Requirement: HTML与SVG默认只能Source或owner安全rendition
Raw HTML/SVG MUST NOT inline到DSH origin或使用同时允许same-origin与scripts的iframe。只有owner提供sanitized/rasterized rendition时 MAY显示Preview；所有links/resources仍经过policy。

#### Scenario: HTML含外部脚本
- **WHEN** 用户打开含外部script的HTML文件且owner无sanitized rendition
- **THEN** Document Pane只显示Source/metadata/Download/Open externally，不请求或执行script

### Requirement: Archive预览必须由owner列举entries
Archive renderer MUST只消费owner-safe entry descriptors、limits与cursor；不得在浏览器自行解压。选中entry MUST通过owner生成新的opaque resource ref再交给Preview Registry。

#### Scenario: Archive疑似解压炸弹
- **WHEN** owner检测到entry count、depth或expanded bytes超过policy
- **THEN** listing进入partial/refused状态并显示limit；客户端不得尝试继续解压

### Requirement: Office、EPUB与notebook必须消费converted rendition或诚实fallback
V3 first-support MAY显示owner-provided converted PDF、sanitized HTML、text或structured notebook cells。没有conversion capability时 MUST显示metadata、Download/Open externally或unsupported；MUST NOT接入第三方cloud viewer、macro runtime或任意iframe bridge。

#### Scenario: 打开DOCX但无converter
- **WHEN** owner只允许download/open external
- **THEN** Document Pane显示格式、大小、owner与可用动作，不声称“文档为空”或上传到云viewer

### Requirement: Unknown binary必须提供有界hex/ASCII fallback
Unknown binary renderer SHALL显示metadata与bounded byte window，可提供offset jump、copy sample、Download/Open externally。它 MUST NOT猜测为HTML、可执行文件、媒体或文本。

#### Scenario: 含NUL的未知文件
- **WHEN** owner无法安全识别mediaType且sample含NUL
- **THEN**系统选择binary fallback，显示hex/ASCII window与明确类型未知状态，不尝试UTF-8或HTML renderer

### Requirement: 文件资源必须使用 owner-issued opaque reference
Pane state、URL 与 persistence MUST NOT 以绝对路径作为 resource identity。Preview URL、download URL 与真实 path MUST 由 owner临时授权，并不得持久化。

#### Scenario: 从终端链接打开文件
- **WHEN** terminal link policy 识别到 file-like candidate
- **THEN** Harness 请求 DSH resolve candidate，只有成功返回 opaque ref 后才调用 `openView()`；解析失败时不打开任意本地路径

#### Scenario: 文件被 rename/move
- **WHEN** owner 报告当前 ref 已迁移
- **THEN** provider 使用 owner receipt 更新到新 opaque ref或显示 stale/refresh action，不在客户端猜测新路径

### Requirement: 文件/文档入口必须收敛到同一打开合同
Explorer、DSH sidebar additive action、Quick Pick、terminal link、Plan/Artifact link MUST 最终调用兼容的 `PaneWorkbenchClientFace.openView()` resource request。

#### Scenario: 从 DSH sidebar 打开文档
- **WHEN** 用户在 canonical 左侧栏的文件/文档入口选择一个 resource
- **THEN** DSH sidebar 保持 canonical owner，右侧 Workbench 打开/激活对应 document Tab，不创建嵌套 sidebar

### Requirement: 文件/文档 lifecycle 必须释放重资源
Inactive resource view SHALL 根据 retention suspend decode/render work；provider unload MUST dispose object URLs、streams、observers 与 listeners，同时保留可恢复的 orphaned Tab metadata。

#### Scenario: 卸载文档 provider
- **WHEN** bundle dispose 而 document Tabs 仍在 Pane state
- **THEN** object URL/stream 被释放，Tabs 标为 orphaned；重新注册兼容 provider 后可恢复，不泄漏旧 preview URL
