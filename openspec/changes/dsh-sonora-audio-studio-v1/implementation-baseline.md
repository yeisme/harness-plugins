# Sonora声音台接入基线

## 当前接入状态

字幕导出已接通owner持久服务、HTTP/SDK、DSH adapter、固定版本查看及标准正文上限内的下载；实际Host→Sonora HTTP/SQLite测试通过，但身份与transcription输入为fixture。转写能力及失败诊断已通过独立Gateway/Remote读取，并在声音workspace呈现只读能力列表。Sonora owner 已把 workspace waveform/chart/board/table/action/events 挂到授权 HTTP/SDK（合并 OpenAPI live），command-asr 可经用户配置装配且失败保持 unavailable；词级对齐仍明确不可用。尚未完成实际ASR识别、TTS/music/SFX直接操作、试听/候选/镜头交接、大文件下载以及完整真实浏览器owner路径；本专业Pane未整体验收。

### 转写能力视图验证

状态矩阵浏览器补验：增加中英文初次读取失败及刷新恢复、空的已探测目录、缺失失败诊断标志三个边界。`pnpm run test:visual -- visual-transcription-capabilities.spec.ts`共12条通过，证据`temp/integration-test-runs/ui-visual-2026-09-08T06-52-27-661Z-1745362/`。空目录不显示fixture或执行控件；未知诊断单独说明，初次失败可重新读取恢复；原360/560/960正常及stale路径仍通过。测试使用实际组件和合成数据，不属于真实ASR证据。

新增CreatorTranscriptionCapabilities，复用SurfaceSection/State、官方Button及共享token，显示owner模型/revision、fixture、locale/format、时间码、说话人、网络/凭据声明、费用模型与处理上限。目录不提供报价时明确说明，segment不伪装word，失败provider保留标识与修复提示。旧服务缺诊断时显示未知；刷新失败保留旧数据并标为stale。该读取不触发转写、不参与字幕导出admission。

5项能力视图组件测试与8项views回归、client typecheck、surface/plugin检查通过。`pnpm run test:visual -- visual-transcription-capabilities.spec.ts`通过6条路径（中英×360/560/960），验证测试provider、未报价、失败项、长模型ref不溢出、键盘刷新与失败后的stale状态；证据`temp/integration-test-runs/ui-visual-2026-09-08T06-43-13-497Z-1657439/`。已检查360px中文截图，字段和值可读。浏览器数据为明确synthetic fixture；完整声音能力矩阵和真实ASR仍待实现，2.2保持open。


## 2026-09-11 合同核对（1.1 复检：owner HEAD 2c59817）

owner `cli/sonora` 自 09-08 审计基线（e4019eb8）以来合同面**零变更**（`git diff --stat e4019eb8..HEAD -- sdk/go/sonora/ internal/api/routes_table.go docs/protocols/` 为空；新增改动集中在 mcp-input-intake/文档，不触及声音合同）。逐项 digest（git blob 前 16 位，HEAD=2c59817d）：

| 合同面 | 文件 | digest | 判定 |
| --- | --- | --- | --- |
| TTS/audio jobs | sdk/go/sonora/client.go | 77646072ca29d758 | 支持（HTTP/SDK 在场；各 provider readiness 须运行时核验=未验证） |
| 转写 | sdk/go/sonora/transcription.go | e15f3dec8813f600 | 默认 fixture；command-asr 可配置装配；真实 ASR 未验证 |
| 字幕/handoff | sdk/go/sonora/subtitle.go | b1ebf7651f74ffa7 | segment-to-cue 支持；**word-level alignment 明确不可用**（不得均分 segment 伪造词级）；SRT/VTT 导出已交付（owner 侧 2.3 收口） |
| 音乐 | sdk/go/sonora/music.go | a3047d8e8fd11b01 | brief/plan/job 在场；fixture/preview ≠ production ready |
| 工作流 | sdk/go/sonora/workflow.go | c9633110a112d861 | pre-stable 单独消费；费用/权限/幂等保留 |
| 路由面 | internal/api/routes_table.go | 73f745636c55ee02 | workspace 投影/字幕导出路由在场 |
| workspace 投影 | docs/protocols/audio-workspace-projections.md | 90a0d98034fc9a74 | 授权 HTTP live；无 signed URL/音频字节 |

