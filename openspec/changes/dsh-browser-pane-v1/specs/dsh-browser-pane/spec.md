## ADDED Requirements

### Requirement: Browser bundle SHALL 注册可诊断且受 Provider gate 控制的 Pane

`@yeisme/dsh-browser-pane` SHALL 通过 DSH 公开 plugin/client seam 注册 plugin id `dsh-browser-pane`、命令 `browser.open`、slash name `browser` 和非 singleton Pane kind `dsh.browser`。bundle 安装后，基础诊断 view SHALL 保持可用；`browser.automation.*` 与 `browser.viewport.attachment.v0.1` SHALL 作为 optional capabilities。只有 exact compatible Provider probe 成功后，Pane 才能暴露 live controls 与 viewport attachment。

#### Scenario: 安装 bundle 但没有 Provider

- **WHEN** active profile 已加载 `@yeisme/dsh-browser-pane`，但没有 compatible Browser Automation Provider
- **THEN** Pane SHALL 显示 `needs_contract` 或 `unavailable` 及 bounded reason
- **AND** SHALL NOT 暴露可用地址栏、交互视口、导航、接管、下载或 evidence controls。

### Requirement: Browser Pane SHALL 依赖 typed BrowserAutomation authority

Browser Pane SHALL 通过 browser-safe `BrowserPaneHostV1` 消费 `BrowserAutomationProviderV1`。每次 probe、snapshot、event、action、reconcile 与 viewport request SHALL 精确绑定 `PaneContextV1` revision、Provider ref、automation session ref/version、contract digest 与 runtime generation。Web search、`ctx.web`、URL、iframe 或 browser-side fetch SHALL NOT 被当作 automation session。

#### Scenario: Profile 只提供 search

- **WHEN** active profile 只有 `ctx.web` search/fetch 或 owner-authored result links，没有 compatible Browser Automation Provider
- **THEN** Pane SHALL 显示 `search_only`
- **AND** SHALL NOT 根据这些 links 创建 page Tabs 或推断 live browser session。

#### Scenario: Action 执行期间 Provider binding 已切换

- **WHEN** action receipt 属于旧 context revision、session version、contract digest 或 runtime generation
- **THEN** Pane SHALL 丢弃该 receipt，并进入 `stale` 或 `reconcile_required`
- **AND** SHALL NOT 把结果应用到替换后的 session 或 page。

### Requirement: 一个 Browser Pane SHALL 只绑定一个 automation session

每个 `dsh.browser` Pane instance SHALL 使用 opaque automation `sessionRef` 作为 resource key，并把该 session 的 owner pages 显示为 Pane 内部 Tabs。Projection SHALL 最多暴露 32 个 page summaries，必须保留 active page；owner 还有其他页面时 SHALL 提供 `omittedPageCount`。v0.1 SHALL NOT 创建、终止或持久化 automation session。

`listSessions` SHALL 最多返回 16 个 safe `BrowserAutomationSessionHandleV1`、一个可选 default session ref 与 `omittedSessionCount`。handle SHALL 只包含 opaque session ref/version、bounded label、phase、page count 和可选 last-activity time。`browser.open` SHALL 在只有一条 session 时直接打开，多条时显示 safe picker，零条时显示 no-session diagnostic；SHALL NOT 创建 automation session。Typed external deep-link 在打开前 SHALL 重新校验其 ref 属于 active context。

#### Scenario: Provider session 超过 32 个页面

- **WHEN** snapshot 报告 40 个 owner pages
- **THEN** Pane SHALL 保留 active page 加最多 31 个 bounded recent page summaries，并报告 8 个 omitted pages
- **AND** SHALL NOT 为 omitted page 发明本地状态或暴露 mutation。

#### Scenario: Provider 暴露多个已有 session

- **WHEN** `browser.open` 发现三个 safe session handles，且没有 valid default
- **THEN** client SHALL 显示 bounded session picker，并把所选 opaque ref 打开为独立 Pane
- **AND** picker SHALL NOT 显示 raw location、page content，也不得提供创建或终止 session 的入口。

### Requirement: Browser projection SHALL 有界且不含私密数据

