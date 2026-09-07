# C3-A2 Managed Session Event Stream 实现记录

## 状态

managed browser session SSE 的单实例生产基线已实现：服务端基于共享 Session Store 轮询权威状态，支持 `Last-Event-ID` 十进制游标续接、首帧 `session_refreshed`、heartbeat、per-session/global connection limit、终止事件和连接租约释放。该基线解决浏览器重连、僵尸连接和单会话连接风暴，但尚不等于完整 revocation subsystem。

R1 仍为 partial：durable inbox/consumer core 与 cursor persistence 已实现，但 Provider event source/lease/gap recovery、跨实例全局限流、revoke lag metric/SLO、live Provider/PostgreSQL integration 与 staging soak 尚未完成。

## 合同与不变量

- `GET /auth/session/events` 必须先验证 exact Host、opaque cookie、派生 CSRF proof 与 Session Store 记录；未认证返回 `401 authentication_required`。
- `Last-Event-ID` 只接受不带空白和符号的无符号十进制，超出 64-bit cursor 空间或无法继续递增时返回 `400 invalid_argument`；cursor 不写日志、诊断或 evidence。
- 每个连接取得一次 `SessionEventLease`；browser cancel、request abort、terminal event、stream exception 都必须幂等释放。
- 默认限制为每 session 4 条、单实例 1000 条；超限返回 `429 rate_limited`，不暴露 session digest 或当前连接明细。
- 首帧发送 versioned `session_refreshed`，其 `id` 从 `Last-Event-ID + 1` 开始；后续只发送 safe revision、authority generation 与 diagnostic code。
- heartbeat 默认 15 秒，Session Store poll 默认 2 秒；两者均由有界 managed config 控制。
- session 删除、expired、revoked/signed-out/revoking 产生 terminal event；stale 与 authority/revision 改变产生非终止失效事件。

## Managed 配置

| Variable | Default | Approved range | Purpose |
| --- | --- | --- | --- |
| `WORKBENCH_SESSION_EVENT_POLL` | `2s` | `250ms..30s` | Session Store freshness poll |
| `WORKBENCH_SESSION_EVENT_HEARTBEAT` | `15s` | `5s..60s` | Proxy/load balancer keepalive |
| `WORKBENCH_SESSION_EVENT_PER_SESSION_LIMIT` | `4` | `1..16` | Browser/tab connection containment |
| `WORKBENCH_SESSION_EVENT_GLOBAL_LIMIT` | `1000` | `16..10000` | Single-instance capacity guard |

local mode 禁止接受这些 managed variables；managed startup 对格式、范围和 global/per-session 关系 fail-fast。

## 验证

```bash
task identity:tenant-authority:test
task test:identity-tenant-authority:component
bun run typecheck
```

覆盖 decimal cursor resume、malformed/overflow cursor、per-session/global limit、lease release/reacquire、safe aggregate diagnostic、handler `400/401/429` 映射、heartbeat、tenant change、session stale/revoke terminal close 与类型接线。

最新 component evidence：`temp/integration-test-runs/20260720122820-45bd2065-0f26-4525-8a1e-b2991d6a9dd6`，`status=passed`、`exit_code=0`、redaction enabled。

## 未完成门

1. 在已完成 durable inbox/consumer core 上接入真实 Identity watch source、consumer lease、cursor expired/gap recovery 与 contract/JWKS event adapter；详情见 `details/c3-a1-durable-revocation-consumer.md`。
2. 将 provider cursor、consumer lag、active stream、reject count、terminal reason 与 revoke latency 接入脱敏 telemetry 和 alert/runbook。
3. 多实例部署前引入 provider-neutral distributed admission 或明确按实例容量预算；当前 global limit 仅是单实例上限。
4. 使用真实 Identity、PostgreSQL、两标签页浏览器执行 reconnect/revoke/switch race，并完成 24h staging soak 与 revoke drill。
