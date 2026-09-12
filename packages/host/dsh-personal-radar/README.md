# @yeisme/dsh-personal-radar

DSH Personal Drama Radar host 合同包：typed `/drama radar` intent、capability probe、lane 交集校验、receipt reconcile、badge/Pane reducer、Workbench handoff 与诚实降级。

本包只做 DSH 侧的安全投影与 typed intent；Radar Profile、反馈 ledger、机会簇、Edition 与运行状态归 `cli/short-drama-radar` owner 独有。意图经固定 argv `mcp --transport stdio --lane <reader|curator|operator>` 收敛；operator 交集只剩 `edition_build`，`collect`/`daily_run` 永不从插件发出。

## 验证

```bash
pnpm --dir packages/host/dsh-personal-radar run typecheck
pnpm --dir packages/host/dsh-personal-radar run test
pnpm --dir packages/host/dsh-personal-radar run integration:evidence
```
# 市场投影实施状态

对于只公开工具的宿主，使用 `createScopedMarketToolConnection(runtime, agent, searchToolName)`，传入当前真实agent和discovery得到的精确工具名。适配器逐次调用schemas(agent)确认可见性，并通过runtime.execute执行三个固定读取view；执行拒绝不解析为成功正文，取消向下传递。不能省略agent以退回全局范围，也不从server名拼猜公开工具名。适配已通过合同测试，实际host注册与remote装配仍待完成。

`createConnectedRadarMarketHost` 将现有 `MarketContextSource` 组合成 client 所需的 `RadarMarketHostFace`。source 提供当前连接、opaque context ref 和上下文/策略通知，factory 不创建连接、不启动CLI。context ref 应随连接或会话改变；即使误复用ref，连接对象变化也会拒绝旧结果。宿主需将该face注册为 `radarMarketHost`；当前工厂合同已验证，实际DSH连接服务注册仍待完成。

`createMarketReadingController` 管理临时读取状态：刷新只作用于当前 context，切换上下文或 policy 失效时清空正文，晚到响应以 generation 丢弃，dispose取消读取并移除订阅。外部会话/连接管理层应调用 setContext/invalidatePolicy，真实seam装配仍待完成。该controller不持有领域真源，不标已读、不存草稿、不自动重试。

`readConnectedMarketBrief` 接受 host 已持有的 MCP `readResource` transport，可用于没有本机 Radar CLI 的连接。读取前后验证 policy，一旦变化不返回正文；资源超时最多等待配置的1–30000ms并取消，不自动重试或触发采集。结果区分缺能力、合同不匹配、缺简报、禁区与离线。当前完成模拟transport验证，实际DSH连接装配与Web消费仍待完成。

新增 `projectMarketSignal`、`projectMarketReader`、`projectMarketEvidence` 与 `projectMarketBrief`，将 Radar 明确版本的字段转换为浏览器可读白名单。简报保留 owner 排序、时区、5＋2条限制及来源缺口；指标保留原比较值，不合成跨市场分数。未知字段不下发，不安全文本脱敏，未知协议和越界数据拒绝。当前仅完成投影函数与合同单元测试，已连接 MCP adapter、正式 Web 阅读界面和实际宿主验证仍在实施中。
