# Design: dsh-mcp-inspector-debug-cards-v1

本 change 是设计工件 only：本文件冻结决策与合同，实现任务见 tasks.md（面向后续波）。
语义真源是根仓冻结合同 `aigora-mcp-gateway-sidecar-unified-key-v1` §6.2 失败分类法与
`specs/aigora-mcp-observability-projections/spec.md`；本仓只做只读消费与呈现。

## 1. 失败解码卡：信号源与数据路径

三路信号，全部是既有 pane 已能观察的面，零新增 host seam：

1. **ConversationSnapshot 派生的调用错误**：`kind === 'tool-result'` 节点的
   `error.code`/`error.name`，经 `deriveToolActivity` 既有安全门
   （`/^[A-Za-z0-9_.:-]{1,120}$/`、`/^[A-Za-z0-9_. -]{1,120}$/`）成为
   `ToolActivityRecord.errorCode/errorName`。这是主信号——用户在会话里实际看到的
   MCP 调用失败。
2. **`toolHub` client error code**：`ToolHubClientError.code` + `accessDenied`
   （`normalizeToolHubClientError`），描述目录/启停面自身的失败。
3. **目录派生的空工具信号**：`ToolHubCatalogV1` 中某 MCP server
   `health.state === 'connected'` 而 `toolCount === 0`——doctor 语义里的
   "healthy process but empty tools"。

解码为纯函数 `decodeToolFailure(signal): DecodedFailure`（框架无关，与
`deriveMcpActivity` 同款单测形态）；组件只做渲染。

## 2. 冻结分类法映射表

每个码渲染 `{title, likely causes, next actions}`（zh/en 经 locale，不硬编码）：

| 观察信号 | 冻结分类法码 | 依据 |
| --- | --- | --- |
| `errorCode`/`errorName` 呈 401 / unauthorized / token invalid | `unauthenticated` | doctor 语义 |
| 403 / forbidden / permission denied | `permission_denied_or_unknown_action`（合并码） | doctor 语义 |
| server 健康但 `tools/list` 为空（信号源 3） | 合并码（同上） | 空暴露与拒绝不可区分（存在性预言机） |
| 分类法码字面量（gateway 在路径上时透传 `approval_required`/`budget_exceeded`/`rate_limited`/`upstream_unavailable`/`permission_denied_or_unknown_action` 等） | 同名码 | 真源 envelope 直读，不改写 |
| `approval_required` | `approval_required` | operator evidence 缺失 |
| `budget_exceeded` / 402 / quota 语义 | `budget_exceeded` | 可带 bounded `retry_after_seconds` |
| 429 / too many requests / rate limit | `rate_limited` | 可带 bounded `retry_after_seconds` |
| 502/503/504 / upstream / backend failed / timeout / connection refused | `upstream_unavailable` | 上游不可用 |
| `-32601`（method/tool not found、wrong path） | `protocol_error` | doctor 语义：错路径/不支持的方法 |
| 其余 `-32700…-32603` JSON-RPC 协议码（未被上表吸收） | `protocol_error` | 协议层失败 |
| toolHub 面错误且归一器携带结构化 401 原因 | `unauthenticated` | 见 §3 归一器增补 |
| toolHub 面错误且归一器携带结构化 403/forbidden 原因 | 合并码 | 同上 |
| 其余一切（无 error 字段、未知形状、超界被安全门丢弃、`accessDenied` 但归一器已丢失 401/403 区分、`endpoint_not_found`/`contract_mismatch`/`storage_unavailable`/`catalog_unavailable`/`host_unavailable` 等 DSH 宿主自身状态） | `undecoded`（显式态） | 不猜 |

### 2.1 合并码单一状态（不可拆分）

`permission_denied_or_unknown_action` 渲染**一个共享常量状态对象**：403 信号、空工具
信号与 unknown-action 信号命中同一对象——同 taxonomy code、同 title、同 likely
causes、同 next actions 集合（capability 搜索拼写核对、申请授权、预算内重试——在
"策略拒绝 / 错名 / 空暴露"三种解释下都成立）。解码结果 MUST NOT 携带任何可反推触发
条件的字段（无 cause/detail/hit-reason）。存在性预言机是根仓冻结治理决策；合同测试
（tasks §3）钉死合并态不可拆分：三类输入的呈现输出 deep-equal。

### 2.2 undecoded 显式态

