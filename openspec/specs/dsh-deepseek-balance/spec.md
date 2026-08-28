# dsh-deepseek-balance Specification

## Purpose
TBD - created by archiving change dsh-token-usage-panel-v1. Update Purpose after archive.
## Requirements
### Requirement: DeepSeek 余额查询只发生在 Host
系统 SHALL 仅在 Host 侧查询 DeepSeek 官方余额。Host MUST 复用既有凭据解析（`ctx.credentials` / `apiKeyEnv`，默认 `DEEPSEEK_API_KEY`）对官方路由发起 `GET {baseURL}/user/balance`。浏览器、Client 插件与 overlay/pane 渲染器 MUST NOT 持有 API key，MUST NOT 直连 DeepSeek。`baseURL` 与 Authorization MUST NOT 进入 Remote 投影、DOM、日志、fixture 或 evidence。

#### Scenario: 官方路由且凭据可解析
- **WHEN** 当前提供方为 `deepseek-official`（或等价官方 host）且 Host 解析到可用 API key
- **THEN** Host SHALL 调用 `GET /user/balance` 并把白名单字段投影为 `token.balance.snapshot.v1alpha1`

#### Scenario: 浏览器侧无密钥
- **WHEN** 安全扫描检查 Client 产物、面板 DOM 与 Remote 投影
- **THEN** 扫描结果对 `apiKey` / `bearer` / `authorization` / `sk-` 形态 MUST 为零命中或仅命中 deny 清单标识符

### Requirement: 余额投影白名单
成功投影 SHALL 只包含 `schemaVersion`、`status`、`freshness`、`generatedAt`、可选 `isAvailable`、以及 `infos[]` 的 `currency`（仅 `CNY`|`USD`）、`totalBalance`、`grantedBalance`、`toppedUpBalance`（均为官方字符串）。金额 MUST NOT 被解析为 number。未知 currency 或非字符串金额 MUST 使该 info 被丢弃；全部 info 无效时 `status` SHALL 为 `error` 且 `reasonCode` 为 `contract_mismatch`。

#### Scenario: 官方示例响应
- **WHEN** Host 收到 `is_available: true` 且一条 `CNY` info，`total_balance` 为 `"110.00"`
- **THEN** 投影 SHALL `status: ready`，`isAvailable: true`，`infos[0].currency` 为 `CNY`，`totalBalance` 为 `"110.00"`

#### Scenario: 响应合同不匹配
- **WHEN** 响应缺少 `balance_infos` 或 currency 不是 `CNY`/`USD`
- **THEN** Host SHALL 返回 `status: error`、`reasonCode: contract_mismatch`，MUST NOT 猜测金额

### Requirement: 非官方路由与失败的诚实降级
提供方不是 DeepSeek 官方路由时，系统 SHALL 返回 `status: unsupported`、`reasonCode: provider_not_deepseek`，MUST NOT 发起余额 HTTP。凭据缺失 SHALL `unavailable` + `credential_missing`。网络或非 2xx SHALL `error` + `network_failed`，若存在上一份成功投影则保留金额并标 `stale`。`refreshBalance` MUST 由 Host 限流（最短 15 秒）；限流命中 MUST 返回现有投影而非新的 HTTP。

#### Scenario: 非 DeepSeek 提供方
- **WHEN** 当前提供方不是 `deepseek-official`
- **THEN** Host MUST NOT 发出余额请求，投影 `status` SHALL 为 `unsupported`

#### Scenario: 刷新失败但有缓存
- **WHEN** 用户触发 Refresh 且 HTTP 失败，Host 仍持有先前 ready 投影
- **THEN** 返回的余额投影 SHALL 保留先前金额，`freshness` 为 `stale`，`status` 为 `error` 或带错误原因的等价失败态

#### Scenario: 15 秒内重复 Refresh
- **WHEN** 上次成功或失败请求之后不足 15 秒再次 `refreshBalance`
- **THEN** Host MUST NOT 发出新的余额 HTTP，SHALL 返回现有投影

