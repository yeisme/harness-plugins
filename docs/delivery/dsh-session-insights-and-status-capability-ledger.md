# dsh-session-insights-and-status 能力台账与合同确认

来源：openspec change `dsh-session-insights-and-status`（proposal.md / design.md / specs/）。本文档落实任务 1.1（能力台账）与 1.2（合同确认），只做合同与来源核实，不修改运行时代码。缺失的官方 seam 一律走 `upstream-prs/` 增量请求，不建立 core fork。

## 1. 能力台账（Task 1.1）

判定口径：fit＝本仓可独立完成；split-owner＝需 owner 提供权威来源或 seam，本仓只做安全投影与探测；reject-now＝明确禁止。split-owner 行标注 owner 合同核实状态：verified（owner seam 存在且语义已核实）/ unverified（含原因）。

| 能力 | 判定 | Canonical owner | 当前证据（file:line） | 缺口 / 阻塞原因 | Owner 核实 |
|---|---|---|---|---|---|
| /status resolver | fit | 既有命令 owner（command-experience） | `packages/client/command-experience-core/src/inspect-resolve.ts:119-158`（switch 覆盖 mcp/skills/plugins/commands/explorer/git/pane，default 落 `no inspect resolver for status`） | 缺 `status` case；需补 resolver、冻结发起 sessionRef、command lifecycle，结果不入模型历史 | — |
| /status tokens resolver | fit | 既有命令 owner（command-experience） | 同上 `inspect-resolve.ts:119-158`；详情入口 `workspace.token-usage` | 缺 tokens 子命令语法与绑定原 session 的 Pane 导航；未知子命令须返回语法说明 | — |
| session 状态及 context 投影 | split-owner | DSH session/runtime/tokenMeter | `packages/host/dsh-session-status/src/service.ts:42`（`snapshot({sessionRef})`）；`packages/host/dsh-session-status/src/index.ts:13`（`apply()` no-op stub，无 Typert Remote）；官方 seam `ctx.sessionProjections`（tokenUsage/contextPressure/contextBreakdown）、`ctx.tokenMeter` 存在（结构探测） | Host 插件尚无 Remote 暴露；context 只取官方当前上下文来源，不得用消费量推导 remaining | verified（seam 存在；缺失语单子源按 unavailable 呈现） |
| 完整 session 消费（全历史聚合） | split-owner | DSH 历史与请求用量 owner | `packages/host/dsh-token-usage/src/ledger.ts:19`（`BY_SESSION_BOUND = 20`）、`:91`/`:181`（currentSession 来自 lastActivityRef）；`packages/host/dsh-token-usage/src/remote.ts:31`/`:42`（Remote 仅 snapshot()/refreshBalance()） | 跨 retry/fork/子 Agent 的权威 request/attempt 身份与历史覆盖保证未证实；进程账本不能冒充完整会话 → `upstream-prs/session-history-usage-identity` | unverified：模块存在（token-meter 流式/最终用量测试）不等于全历史覆盖合同；等 owner 证据前一律 partial/unknown |
| 小插件展开与订阅生命周期 | fit | 插件自身；宿主负责布局/焦点 | `packages/client/ui-token-usage/src/client/index.ts`（仅 apply 时探测 paneWorkbench）；`packages/client/ui-token-usage/src/client/controller.ts`（非 ready 状态吞余额成功结果与异常） | 晚到/卸载/重连/HMR 与 session 绑定测试待补；共享订阅与 generation 语义在任务 3.3 落实 | — |
| 轨迹定位 | split-owner | 官方会话 renderer | 官方 `.d.ts` 中无任何 `trajectory` locator seam（全量 dsh-* 类型检索为空） | 缺官方定位入口；安全 opaque ref 输入、导航输出，不暴露原始路径 → `upstream-prs/session-trajectory-locator` | unverified：seam 不存在；缺失时保留统计位置并说明原因，不跳其他会话 |
| Provider 余额/配额 | split-owner | 对应 Provider 与宿主凭据 owner | `packages/host/dsh-token-usage/src/index.ts:56`（仅 env `DEEPSEEK_API_KEY`）；`packages/host/dsh-token-usage/src/balance.ts:5`（凭据端口注释）；官方 `ctx.credentials`（resolve/describe/set/unset + credentials/updated）存在 | 上游无 provider balance/quota API；不把账户余额变动解释为会话消费 | unverified：宿主凭据解析 seam verified，provider 侧余额/配额 API upstream 缺失 |
| 新建账本、抓浏览器密钥、自行估算缺失 Token | reject-now | 不属于插件 | design.md「Capability Ledger」末行；根 AGENTS.md「Prohibited Actions」 | 明确禁止：不建第二 scheduler/ledger，不读浏览器密钥，未知数字不填零、不自估 | — |

