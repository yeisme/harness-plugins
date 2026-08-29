## Why

根级 `dsh-pane-plugin-ecosystem-v1` 保留了可操作 Browser Pane，但此前没有 owning subproject change，也没有确定 BrowserSession authority。Web search、`ctx.web`、任意 iframe 或浏览器端 fetch 都不能替代一个有 session、sandbox、credential、download、manual takeover 和 evidence 生命周期的 BrowserSession。

本 change 把 DSH surface/probe 责任迁入 Harness Plugins，同时明确真实 BrowserSession provider 仍是外部 typed authority。Provider 未就绪时 Browser Pane 必须诚实显示 `unavailable`/`needs_contract`，不能用 DOM patch、轮询或本地伪状态兜底。

## What Changes

- 新增 experimental `browser.session.projection.v0.1`、`browser.session.event.v0.1` 与 `browser.session.action.v0.1` consumer contracts。
- 新增 DSH Browser Pane host/client provider、capability probe、bounded snapshot/event reducer 和 lifecycle teardown。
- 定义 navigate、back/forward/reload、manual takeover、download、screenshot/DOM evidence 等 typed intents；所有 mutation 仍由 BrowserSession owner admission 并返回 receipt/reconcile。
- 将 search/result links 与可操作 BrowserSession 明确分离；无 provider 时只展示 unavailable reason 和 owner handoff。
- 增加 fixture conformance、安全、a11y、responsive 和 evidence runner tasks；不要求或实现真实浏览器 provider。

## Admission Decision

`split-owner`。

- Harness Plugins：拥有 DSH Pane surface、safe projection adapter、client reducer、typed intent 和 conformance。
- BrowserSession provider：未来明确批准的浏览器运行时 owner，拥有 session/process/page/credential/download/network policy、manual takeover 和终态 receipt。
- DSH core：只提供公开 plugin/client slots 与 lifecycle seam；不通过私有 DOM/core patch 补能力。

## Capabilities

### New Capabilities

- `dsh-browser-pane`: provider-gated Browser Pane、安全投影、typed action/evidence 和 lifecycle contract。

### Modified Capabilities

无。所有 surface 为 pre-1.0 additive experimental；不修改 `ctx.web`、search 或既有 Pane contracts。

## Impact

- 目标路径：Harness Plugins 的新 Browser host/client/bundle packages 或现有 Pane package 的 additive provider registration，具体由实现任务冻结。
- 不创建 BrowserSession backend、浏览器凭据 store、任意 iframe proxy、网络代理、browser automation scheduler 或 domain state。
- 真实 provider、远程浏览器、credential、download 和网络访问需要独立 owner OpenSpec 与明确权限；本 change 默认只用 fake provider/fixture。