注意：`sdk/go/sonora/workspace.go` 在 owner 工作树为**未跟踪**在途文件（并行会话工作），不计入合同核对、不消费。双向链接已存在（owner `sonora-dsh-audio-consumer-gaps-v1` 6/8，design 反向链接本 change）。

## 历史切片与证据

以下保留各阶段当时的边界和证据；其中“尚未完成”描述以本页当前接入状态及最新tasks为准。

## 2026-09-08：持久字幕导出资源

Sonora新增CreateExport/ReadExport，在原项目repository保存导出字节与安全metadata；同键同输入返回原资源，不同格式冲突，读取重新验证track/review/source和内容摘要。真实仓库测试通过，证据见[owner设计](../../../../../cli/sonora/openspec/changes/sonora-dsh-audio-consumer-gaps-v1/design.md)。HTTP/SDK下载与DSH消费仍未完成，此资源也不代表Scaena正式采用。

## 2026-09-08：固定审阅版本导出准备

Sonora已把SRT/VTT渲染接到project repository的track/review/source读取与核对，新增PrepareExport；真实仓库测试验证合法导出、stale digest、取消与cue被改写后拒绝。六件套证据见[owner设计](../../../../../cli/sonora/openspec/changes/sonora-dsh-audio-consumer-gaps-v1/design.md)。输出仍为内存内容，不是持久资源、交付回执或已开放HTTP下载；DSH导出按钮尚不能凭此启用。

## 2026-09-08：owner字幕格式渲染

Sonora已新增内部SRT/VTT确定性渲染函数，字幕包unit测试通过，覆盖时间码/中文多行/错误输入无部分输出。详情见[owner设计](../../../../../cli/sonora/openspec/changes/sonora-dsh-audio-consumer-gaps-v1/design.md)。尚无可供DSH启用的授权导出服务或回执，不将内部formatter当作完整导出能力；声音台继续等待对应owner接口交付。

## 2026-09-08：真实接口与缺口初查

Sonora核对时HEAD为e4019eb81946d96793bbfcd480abba60e8e76a8b；源码存在不代表当前服务已配置或provider已验收。以下为实际文件检查，不是声音生成测试。

| 能力 | 源码入口 | 当前消费决策 |
|---|---|---|
| TTS模型与audio jobs | internal/api/routes_table.go、sdk/go/sonora/client.go:CreateAudioJob | 已有HTTP/SDK，DSH应适配原操作；各provider配置/readiness仍须核验 |
| 音乐制作 | sdk/go/sonora/music.go:CreateMusicBrief/Plan/Job | 复用原brief/plan/job，不在插件编排provider |
| 工作流 | sdk/go/sonora/workflow.go、routes_table.go的/v1beta/workflows/workflow-runs | pre-stable版本单独消费，费用/权限/幂等保留；SDK不自动retry |
| 转写 | sdk/go/sonora/transcription.go、GET `/api/v1/transcription-providers`、`transcription.command_asr` | 默认 fixture；可信配置可挂 command-asr，探测失败保持 unavailable。不能标为真实ASR |
| 字幕与交接 | sdk/go/sonora/subtitle.go、subtitle-tracks/subtitle-handoffs路由 | segment-to-cue、review与handoff已有；production_acceptance保持pending |
| 波形/board/table | docs/protocols/audio-workspace-projections.md、GET `/api/v1/workspace-projections/*`、sdk/go/sonora/workspace.go | 授权 HTTP live；归档 OpenAPI 仍是 schema 源。投影无 signed URL/音频字节 |
| 字幕导出/精细对齐 | subtitle-consumption-contract.md、speech-transcription-contract.md、subtitle-exports HTTP | SRT/VTT 导出已交付；word-level alignment 仍明确不可用，不得均分segment伪造词级精度 |

在实际owner创建[sonora-dsh-audio-consumer-gaps-v1](../../../../../cli/sonora/openspec/changes/sonora-dsh-audio-consumer-gaps-v1/tasks.md)，包含proposal/design/spec和8项任务，严格验证通过；owner文档已反向链接。任务要求复用原服务挂载workspace HTTP、提供真实transcription provider和受控字幕导出，对word-level精度单独给出实际能力证据，不把缺失能力永久藏在禁用按钮后。

