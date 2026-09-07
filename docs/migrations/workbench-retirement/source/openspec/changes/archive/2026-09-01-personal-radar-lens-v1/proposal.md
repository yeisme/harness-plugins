## Why

`short-drama-radar` 已冻结 Profile/Feedback/Opportunity/Edition 与三 lane MCP 合同（子项目 change `personalized-radar-agent-experience-v1` M1–M3 全绿，handoff fixtures `radar.mcp.handoff.v1` 已发布）。根 change `personalized-short-drama-radar-experience-v1` 指定 Workbench 作为可选深 Lens consumer：需要把 TaskService server-side Radar adapter、typed SDK operations 与四视图 Lens 落成 Workbench 本地实现，浏览器不直连 Radar。

## What Changes

- 新增 server-side Radar adapter：固定启动 `radar mcp --transport stdio --lane <reader|curator|operator>`，binary/argv/lane 来自服务端配置，浏览器不得传 binary、argv、cwd、env 或任意 MCP method。
- 新增 Workbench Personal Radar typed operations（reader 投影、curator 反馈、operator 仅 `edition_build`），经 `service/internal/registry` 投影到 SDK/HTTP/gRPC/JSON-RPC，有效动作 = Radar lane ∩ Workbench operation allowlist ∩ capability ∩ scope。
- 新增 `WorkbenchClient` Personal Radar typed client 与 `apps/web` 四视图 Lens（For You、Opportunity Detail、My Projects、Taste & Feedback），接入既有 `/agent` workspace，不新增应用主壳。
- 反馈动作携带 idempotency key，成功状态只来自 Radar receipt；timeout/断线进入 `action_pending|reconcile_required`，按 idempotency key / run ref / edition ref 对账，不自动重放。
- 新增 browser evidence（Vitest + Playwright 关键路径），集成证据写入 `temp/integration-test-runs/<run-id>/`。

## Capabilities

### New Capabilities

- `personal-radar-lens`: Workbench Personal Radar Lens 的 server-side adapter、typed operations、四视图交互、状态模型、响应式与可访问性要求。

### Modified Capabilities

无。本变更以 additive 方式扩展 `/agent` workspace 与 operation registry，不改变现有 Task/Proposal/Design 合同语义。

## Impact

- `service/internal/adapters/`：新增 Radar MCP stdio adapter（固定命令、lane、action allowlist、receipt reconcile）。
- `service/internal/registry` + `packages/task-sdk`：新增 Personal Radar typed operations 与 client facade。
- `apps/web`：新增 Personal Radar Lens 四视图与 `/agent` 入口接线。
- 上游合同：`cli/short-drama-radar` `radar.mcp.handoff.v1` fixtures；Workbench 不读取 Radar SQLite、用户配置、audit 或 raw payload。
- 不包含 Profile 编辑 UI（V1 只读 + CLI suggestion）、collect/daily_run 触发、远程 Radar、多用户或实时推送。
