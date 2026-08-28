# dsh-token-usage-panel-v1

## Why

DSH Web 目前没有跨会话的 token 消耗账本。官方 `tokenMeter` 只给当前会话投影 `tokenUsage` / `contextPressure`（上下文占用，不是账单）；子代理监视器只展示单节点用量。用户无法回答「这台 DSH 今天/本周用了多少 token」，也无法在 DeepSeek 官方路由上实时看到账户余额。DeepSeek 已提供 `GET /user/balance`，但必须在 Host 侧用已有凭据查询，浏览器绝不能持有 API key 或直打官方接口。

## What Changes

- 新增 client 插件 `@yeisme/dsh-client-ui-token-usage`：在 DSH Web 提供 token 用量面板。
  - **主入口**：会话头 `conversation.session.header.actions` 的 “Tokens” 按钮；探测到 Pane Workbench V2（`paneWorkbench` + `shell.workspace.right`）时，打开右侧栏 navigator 视图 `workspace.token-usage`。
  - **降级入口**：Pane 协议缺失时，不伪造右侧栏几何；改为 `shell.overlay` 弹窗（常驻 seat、空闲零渲染），按钮仍可用并写明原因。
- 新增 host 插件 `@yeisme/dsh-token-usage-host`：进程级用量账本 + DeepSeek 余额查询的唯一 owner。
  - 账本从当前会话 `tokenUsage` 投影增量折叠（uncached input / output / cache read / cache write），按会话、提供方、日/周窗口汇总。
  - DeepSeek 官方路由（`deepseek-official`）经 Host 复用既有 `ctx.credentials` / `apiKeyEnv` 调用 `GET {baseURL}/user/balance`，向浏览器只发白名单余额投影。
- 新增 bundle `@yeisme/dsh-token-usage`（`dsh plugin --profile web add`），组合 host + client。
- 浏览器 MUST NOT 持有 API key、raw URL、cookie、完整思维链或未脱敏 provider payload；额度查询失败走诚实降级，不猜测余额。

## Boundary Decision

`split-owner`：

- 会话级 token 计数的权威是 DSH `tokenMeter` 投影（`projectionValues.tokenUsage`）。插件只折叠已发布的 disjoint buckets，不重放 session log、不自建 tokenizer。
- 跨会话账本与 DeepSeek 余额的权威是本仓库 Host 插件。Client 只读 Remote 投影。
- 凭据、base URL、官方 HTTP 调用留在 Host；Client 只渲染 `isAvailable`、币种、金额字符串与 freshness。
- 插件不替代官方上下文压力条，不实现计费单价/人民币换算（官方余额已是金额；token 账本只记 token 数）。

## Capabilities

### New Capabilities

- `dsh-token-usage-panel`: Web 右侧栏 / overlay 弹窗的只读用量面板、入口探测与诚实降级。
- `dsh-token-usage-ledger`: Host 侧跨会话 token 账本投影（按会话 / 提供方 / 日窗口）。
- `dsh-deepseek-balance`: DeepSeek 官方路由的 Host 余额查询与安全投影。

### Modified Capabilities

无。主 spec 尚不存在，本 change 只 ADDED。

## Impact

- 新增包：`packages/host/dsh-token-usage/`、`packages/client/ui-token-usage/`、`packages/bundle/dsh-token-usage/`。
- 不改官方 DSH core；不占用 `sidebar` 会话列表；不与 pane-workbench 抢 `shell.workspace.right` occupant（只注册 Pane view，由 workbench 打开右侧栏）。
- 完成门：本仓库 `typecheck` / 包测试 / `build` / `check:bundles` / `openspec validate dsh-token-usage-panel-v1 --strict`。不含启动官方 `dsh web`。
- 稳定合同：Remote schema `token.usage.snapshot.v1alpha1` 与 `token.balance.snapshot.v1alpha1` 为预 1.0（`v1alpha1`），本 change 内可迭代；发布后增字段保持兼容。