Snapshot 与 event SHALL 使用 `PaneEventEnvelopeV1`，且只包含 opaque refs、versions、bounded labels、safe location summaries、navigation booleans、freshness/status、control state、activity summaries 与 evidence/download refs。Safe location SHALL 只包含 `http` 或 `https` scheme label、punycode host label、无前导 slash 的可选 path label，以及 query/fragment 是否隐藏的 booleans。

Projection SHALL NOT 暴露 cookie、Authorization、headers、secret、token、credential value/ref、raw/full/signed URL、URL userinfo/query value、absolute path、raw DOM、完整 page content、screenshot/download bytes、raw prompt、provider payload、private tool arguments 或完整思维链。Event payload SHALL 不超过 64 KiB；activity、evidence、download 与 receipt collections SHALL 遵守 design 定义的 domain budgets。

#### Scenario: Provider 返回敏感 projection 字段

- **WHEN** Provider snapshot/event 包含 cookie、credential field、raw URL、URL query secret、absolute path、raw DOM 或超限 payload
- **THEN** Host adapter SHALL 将整个 payload 拒绝为 `contract_mismatch`
- **AND** client SHALL 不接收该 payload 中的任何 browser facts。

#### Scenario: Safe location 存在隐藏 URL 部分

- **WHEN** active page 含 query parameters 或 fragment
- **THEN** projection SHALL 只暴露 safe scheme、punycode host、bounded path label 与 hidden-part booleans
- **AND** Pane SHALL NOT 重建或持久化 full URL。

### Requirement: Viewport media SHALL 使用 opaque client-local attachment

低频 Pane protocol SHALL NOT 携带 frames、media URLs、connection credentials 或 signed attachment URLs。`openViewport` SHALL 返回 bounded `BrowserViewportLeaseV1`，其中只含 opaque lease/attachment refs、exact session/page/generation/epoch binding、intrinsic size、device scale factor 与 expiry。通过 `dsh.browserViewportTransport` 注入的 `BrowserViewportTransportV1` SHALL 在自己的 client-local security boundary 内解析 lease，并返回带 typed input、resize 与 detach 操作的 `MediaStream` attachment。Attachment ref 本身 SHALL NOT 完成授权；Transport 还必须校验 authenticated connector 与 exact binding。

#### Scenario: Pane 附着 live viewport

- **WHEN** Provider 为 active page 与 exact generation 授予 viewport lease
- **THEN** client Transport MAY 把 `MediaStream` 附着到本地 `<video playsInline muted>`
- **AND** media endpoint、credential 或 transport secret SHALL NOT 进入 Pane projection、persistence、logs 或 evidence。

#### Scenario: Viewport epoch 已变化

- **WHEN** stream callback 或 input acknowledgement 携带旧 viewport epoch
- **THEN** Pane SHALL 丢弃它
- **AND** 在启用 human input 前 SHALL 重新取得 viewport lease。

### Requirement: Agent 与 human input SHALL 使用排他 control lease

默认 control mode SHALL 为 `agent`。`browser.control.takeover` SHALL 只请求 human control，SHALL NOT 在本地授予控制权。Browser Automation Owner SHALL 先在安全边界暂停 Agent input，普通 projection 才能确认 `controlMode=human`。Authenticated viewport Transport SHALL 在内部接收并保留未过期的本地 `BrowserControlLeaseV1`；generic Pane controller SHALL NOT 收到 lease 或其 ref，二者也 SHALL NOT 进入 projection、Typert events、restore state、logs 或 evidence。Ref SHALL NOT 作为独立 bearer credential。Lease 有效期间，Owner SHALL 拒绝 Agent input；Transport SHALL 把允许的 human pointer、wheel、keyboard、text 与 resize events 绑定到 exact lease 和单调递增 sequence。

Pointer coordinates SHALL 在去除 letterbox 后归一化；wheel delta、key/text length SHALL 有界；resize SHALL 保持在 320–4096 × 240–4096；已发送的非 move input SHALL 获得 acknowledgement，且不得自动 replay。`browser.control.release`、lease expiry 或 owner revocation SHALL 立即停止 human input。只有新 owner projection 确认后，Pane 才能再次显示 Agent control。Clipboard、upload、drag-and-drop upload、camera、microphone、geolocation 与 notification input SHALL 保持禁用。