无法安全归类的信号呈显式 `undecoded` 态：显示有界原始信号（沿用 `errorCode`
安全门格式），文案明确"未归类，不猜测"，不出现任何分类法码字样。fail-closed：
映射函数对未知输入永不 fallback 到猜测码。

### 2.3 bounded `retry_after_seconds`

仅 `rate_limited`/`budget_exceeded` 可携带。渲染规则：值为有限数且
`0 <= n <= 3600` 时显示精确秒数；`n > 3600` 时只显示定性提示（"1 小时后再试"），
不外推精确数值；字段缺失时 MUST NOT 造数、不显示任何时间承诺。MUST NOT 倒计时、
MUST NOT 据此自动重试或调度任何调用（无 timer、无 mount 触发）。

## 3. 归一器 additive 增补（保区分度）

现状 `normalizeToolHubClientError` 把 401/403/forbidden/unauthorized 归一成
`accessDenied=true` + `code='unknown'`——区分度已丢。本 change additive 携带结构化
原因：`ToolHubClientError` 增加可选 `authCause?: 'unauthenticated' | 'permission_denied'`
（由命中的正则分支决定），transport text 含结构化 `status` 时同样保留。有
`authCause` 才按 §2 表映射；`accessDenied` 但无 `authCause` → `undecoded`。既有
`code` 字段与所有现有消费者语义不变。

## 4. 能力地图卡：connect doc 消费

### 4.1 Host 只读投影（`packages/host/dsh-tool-hub`，additive）

`toolHub` Remote 面新增两个 additive 方法（既有 `list`/`setEnabled` wire 合同与
`specVersion` 不变；旧宿主无此方法 = probe miss）：

```ts
connectDoc(): Promise<ToolHubConnectDocAnswerV1>   // 只读投影
rediscover(): Promise<ToolHubRediscoverAnswerV1>   // server-authored 动作

interface ToolHubConnectDocV1 {
  ok: true
  docDigest: string            // gateway_connect_doc.v1 的 doc_digest（digest_sha256_16）
  observedAt: number
  faces: readonly { id: string; publicName: string; kind: string; toolCount?: number }[]
}                                              // compact faces，仅展示词表字段
type ToolHubConnectDocAnswerV1 =
  | ToolHubConnectDocV1
  | { ok: false; code: 'connect-doc-unavailable'; message: string }

type ToolHubRediscoverAnswerV1 =
  | { ok: true; generation: number; docDigest: string }
  | { ok: false; code: 'rediscover-in-progress' | 'rediscover-unavailable'; message: string }
```

- host 从已批准绑定与当前暴露派生/读取 `gateway_connect_doc.v1`（Gateway 侧只读
  投影，根 tasks 6.4/G4；DSH 不加审批权、不复制凭据）。Gateway change 落地前 host
  回 `connect-doc-unavailable`（带原因），卡片据此诚实降级。
- wire 只传 safe projection 字段（face id/公开名/kind/toolCount、digest、时间戳）；
  不传 token/cookie/raw URL/任意 fetch 能力。
- `rediscover()`：server-authored、恰好一次 `tools/list`（走 DSH host 既有 MCP
  client 同步路径），in-flight 期间拒绝并发（`rediscover-in-progress`），完成后
  catalog generation 递增、connect doc 重取 digest。永不自动：无 timer、无 mount
  触发、无 digest 漂移自动调用、无目录刷新连带调用。

### 4.2 Client 消费（`packages/client/ui-mcp-inspector`，additive）

- wire mirror（同 `wire.ts` 镜像惯例）+ 轻量 controller（同 `ToolsHubController`
  的 generation/stale 形态）：记录"当前渲染的 faces 所背书的 digest"，读取得到
  不同 digest 时置 `stale` 并渲染 mismatch 横幅。
- **digest 新鲜度**：卡片常显 `doc_digest`（16 hex）+ observedAt；stale 时横幅明示
  "已渲染 D1，当前 D2"，数据保留但标注 stale，不冒充新鲜。
- **恰好一次 re-discovery**：横幅内单一动作按钮，仅用户显式点击触发一次
  `rediscover()`；in-flight 禁用；完成后重读 connect doc，digest 一致才撤横幅。
  无任何自动触发路径。
- **浏览器 MUST NOT 直连 Gateway**：卡片数据唯一来源是 `toolHub` remote 投影；
  client 源不出现 gateway base URL/token/cookie，不新增 fetch 面（静态守卫测试钉住）。
