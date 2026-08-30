## Why

根级 `dsh-native-workspace-panes` 已要求 Browser Pane 展示页面、导航、视口、Agent 活动、证据、下载与人工接管，但 Harness Plugins 还没有一份可直接实现的 owning change。现有 `ctx.web` 只负责 search/fetch；URL、iframe、浏览器端 fetch 或 React 本地状态都不能替代具有页面进程、网络策略、凭据隔离、输入控制与终态回执的浏览器自动化 owner。

仓库内的 `BrowserSession` 还可能表示 DSH Web 登录或控制平面会话。为了避免把认证会话误当成网页自动化会话，本 change 将新公开合同统一命名为 `BrowserAutomation*`，并把 Pane 定位为外部 owner 的安全消费面。

目标体验是 Agent 协作浏览：Agent 驱动页面，人类在 DSH Pane 中观察实时视口；需要时，人类申请排他接管，完成操作后再把控制权归还 Agent。真实浏览器运行时尚未选定，因此 v0.1 先冻结 UI、类型合同、假 Provider 与 conformance，避免用伪页面或不受控网络访问抢跑。

## What Changes

- 新增三个 experimental 包边界：`@yeisme/dsh-browser-host`、`@yeisme/dsh-client-ui-browser-pane` 与 `@yeisme/dsh-browser-pane`；Browser Pane 保持独立可选 bundle，不并入 Desktop Workbench。
- 新增 `BrowserAutomationProviderV1`、浏览器安全面 `BrowserPaneHostV1`、低频 snapshot/event/action 合同，以及通过 `dsh.browserViewportTransport` 注入的 client-local `BrowserViewportTransportV1` 视口附件合同。
- 新增 `browser.automation.projection.v0.1`、`browser.automation.event.v0.1`、`browser.automation.action.v0.1` 与 `browser.viewport.attachment.v0.1` capability。
- 注册 `browser.open` / `/browser` 入口和非 singleton 的 `dsh.browser` Pane：入口从最多 16 个安全 session handles 中选择，一个 Pane 绑定一个 opaque automation session，Pane 内最多显示 32 个 owner 页面。
- 定义导航、历史、reload/stop、页面切换、人工接管、下载授权与 screenshot/DOM evidence 等 owner-authored actions。任何 mutation 只以 receipt 与新 projection 收敛；`unknown` 只进入 reconcile，不自动重试。
- 把低频状态与高频媒体/输入分离：Pane event 不携带视频帧、媒体地址、凭据或签名 URL；Provider 只返回不透明 viewport lease，由注入的 Transport 在浏览器本地解析为 `MediaStream`。
- 定义排他 `BrowserControlLeaseV1`：人工接管前 owner 必须在安全边界暂停 Agent 输入；租约期间拒绝 Agent 输入；释放、拒绝、过期与未知结果都以 owner 回执为准。
- 定义脱敏地址与临时导航输入：projection 只显示协议、punycode host 和路径摘要；用户完整目标只存在于一次 action request，不能回写 projection、receipt、日志或证据。
- 增加 fake Provider、fake viewport Transport、契约负例、reducer/lifecycle/component/a11y/responsive 测试，以及标准 integration evidence runner。
- Provider 缺失时保留可诊断入口并显示 `search_only`、`needs_contract` 或 `unavailable`；不渲染可用地址栏、交互视口、接管、下载或 evidence 控件。

## Admission Decision

`split-owner`。

| Owner | 本 change 内职责 | 本 change 外职责 |
| --- | --- | --- |
| Harness Plugins | Pane UI、plugin/bundle 注册、安全投影、typed action、viewport 抽象、fake Provider 与 conformance | 不拥有浏览器进程、页面、网络、凭据、下载文件或 evidence 原文 |
| Browser Automation Owner | 未来实现 session/process/page/network/credential/download/stream、Agent 输入仲裁、人工接管租约与终态 receipt | 需独立 OpenSpec、权限模型与运行证据；本 change 不选择具体实现 |
| DSH Core | 提供公开 plugin/client slots、Typert Remote 与 lifecycle seam | 不为本 change 增加私有 DOM、路由或 iframe bridge |
| 可选 Provider Adapter | 将某个已批准的远程浏览器服务适配到 `BrowserAutomationProviderV1` | Firecrawl 或其他服务都不得成为 Pane 固定依赖 |

## Capabilities

### New Capabilities

- `dsh-browser-pane`：契约优先的 Agent 协作 Browser Pane、安全投影、排他人工接管、typed action/evidence、视口附件与 generation-safe lifecycle。

### Modified Capabilities

无。所有 surface 都是尚未发布的 additive experimental `v0.1` 合同；不修改 `ctx.web`、Pane protocol、Desktop Workbench 或 DSH 登录会话合同。

## Compatibility Classification

| Surface | Classification | Policy |
| --- | --- | --- |
| 新 package/import path | additive, pre-release | 首次计划发布为 `0.1.0-rc.1` |
| 新 TypeScript interfaces | additive, experimental | 首次发布后只允许新增 optional 字段；删除、改名、必填化或语义复用需新 migration change |
| 新 capability 与 action id | additive, experimental | 老 profile 可忽略；未知 capability/action 必须 fail closed |
| Pane view/command contribution | additive | 未安装 bundle 时既有 Workbench 行为不变 |

本次把未发布草案中的 `BrowserSessionProviderV1` 更名为 `BrowserAutomationProviderV1`，没有代码或外部 consumer，不需要 deprecation window。`0.1.0-rc.1` 发布后开始执行 additive-only 兼容策略。

## Impact

- 规格冻结的目标路径为 `packages/host/dsh-browser-host/`、`packages/client/ui-browser-pane/` 与 `packages/bundle/dsh-browser-pane/`。
- 现有 `@yeisme/dsh-pane-protocol` 与 `@yeisme/dsh-client-ui-pane-workbench` 只作为依赖使用；本 change 不要求修改其稳定 schema。
- 不创建 Browser Automation backend、浏览器凭据 store、网络代理、iframe proxy、automation scheduler、session creation UI、下载文件存储或生产部署。
- 真实 Provider、远程媒体传输、credential/network policy 与生产 promotion 必须另建 owner change；本 change 的完成门是 fake Provider 经公开 DSH plugin/client seam 的协议一致性。
- 回滚只移除 `@yeisme/dsh-browser-pane` bundle row 和本地注册；不得删除 Provider 侧 session、下载或 evidence。