#### Scenario: Agent 正在操作时 human 请求接管

- **WHEN** 用户在 Agent action 仍 in flight 时提交 `browser.control.takeover`
- **THEN** Pane SHALL 保持 `transition`，直到 Owner 暂停或收敛该 action 并授予 human lease
- **AND** 在 owner projection 确认 `human` 前，SHALL NOT 发送 human input 或声称已取得控制权。

#### Scenario: Human control 期间收到 Agent input

- **WHEN** 有效 human control lease 存在时，Owner 收到 Agent input
- **THEN** Owner SHALL 拒绝该 Agent input
- **AND** Pane SHALL 继续显示唯一 human controller，不得出现 dual-control state。

### Requirement: Browser effect SHALL 保持 owner-authored action

Provider SHALL 按当前状态发布适用的 `PaneActionDescriptorV1`：`browser.navigate`、`browser.history.back`、`browser.history.forward`、`browser.reload`、`browser.stop`、`browser.tab.open`、`browser.tab.close`、`browser.tab.activate`、`browser.control.takeover`、`browser.control.release`、`browser.download.request`、`browser.evidence.screenshot` 与 `browser.evidence.dom`。

每个 `PaneActionRequestV1` SHALL 绑定 exact context、descriptor ref/expiry、expected target ref/version 与 idempotency key。Host SHALL 在当前 Browser Automation binding 和 Provider contract digest 下解析 descriptor ref；映射缺失、过期或不匹配时 SHALL 返回 `contract_mismatch`。Pane SHALL NOT 在本地执行 effect、乐观修改状态，或在 owner receipt 与后续 projection 前推断成功。

#### Scenario: Navigation outcome 为 unknown

- **WHEN** `browser.navigate` dispatch 后 transport 失败，且没有 terminal owner receipt
- **THEN** action SHALL 进入 `unknown` 或 `reconcile_required`
- **AND** Pane SHALL NOT retry、标记页面已导航或修改 browser history。

### Requirement: Navigation target SHALL 临时存在并由 owner 校验

地址显示 SHALL 使用 `BrowserSafeLocationV1`，而不是 raw URL。用户输入的 full target MAY 只存在于本地 edit draft 和一次 `PaneActionRequestV1.values.target`，长度 SHALL 为 1–2048 字符。Draft 在提交、component teardown 或 context/page/generation 变化后 SHALL 清除；SHALL NOT 进入 restore state、projection、event、receipt、log、telemetry 或 evidence。

Host SHALL 使用标准 URL parser 解析 target，只接受带显式 scheme 的 absolute `http`/`https` URL，并拒绝 bare host、relative target、URL userinfo、malformed value 和 unsafe scheme。Pane SHALL NOT 把无 scheme 输入推断为 search 或自动补全地址。DNS、redirect、SSRF、private-network access、egress、host policy 与 credential injection SHALL 保持 Browser Automation Owner 职责。

#### Scenario: 用户输入 unsafe scheme

- **WHEN** 用户提交 `file:`、`data:`、`javascript:` 或 malformed target
- **THEN** Host SHALL 在 Provider dispatch 前拒绝该 request
- **AND** rejected target SHALL NOT 回显到 projection、receipt、error summary 或 log。

### Requirement: Browser lifecycle SHALL 绑定 generation 与 epoch

Context、automation session、runtime generation、page 或 viewport epoch 变化，以及 Pane close、HMR、bundle dispose，SHALL abort pending work、取消 event subscriptions、detach viewport attachments、停止 media tracks、移除 observers/listeners 并清除 ephemeral drafts。Replacement binding 在启用 mutation 或 human input 前 SHALL 取得完整有效 snapshot。Teardown SHALL 幂等。

关闭或 suspend Pane SHALL detach view，但 SHALL NOT 终止 Provider-owned automation session。

#### Scenario: Tenant switch 后旧 event 迟到

- **WHEN** active context generation 已变化，旧 binding 的 event、receipt、stream callback 或 input acknowledgement 才到达
- **THEN** client SHALL 丢弃它
- **AND** SHALL NOT 显示或操作旧 session 的 page、control、download 或 evidence refs。