Sonora owner `sonora-dsh-audio-consumer-gaps-v1` 已挂授权 workspace HTTP、command-asr 配置入口与字幕导出；真实 TTS/ASR/镜头交接仍待 3.2。DSH 5.1 仍需实际 adapter，不能仅凭 owner 任务关闭。声音台继续复用共享执行、候选和播放器，不等待 Eikona 或画布完成。未调用真实声音 provider。

### 字幕回执 UI 增量（2026-09-08）

版本标识补全：正文上方显示已选成果名称与完整owner版本，收到新回执后继续显示旧正文对应的版本，防止误认当前内容。复制按钮使用字幕专用中英文文案；长版本号通过scoped overflow-wrap换行。6项组件测试、client typecheck、surface/plugin检查及12浏览器场景通过，最新证据`temp/integration-test-runs/ui-visual-2026-09-08T05-42-02-993Z-993177/`，浏览器使用64字符版本号验证窄Pane、复制入口及原下载路径。

实际owner连接增量：`node scripts/run-sonora-owner-http-integration.mjs`已通过，证据`temp/integration-test-runs/sonora-owner-http-20260908T053711476Z-941237/`。测试构建当前Host包与Sonora专用helper，在真实临时SQLite项目、HTTP API及项目权限中完成SRT/WebVTT持久导出和完整读取。模拟owner提交成功后丢失HTTP回执，再撤掉当前选区，仍能通过原键查询得到旧导出；跨项目/actor与未知键不创建新导出，Sonora端计数恰好2次POST。helper stdin关闭后正常退出并清理项目。

这是实际DSH Host到Sonora的系统测试，身份和原始transcription是明确fixture，未调用真实音频provider。它补强前述注入fetch测试，但没有把浏览器、真实ASR/TTS或长期安装配置绑定列为已通过。owner配套2.3字幕导出服务任务据其完整局部证据收口；DSH父任务保持open。

声音workspace已挂载CreatorSubtitleResults：completed/partial回执中的Sonora字幕成果显示主动查看按钮，用户打开后经原readArtifactContent读取固定版本；新回执不会替换正在阅读的正文。只读CodeBlock复用官方组件，按钮使用vk-btn，复制按钮在当前无CSS的primitive产物中补齐本地scoped token样式。未新增媒体编辑器或领域store。

点击下载重新读取owner内容，确认ref/version/mediaType/contentRevision及全文与预览一致后才生成临时Blob和固定文件名subtitles.srt/subtitles.vtt；对象URL随后释放。读取失败、失权、版本不匹配或超限不下载缓存、不生成截断文件。完整Creator context作为组件key，跨项目/权限变化时卸载并忽略旧响应；初次结果不自动加载或抢焦点。

6项字幕结果组件测试与8项现有views回归通过，client typecheck通过。`pnpm run check:surfaces`、`pnpm run check:plugins`通过。`pnpm run test:visual -- visual-subtitle-results.spec.ts`通过12条路径（中英×360/560/960×SRT/VTT），键盘Enter打开、原始UTF-8下载内容相等、两次独立授权读取、无横向溢出或pageerror；最终证据`temp/integration-test-runs/ui-visual-2026-09-08T05-27-30-641Z-794986/`。已人工检查360px中文SRT截图，按钮与正文可读。最初fixture截图暴露按钮缺共享class和CodeBlock复制按钮样式，已修复后重跑，不能使用初次功能通过替代视觉验收。

此浏览器路径使用真实组件和合成授权内容，不是Sonora进程、真实音频provider或整体专业闭环。下载仍受256Ki字符正文接口上限；完整owner配置绑定、大文件下载、TTS/music/SFX、试听/对齐与交接路径未完成。

### Creator adapter 接入增量（2026-09-08）

内容读取增量：Host客户端新增readContent，复用同一授权连接/禁重定向/超时逻辑，GET原导出content端点。校验owner回执的MIME、精确字节数、SHA-256和严格UTF-8后才返回完整文本；失权、短读、额外字节、错误MIME/摘要/编码均不返回正文。adapter通过原readArtifactContent seam重新读取回执，匹配请求artifact版本与mediaType，再读取正文；正文不写入snapshot或Host持久状态。