结论：/status、/status tokens、小插件生命周期为 fit，由本仓任务 2.x/3.x 完成；完整会话消费、轨迹定位、Provider 余额为 split-owner，owner 合同未核实前列为阻塞，只交付 query 合同 + typed probe + 诚实降级；禁止项不进入任何实现计划。

## 2. 合同确认（Task 1.2）

以下为即将实现的合同决定，与 design.md §2/§3 一致；属待实现合同，不是已可执行的 API。不新增 design.md 之外的字段。

### 2.1 服务扩展与兼容

- 在既有 tokenUsage Remote 上增量提供**可选** `query(input)`，结果使用独立 schema `session.insights.snapshot.v1alpha1`。
- 全部旧签名保持不变：`snapshot()`、`refreshBalance()`、`token.usage.snapshot.v1alpha1` 形状、`sessionStatus.snapshot({ sessionRef })`（状态 owner 不变，组合失败时分别呈现子状态）。
- 能力发现一律 typed capability probe：探测已声明能力，**不**通过调用不存在的方法猜版本；命名空间挂载与能力声明沿用受支持的 Typert contribution。
- 只读订阅映射与 query 探测**分开**：无流式 seam 时只支持明确标注的手动刷新，不用持续轮询伪装实时。

### 2.2 查询输入（session.insights.snapshot.v1alpha1）

| 输入 | 约束 |
|---|---|
| sessionRef | 必填 opaque ref；Host 每次校验访问权限 |
| scope | `session`（默认）/ `run` / `range`；run 要求 runRef，range 要求 from/to |
| runRef | 必须属于该 session；不靠「最近运行」补齐 |
| from/to、timeZone | ISO 时间、半开区间 `[from,to)`；时区用于日历展示及今日/本周边界 |
| includeDescendants | 默认 false；仅 owner 提供权威关联和去重身份时可启用 |
| cursor、limit | 明细默认 50、最大 200；不改变整个范围的聚合总数 |

### 2.3 查询结果字段

`schemaVersion`、`sessionRef`、`scope`、`revision`、`generatedAt`、`freshness`、`coverage`、`source`、`totals`、`context`、`byModel`、`byProvider`、`requests`、`nextCursor`、`truncated`、`reasonCode`/`safeMessage`。各子源可独立 unavailable；未知数字用 null 或明确缺席，**禁止以 0 补齐**。固定 provider/model 摘要最多 50 行并显示截断；未展示行仍计入已验证 totals。

### 2.4 coverage / freshness / revision 规则

- coverage 至少区分 `complete` / `partial` / `unknown`，附已知请求数、缺用量请求数（可确定时）、可用时间区间、缺失原因；只有 owner 确认范围完整且请求已归一化时才能为 complete。
- freshness 是时间新鲜度，不代替完整性；空范围只有覆盖完整且确定无请求时才显示 0。
- 明细 cursor 绑定 session、筛选与 snapshot revision；revision 变化返回 `stale_cursor`，客户端保留当前内容并提示从第一页重读；分页读取不启动运行。
- 大范围历史异步聚合，返回进度与 partial，禁止阻塞事件循环或一次传输整个会话；验收至少覆盖 10,000 条模拟请求与 200 行 wire 上限。

### 2.5 安全边界

Wire、日志、缓存与证据排除消息正文、凭据、原始 provider payload、私有工具参数和绝对路径。费用分 provider 结算值 / 有来源价格快照估算 / 未知三档；余额用独立账户引用与宿主凭据解析，保留环境变量兼容，不自动查询、不向浏览器传凭据。
