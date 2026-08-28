# Design: dsh-token-usage-panel-v1

## Context

DSH 官方已经有会话级 token 计量，但没有「这台 Harness 用了多少」的产品面：

```
官方 tokenMeter（会话权威）
  tokenUsage: uncachedInput / output / cacheRead / cacheWrite
  contextPressure: 下一请求占用，不是账单

本仓库现状
  ui-pane-subagent 只读单节点 tokenUsage
  session-cookie-manager 有配额骨架，但是站点配额，不是 LLM token
  无跨会话账本，无 DeepSeek 余额面
```

用户要的是 DSH Web 上的用量工具：记录通过 DSH 消耗的 token 总量，DeepSeek 官方路由再叠加实时额度。产品面明确为 **右侧栏面板为主、弹窗为降级**。

约束来自本仓库治理：

- Host 只向浏览器传 safe projection：opaque ref、有界摘要、freshness、server-authored action。
- 不传 cookie / token / raw URL / 文件路径 / 任意 fetch。
- 插件完成门不依赖官方 `dsh web` 或官方合入。
- 新 capability 只写 `ADDED`。

DeepSeek 官方余额合同（[Get User Balance](https://api-docs.deepseek.com/api/get-user-balance/)）：

```
GET {baseURL}/user/balance
Authorization: Bearer <host-resolved api key>

200:
{
  "is_available": true,
  "balance_infos": [
    {
      "currency": "CNY" | "USD",
      "total_balance": "110.00",
      "granted_balance": "10.00",
      "topped_up_balance": "100.00"
    }
  ]
}
```

`llm-deepseek` 已按请求从 `ctx.credentials` + `apiKeyEnv`（默认 `DEEPSEEK_API_KEY`）解析密钥，配置不存字面密钥。余额查询必须走同一条 Host 解析路径。

## Goals / Non-Goals

**Goals:**

- 在 DSH Web 提供一个只读用量面板：当前会话、今日、本周、按会话、按提供方。
- 探测到 Pane Workbench V2 时，面板落在右侧栏 `workspace.token-usage` navigator。
- Pane 协议缺失时，同一份面板内容落到 `shell.overlay` 弹窗，入口按钮不装死。
- DeepSeek 官方路由可刷新余额；非 DeepSeek / 凭据缺失 / 网络失败诚实降级。
- Host 是账本与余额的唯一 writer；Client 只订阅 Remote。

**Non-Goals:**

- 不实现官方上下文压力条的替代品（那是 `contextPressure`，会话占用）。
- 不在插件里做 tokenizer / 价格表 / CNY 换算；token 账本只记 disjoint token 数，金额只来自官方 `balance_infos`。
- 不在浏览器 fetch DeepSeek，不把 API key 投影到 Client。
- 不占用 `sidebar` 会话列表，不自己实现 `shell.workspace.right` occupant（避免与 pane-workbench 抢几何）。
- 不做跨机器同步、多租户账单、发票、自动充值。
- 不把官方 `dsh web` 启动写成完成门。
- 本 change 不做 visual-kit 深度 adoption（最小内联样式；后续独立任务）。

## Decisions

### D1. 产品面：右侧栏为主，overlay 弹窗为降级

| 面 | Slot / 协议 | 何时用 |
| --- | --- | --- |
| 入口按钮 | `conversation.session.header.actions` id `token-usage-open` | 始终注册 |
| 右侧栏 | Pane view `workspace.token-usage`，`preferredRegion: 'right'`，singleton navigator | `paneWorkbench` + `shell.workspace.right` 齐全 |
| 弹窗 | `shell.overlay` 常驻 seat，空闲零渲染 | Pane 协议缺失 |

对齐先例：`ui-pane-subagent` / `ui-creator-studio` 用 header action 打开右侧栏；`ui-session-tags` 用 `shell.overlay` 做弹窗且空闲零输出。MCP inspector 占用 `conversation.view` tab 是因为 MCP 是会话轨迹的一部分；用量是进程级账本，不该挤进会话 tab 环。

不选 `sidebar.footer.action` 作为主面板：那是 footer 小块（Ordo 值班摘要），装不下日/周/会话拆分。Footer 最多作为次要启动器，本 change 不做，避免和 Creator Studio / Rich Media 抢位。

```
┌─────────────────────────────────────────────────────────────┐
│  DSH Web                                                    │
│  [session header]  ...  [Tokens]                            │
│                                                             │
│  conversation          │  Right pane (Pane Workbench)       │
│                        │  ┌───────────────────────────────┐ │
│                        │  │ Tokens                        │ │
│                        │  │ Session  12.4k  ·  Today 88k  │ │
│                        │  │ Week     1.2M                 │ │
│                        │  │ DeepSeek CNY 110.00  [Refresh]│ │
│                        │  │ by session / by provider      │ │
│                        │  └───────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘

Pane 缺失时：

┌──────────────────────────────────────┐
│ overlay dialog role=dialog           │
│ Tokens                          [x]  │
│  (同一 TokenUsagePanel 组件)          │
└──────────────────────────────────────┘
```

### D2. 包切分：host / client / bundle

```
packages/host/dsh-token-usage
  ledger.ts          进程内折叠
  balance.ts         DeepSeek GET /user/balance
  remote.ts          Typert Remote: snapshot / refreshBalance
  projection.ts      白名单 schema

packages/client/ui-token-usage
  projection.ts      纯函数：Remote → 视图模型
  panel.tsx          共享面板（右栏与弹窗共用）
  pane-view.tsx      workspace.token-usage
  overlay.tsx        shell.overlay seat
  client.ts          probe + 注册

packages/bundle/dsh-token-usage
  cordis.patch.yml   insert host + client
```

Client 不写账本。Host 不渲染 DOM。

### D3. 账本折叠：只消费已发布的 `tokenUsage` 投影

官方 `tokenUsage` 已经对 `(turn, step)` 做了替换而不是双计。Host 订阅当前会话列表快照：

```
for each session in sessions.list.byId:
  buckets = session.projectionValues.tokenUsage
  if missing → skip (诚实：该会话无计量)
  delta = buckets - lastSeen[sessionId]
  add delta into:
    sessionTotals[sessionId]
    providerTotals[providerId]
    dayWindow[utcDay]
    weekWindow[utcWeek]
    processTotals
  lastSeen[sessionId] = buckets
```

规则：

- buckets 是 disjoint：`total = uncachedInput + output + cacheRead + cacheWrite`。不把 `reasoningTokens` 再加一遍。
- 会话从列表消失不扣减历史（用量已经发生）；只停止继续累加。
- Host 重启后 `lastSeen` 为空：第一次快照把当前 totals 当作增量（会话日志里的历史用量会进入账本一次）。这是可接受的进程账本语义，不是跨重启持久账单。
- 持久化：本 change **进程内内存**。不引入新的存储 schema，避免和 session persistence owner 抢权威。若后续要跨重启，另开 change 用 sidecar，且不得写 raw prompt。

提供方维度：从会话摘要已有的 provider/model 安全字段读取（若缺失则归入 `provider: unknown`，UI 显示 `Unknown provider`，不猜测 `deepseek-official`）。

### D4. DeepSeek 余额只在 Host，且只对官方路由

探测顺序：

1. 当前会话或进程默认 provider 是否为 `deepseek-official`（或 baseURL host 为官方 DeepSeek API）。
2. Host 能否经 `ctx.credentials` 解析 `apiKeyEnv`。
3. 解析成功才 `GET {baseURL}/user/balance`。`baseURL` 默认官方文档的 API root；禁止把用户输入 URL 透传给浏览器。

投影 `token.balance.snapshot.v1alpha1`：

```ts
{
  schemaVersion: 'token.balance.snapshot.v1alpha1'
  status: 'ready' | 'unavailable' | 'unsupported' | 'error'
  freshness: 'fresh' | 'stale' | 'unknown'
  generatedAt: string // ISO
  reasonCode?:
    | 'provider_not_deepseek'
    | 'credential_missing'
    | 'network_failed'
    | 'contract_mismatch'
  safeMessage: string
  isAvailable?: boolean
  infos?: Array<{
    currency: 'CNY' | 'USD'
    totalBalance: string
    grantedBalance: string
    toppedUpBalance: string
  }>
}
```

禁止字段：apiKey、Authorization、baseURL、raw response body、account id、email。金额保持官方字符串，不做 number 解析（避免精度/格式猜测）。

刷新：Client 只发 server-authored action `refreshBalance`（无参数或仅 idempotency key）。Host 限流（最短间隔 15s）。失败保持上一份投影并标 `stale`/`error`，不清空数字装死，也不编造 0。

非 DeepSeek：`status: unsupported`，`reasonCode: provider_not_deepseek`，UI 隐藏金额、显示「Balance is available for DeepSeek official route only」。

### E. Remote 合同

服务 key：`tokenUsage`。

```
tokenUsage.snapshot() ->
  | { ok: true, specVersion, usage, balance }
  | { ok: false, code, message }

tokenUsage.refreshBalance() ->
  | { ok: true, specVersion, balance }
  | { ok: false, code, message }
```

`usage` schema `token.usage.snapshot.v1alpha1`：

```ts
{
  schemaVersion: 'token.usage.snapshot.v1alpha1'
  generatedAt: string
  freshness: 'fresh' | 'stale' | 'unknown'
  currentSession?: {
    sessionRef: string // opaque
    label: string      // safe label
    buckets: TokenBucketsV1
  }
  windows: {
    today: TokenBucketsV1
    week: TokenBucketsV1
    process: TokenBucketsV1
  }
  bySession: Array<{ sessionRef: string; label: string; buckets: TokenBucketsV1 }> // 有界，默认最多 20
  byProvider: Array<{ providerId: string; label: string; buckets: TokenBucketsV1 }>
}

type TokenBucketsV1 = {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}
```

`sessionRef` 走 pane-protocol safe ref（拒绝路径/URL/凭据形态）。列表截断必须在投影里声明 `truncated: true`，UI 不得假装完整。

预 1.0：`v1alpha1` 本 change 内可加可选字段；发布后删除/重命名走 evolutionary-change-policy。

### D5. Client 探测与降级矩阵

| 条件 | 入口 | 面板 |
| --- | --- | --- |
| Remote 缺失 | 按钮 disabled，title 说明 Host 不可用 | 不打开 |
| Remote 就绪 + Pane V2 就绪 | 按钮打开右侧栏 | Pane view |
| Remote 就绪 + Pane 缺失 | 按钮打开 overlay | dialog |
| `tokenUsage` 投影缺失 | 面板可用 | 会话块显示「Usage unavailable in this version」 |
| DeepSeek 余额 unsupported/error | 面板可用 | 余额块降级文案，Refresh 在 unsupported 时禁用 |

禁止死按钮：Remote 缺失时按钮可见但 disabled 且原因可读，与 Creator Studio unavailable launcher 一致。

### D6. 安全与红线

- 浏览器零凭据、零 raw URL、零绝对路径。
- 测试 fixture / evidence 只用 `CNY` + `"110.00"` 这类文档示例金额，不用真实账户。
- Host fetch 的完整 JSON 不得写入日志；只记 `status`、`reasonCode`、currency 枚举。
- overlay / pane 的 DOM 扫描测试：`/(api[_-]?key|bearer|authorization|sk-)/i` 零命中。

## Risks / Trade-offs

- [进程内存账本，重启清零] → 产品文案写明 “since process start”；跨重启持久化另开 change。
- [会话首次快照把历史 totals 一次打入账本] → 文档化为 ledger 语义；不在 Client 再估一版。
- [余额接口不是 token 配额而是人民币/美元余额] → UI 标题用 “DeepSeek balance”，不用 “token quota”，避免和 token 账本混名。
- [官方 tokenMeter 未挂载时无会话用量] → 会话块诚实降级；进程账本仍可显示已折叠会话。
- [与 pane-workbench 抢右侧栏] → 本插件只 `registerView` + `openView`，不 `inject('shell.workspace.right')`。
- [DeepSeek 非官方兼容网关也叫 deepseek] → 仅 `deepseek-official` 或官方 host 才查余额；其它归 unsupported。
- [15s 限流让「实时」变「近实时」] → 可接受；避免把官方余额接口打爆。文案显示 `generatedAt`。

## Migration Plan

全新包，无旧合同。安装：

```
dsh plugin --profile web add @yeisme/dsh-token-usage
```

回滚：移除 bundle 即卸载 slot、Remote、locale；无持久状态可残留。

## Open Questions

- 跨重启持久化是否需要（用户未要求；本 change 不做）。
- Footer 次要入口是否补（本 change 不做，避免和现有 footer 插件抢位）。
- 官方若未来提供 token 配额而不仅是金额，再扩展 `infos` 可选字段，不改现有金额字段。