`node scripts/run-sonora-subtitle-integration.mjs`通过（31项client unit＋4项adapter/gateway集成），证据`temp/integration-test-runs/sonora-subtitle-20260908T051210925Z-594250/`。集成路径从导出回执经gateway读取完整SRT正文，错误artifact版本拒绝，snapshot不含正文，读取不增加POST。当前沿用编辑器256Ki字符上限，超出返回不可用而不截断；大字幕完整文件下载、输出成果进入声音台UI及真实浏览器路径仍未完成，不得据此关闭2.4。

新增`createSonoraSubtitleExportAdapter`，使用原CreatorOwnerAdapter/Directory/Gateway。Host仅提供当前项目的轨道选择ref；adapter通过Sonora真实track HTTP合同读取版本、review、readability与cue数量，剥离cue正文后组成安全快照。审阅通过且readability为ok时，发布固定track/review的格式选择与确认操作；生成回执和输出ArtifactRef均使用Sonora返回的持久ref与content digest。

dispatch再次检查当前轨道、review与完整上下文，旧descriptor或项目切换不提交；reconcile只调用原键lookup，不读取当前选区/preview，旧导出不因新版本而被替换。未观察到、失权或stale维持unknown。此切片没有保存领域正文、任务索引或自动重试状态，尚未提供下载媒体seam或完整声音台工作列表。

`node scripts/run-sonora-subtitle-integration.mjs`通过（24项HTTP客户端unit＋4项directory/gateway/adapter集成），证据`temp/integration-test-runs/sonora-subtitle-20260908T050631243Z-522725/`。覆盖动作发布、固定输入POST、owner成果回执、回执丢失后选区改变仍只查询旧操作、审阅变化与跨项目拒绝、blocked轨道无动作、缺失键保持unknown。HTTP是注入fixture，尚未实际绑定Sonora进程或浏览器。首次失败为测试清理误用ctx.dispose，已改为原框架ctx.fiber.dispose，失败证据保留在sonora-subtitle-20260908T050523048Z-507255。

bundle已导出客户端与adapter工厂，安装仍需Host连接/项目选择绑定并调用原registerCreatorStudioOwner；不自动读取或改写用户配置。2.3保持open，后续需要真正的安装绑定、其他声音动作以及UI验证。

### Host HTTP 消费切片（2026-09-08）

Gateway/客户端增量：独立readTranscriptionCatalog只读入口已挂入Host Typert、client严格Remote codec和controller。浏览器携带当前完整context，Host在读取前后核对授权scope及adapter/directory版本，返回前再校验有界catalog；客户端上下文未初始化时不请求，reset/dispose后不接受迟到结果。探测不加入动作snapshot，不因ASR目录等待而阻塞字幕导出。

38项client合同＋6项Host集成通过，证据`temp/integration-test-runs/sonora-subtitle-20260908T063115718Z-1526846/`；实际Host Gateway→Sonora目录一致性与原字幕路径通过，证据`temp/integration-test-runs/sonora-owner-http-20260908T063119932Z-1530036/`。新测试验证请求scope不匹配时不调用owner、membership变化丢弃结果，以及目录悬而未决时导出可完成。13项controller/client和11项bundle测试、Host build、client/bundle typecheck通过。最初测试误用重复ctx.provide，已改为独立fixture上下文变化，失败证据保留sonora-subtitle-20260908T062528819Z-1462896。浏览器能力矩阵及真实ASR仍未交付。

能力目录Host消费增量：现有Sonora客户端新增readTranscriptionCatalog，复用同一授权连接与GET通道读取owner能力目录。独立有界schema保留capability_probe、fixture、revision、语言/格式/时间码和原始cost_model；不合成费用数值，不把缺失diagnostics_available默认为成功。冲突fixture标记、重复provider、无诊断支持却出现失败列表、不合法model ref或超预算目录均拒绝，不漏出凭据/URL。

`node scripts/run-sonora-subtitle-integration.mjs`通过38项client unit及4项adapter集成，证据`temp/integration-test-runs/sonora-subtitle-20260908T061530750Z-1359414/`；新增实际owner GET目录检查的`node scripts/run-sonora-owner-http-integration.mjs`通过，证据`temp/integration-test-runs/sonora-owner-http-20260908T061534877Z-1359090/`。真实HTTP返回fixture、segment精度和诊断可用标志，原字幕导出/读取/旧键恢复回归仍通过且owner只有2次POST。Host typecheck/build通过；能力目录尚未挂载到浏览器矩阵，不作为执行授权，也不将fixture识别晋级真实ASR。