- **诚实降级，无静默陈旧回退**：投影不可用（方法缺失=旧宿主、
  `connect-doc-unavailable`=G4 未落地、transport error）→ 卡片禁用态+可读原因
  （禁死按钮原则，入口不隐藏）；MUST NOT 回退手写快速卡内容或把内存中旧 doc
  当新鲜数据渲染（旧 doc 只能以显式 stale 标注存在）。

## 5. 边界与兼容

- **additive-only**：两张卡渲染进既有 pane（pane kind `mcp-inspector`/`tools-manager`
  + `conversation.view` tab），不加新 tab、不加新 bundle、不加 pane kind；经既有
  `@yeisme/dsh-mcp-inspector` bundle 交付，仅在需要时 additive 导出（cordis.patch.yml
  insert 行不变）。交付形态遵守 `docs/plugin-tab-development.md` 形态 B（host/client/
  bundle 三包）。
- **零阻塞 `dsh-mcp-inspector-v1` 归档**：不触碰该 change 任何文件与其 L2 seam 任务；
  本卡失败不得使其门禁失效。视觉基线走新增 spec 用例，不改其既有 snapshot。
- **split-owner**：失败分类法与 connect doc 语义真源在根仓冻结合同与 Gateway
  owner；DSH 侧零写入、零审批、零第二真源（手写快速卡内容不入代码）。
- **失败解码卡无外部依赖**，可先行交付；能力地图卡依赖 Gateway G4 投影，落地前按
  §4.2 降级。

## UI Contract

- Surface classification: adopted（`ui-mcp-inspector` 已在视觉系统 §14 采纳）
- Surface kind: inspector（既有 pane chrome，复用 `Surface` + `--vk-*` token）
- First / second / third visual priority: ①失败解码卡的当前失败码与下一步动作；
  ②能力地图卡的 digest/新鲜度与漂移横幅；③次要 likely-causes 与技术详情折叠。
- Existing components reused: `Surface`、`vk-alert`（tone 词表）、`vk-btn`、
  `details` 折叠、既有 locale translator；不新增视觉原语。
- Cards that earn existence: 失败解码卡仅当会话内存在 ≥1 条失败信号（含
  undecoded）才出现；能力地图卡仅当 connect doc 可用或有明确降级原因时出现；
  两卡空态不占位。
- Primary scroll owner: pane 既有滚动容器（卡片不内滚、不劫持滚轮）。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
| --- | --- | --- | --- | --- | --- | --- |
| 失败解码卡 | 派生同步，无 loading 态 | 会话无失败信号 → 卡不渲染 | 不适用（派生纯函数 fail-closed→undecoded） | 分类法码卡（title/causes/actions） | undecoded 显式态（原始有界信号） | 无 host 依赖，不禁用 |
| 能力地图卡 | 首读中骨架 | faces 为空如实显示计数 0 | transport error + 重探动作 | faces+digest+observedAt | digest 漂移横幅+stale 标注+re-discovery | 投影缺失（旧宿主/G4 未落地）→ 禁用+原因 |
| re-discovery 动作 | — | — | 失败回显 owner message | 恰好一次后禁用至结果 | in-flight 禁用（`rediscover-in-progress`） | 无投影时禁用 |

### Responsive

| <=420px | 421–720px | >720px |
| --- | --- | --- |
| 卡片单列；actions 列表不裁切；digest 允许换行（`break-all`） | 同左，likely-causes 两栏内折叠 | 卡片随 pane 列宽拉伸，右栏详情正常 |

### Accessibility

- Keyboard path: 卡片内 Tab 顺序=标题→详情折叠→动作按钮；re-discovery 按钮可达且
  disabled 时带 `aria-disabled` 原因文本。
- Focus owner/return: 横幅出现不抢焦点；动作完成后焦点回动作按钮。
- Visible labels and accessible names: digest/码名用 `code` 语义；横幅 `role="alert"`。
- Reduced motion and coarse pointer: 无倒计时/动画；按钮命中区 >=44px。

### Visual Exceptions

- None。

## Non-goals

- 不做存在性预言机（区分策略拒绝/错名/故障）——根仓冻结决策。
- 不做 operator-lane 可解释面（debug why、request investigation join、usage/budget
  series 属 Gateway G1–G3 与 Aigora 6.5，不进消费者卡片）。
- 不做跨 session 聚合（卡是 session/pane scope）。
- 不自动 re-discovery、不缓存陈旧 connect doc 当真源、不内嵌手写快速卡兜底。
- 不触碰 `dsh-mcp-inspector-v1` L2 seam（`upstream-prs/mcp-inventory/`）。
