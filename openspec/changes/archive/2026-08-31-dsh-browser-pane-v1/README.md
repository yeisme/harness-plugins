# dsh-browser-pane-v1

状态：`spec-ready / implementation-pending`。

本 change 定义 DSH 的契约优先 Browser Pane。主要用户流程是：Agent 操作网页，人类观察实时视口；人类可申请排他接管，完成输入后再把控制权归还 Agent。

## Ownership

- Harness Plugins 拥有 Pane UI、safe projection、typed action、viewport abstraction、fake Provider 与 bundle conformance。
- 外部 Browser Automation Owner 拥有真实浏览器进程、页面、网络、凭据、下载、媒体传输、输入仲裁与终态 receipt。
- `ctx.web`、search link、iframe 和浏览器端 fetch 都不是 Browser Automation session。

## Frozen identifiers

| Item | Value |
| --- | --- |
| plugin id | `dsh-browser-pane` |
| Pane kind | `dsh.browser` |
| Open command | `browser.open` / `/browser` |
| Host context key | `dsh.browserPaneHost` |
| Client Transport context key | `dsh.browserViewportTransport` |
| Typert namespace | `browserPane` |
| Host package | `@yeisme/dsh-browser-host` |
| Client package | `@yeisme/dsh-client-ui-browser-pane` |
| Bundle package | `@yeisme/dsh-browser-pane` |
| Initial version | `0.1.0-rc.1` experimental |

## Delivery boundary

本 change 交付完整 UI/contract/fake-provider 测试面，不交付真实 Browser Automation Provider、WebRTC/CDP 服务、凭据、网络代理或生产部署。没有 Provider 时，Pane 只显示 `search_only`、`needs_contract` 或 `unavailable`，不伪造交互页面。

## Reading order

1. `proposal.md`：价值、owner、兼容性和范围。
2. `design.md`：包结构、公开接口、数据流、UI、控制权和故障处理。
3. `specs/dsh-browser-pane/spec.md`：可验收 SHALL requirements。
4. `tasks.md`：实现切片、验证命令和 promotion gate。

## Spec validation

```bash
openspec validate dsh-browser-pane-v1 --strict --no-interactive
git diff --check
```

实现完成后的 package 与 integration 命令见 `design.md` 和 `tasks.md`。