provider诊断增量：Sonora能力列表新增可选diagnostics_available/unavailable。新默认服务一次探测返回成功能力及失败provider稳定错误码，错误文本不跨owner边界；旧服务诊断标志缺失表示尚不可知。消费方不能把缺失provider或缺失诊断标志解释成已删除/无失败。owner证据`cli/sonora/temp/integration-test-runs/transcription-command-20260908T061016Z-1305136/`覆盖HTTP、SDK、旧服务与探测次数；DSH矩阵呈现和真实ASR仍待接入。

转写能力发现增量：Sonora新增项目授权的`GET /api/v1/transcription-providers`与Go SDK ListTranscriptionProviders。响应包含模型、revision、语言/格式、时间码精度、资源及费用模型限制；validation_level=capability_probe，内置fixture显式标记，不代表真实ASR验收。真实HTTP/SDK和权限测试证据为`cli/sonora/temp/integration-test-runs/transcription-command-20260908T055825Z-1177616/`。目前只返回成功探测profile，失败provider诊断和DSH矩阵呈现仍是未完成工作。

ASR盘点校正：Sonora已有command-asr本地wrapper adapter，而非完全缺少非fixture实现；此前默认registry与HTTP装配无法注入该能力。owner现已增加registry-backed service和可信ServerConfig.Transcription装配，并限制进程输出/拒绝追加JSON。配置注入HTTP及原转写回归证据为`cli/sonora/temp/integration-test-runs/transcription-command-20260908T055301Z-1110234/`；实际配置引导、能力发现、受管音频resolver和真实ASR仍未完成。DSH不得因Profile写有first-support就将其显示为实际识别已验收。

新增`packages/host/creator-studio/src/sonora-subtitle-export.ts`，消费实际Sonora创建/读取回执接口。Host授权连接解析器需返回与请求一致的完整项目/会话/权限上下文；base URL仅允许HTTPS或loopback HTTP且不含凭据、路径、query或fragment。凭据仅用于Host请求，禁止重定向；超时15秒，不重试，导出元数据读取限制16KiB并检查固定track/review/format、资源ref与格式MIME。轨道接口含cue正文，读取上限16MiB，投影前剥离正文；不将其存入Host状态。

创建的网络错误、5xx、异常JSON、过大或不匹配回执返回unknown，明确4xx拒绝不转发私有错误正文。`read`只按已知导出ref读取。`lookup`调用owner的`GET /api/v1/subtitle-exports/by-idempotency-key`，使用原header幂等键并校验固定输入；404、失权、stale或服务不可用都不能让旧提交变成确认失败，不调用POST。Sonora按当前project/actor定位原回执，DSH不推导owner资源索引。

`pnpm --filter @yeisme/dsh-creator-studio-host typecheck`及`pnpm --filter @yeisme/dsh-creator-studio-host exec vitest run tests/sonora-subtitle-export.spec.ts`通过（24项）。上方adapter增量后，host build与bundle typecheck也通过。unit证据不代表真实服务或浏览器；2.3、2.4及5.1保持open。

### 后续增量：字幕导出 owner 接口（2026-09-08）

上表为初次盘点。Sonora现已新增`POST /api/v1/subtitle-exports`、`GET /api/v1/subtitle-exports/{export_id}`及`GET /api/v1/subtitle-exports/{export_id}/content`，复用项目权限、固定track/review digest、幂等键和审阅校验。返回持久回执，字幕正文只经授权下载；SRT/VTT由owner生成，DSH不能自己重组cue。

SDK与OpenAPI已生成并通过检查。实际本地HTTP/SDK/项目仓库测试证据位于`cli/sonora/temp/integration-test-runs/subtitle-export-20260908T044553Z-250102/`，包含重放、冲突、失权/错误project、stale、缺失资源及下载摘要核验。该证据不涉及真实ASR/声音provider。下一步将导出动作与回执接入Sonora Pane；本专业闭环和相应父任务仍未验收。