#### Scenario: Human takeover 期间关闭 Pane

- **WHEN** human control lease 与 viewport attachment 有效时，用户关闭 Pane
- **THEN** client SHALL 停止发送 input 并 detach 本地 media resources
- **AND** automation session termination 或 control reassignment SHALL 保持 Owner 决策。

### Requirement: Browser content SHALL 保持 untrusted evidence

Page text、DOM、OCR、images、downloads、QR codes 与 web instructions SHALL NOT 扩大 Host、Agent、filesystem、credential、approval 或 network authority。Page-originated content SHALL NOT 自行触发 tool、navigation、download、upload、takeover 或 approval。Screenshot 与 DOM evidence SHALL 保持 Owner-controlled opaque resources；查看完整内容前 SHALL 通过独立授权的 bounded resolver。

#### Scenario: Page 指示 Agent 执行命令

- **WHEN** page content 要求 Agent 忽略 policy、执行命令、泄露 credential 或上传文件
- **THEN** content SHALL 保持 quoted browser evidence
- **AND** 不得由该 content 授权 tool、credential、filesystem、network、upload 或 approval action。

### Requirement: Download 与 evidence SHALL 保持 Owner resource

`browser.download.request` SHALL 只操作 Owner-authored download candidate，并返回 bounded metadata 与 opaque evidence/artifact refs；SHALL NOT 返回 filesystem path、file bytes、raw URL，也不得自动打开文件。`browser.evidence.screenshot` 与 `browser.evidence.dom` SHALL 通过 Owner 捕获 exact page/version，并返回 refs，而不是 inline bytes 或 raw DOM。

#### Scenario: Download 需要额外 approval

- **WHEN** Owner 将 download 分类为需要 approval 或 policy review
- **THEN** receipt SHALL 保持 `approval_required` 或 `rejected`，直到 Owner 收敛结果
- **AND** Pane SHALL NOT 在本地 fetch、save、preview 或标记 download complete。

### Requirement: Browser UI state SHALL 确定且可访问

Pane SHALL 区分本地 phases `probing`、`search_only`、`needs_contract`、`unavailable`、`connecting`、`active` 与标准 Provider statuses。Mutation 只有在 exact、fresh、`active` binding 且 status 为 `ready` 或 `running` 时才能启用。`stale`、`offline`、`permission_denied`、`contract_mismatch`、`unknown`、`reconcile_required` 与 control transition state SHALL 禁用 mutation。

UI SHALL 支持 390、768、1440 pixel layouts、keyboard navigation、visible focus、screen-reader labels 与 reduced motion。Human keyboard input 只有在 viewport 明确聚焦、control mode 为 `human` 且 Transport 内部 lease 有效时才能转发；地址栏或其他控件聚焦时 SHALL NOT 转发，也不得安装 window-level 全局键盘捕获。Control、freshness、loading、approval 和 error state SHALL NOT 只依赖颜色。

#### Scenario: 编辑地址时 projection 变 stale

- **WHEN** 用户正在编辑 target，Provider 将 session 标记为 `stale`
- **THEN** Pane SHALL 禁用提交、清除 full target draft 并播报 stale state
- **AND** 只保留最后一个 safe projected location summary。

### Requirement: V0.1 completion SHALL 使用 fake Provider conformance path

本 change SHALL 包含 fake `BrowserAutomationProviderV1` 与 fake `BrowserViewportTransportV1`，通过真实 bundle、Pane Registry、Typert `browserPane` Remote/events、reducer、control lease 与 lifecycle 完成验证。Completion SHALL NOT 依赖 official DSH merge、`dsh web` boot、真实 Browser Automation Provider、production credential 或 live network access。

#### Scenario: Fake-provider 协作流程完成

- **WHEN** integration runner 执行 Agent activity、viewport attach、human takeover、sequenced human input、release、generation reset 与 bundle dispose
- **THEN** 每次 state change SHALL 有 Provider event、input acknowledgement 或 owner receipt
- **AND** run 结束后 SHALL 不残留 subscription、media track、observer、listener 或 stale-generation mutation。
