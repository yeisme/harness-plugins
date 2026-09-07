# Command & Journey Discovery（能力与旅程发现面）

状态：`workbench-command-journey-discovery-v1` 交付。根合同 change：`cross-project-command-discovery-and-journeys-v1`（Wave 5 consumer）。

## 是什么

`/command-discovery` 路由提供一个只读跨项目发现面：

- **能力搜索**：owner、capability ref、effect class、approval requirement、availability 徽标。
- **旅程建议**：journey 步骤（owner/prerequisite/gate/effect/approval/availability）、受阻与恢复提示。
- **精确命令复制**：copy-to-clipboard 是唯一交互；effect/approval/gate 徽标紧邻每个命令渲染。

数据源是 Gateway discovery 只读 REST 投影（`POST /v1/capability-searches`、`POST /v1/journey-suggestions`，envelope `gateway_capability_search_result.v1` / `gateway_journey_suggestion_result.v1`），经 BFF `workbench.discovery.reader.*` 两个 Task operation（`service/internal/adapters/discovery_gateway.go`，loopback-only、服务端配置 `WORKBENCH_DISCOVERY_GATEWAY_URL`/`WORKBENCH_DISCOVERY_GATEWAY_TOKEN`）。SDK 侧 `WorkbenchDiscoveryClient`（`packages/task-sdk/src/discovery-client.ts`）同时支持 owner-direct 投影（根 `docs/contracts/discovery/` 三 schema），渲染共享同一 typed 形状并标注数据源（`gateway` / `owner:<name>`）。

## 边界

- 不解析 `--help`、不启动本地 CLI 进程、不执行建议或命令、不绕过 Gateway policy。
- 不持久化投影：session-scoped memoization + 显式 refetch；无第二 registry。
- 投影不携带 prompt body/provider payload/credential/raw tool argument；schema 校验失败 fail closed 为 typed error state，绝不 partial render。
- `stale` / `degraded` / `policy-hidden` / `unavailable` 为一等状态徽标（文本+图标双表达）；已知 owner 无投影渲染 `unavailable`，不渲染空成功。

## 回滚

Feature flag（`apps/web/src/workbench/command-discovery/flag.ts`）置 false 即入口消失；服务端不配置 Gateway discovery 源时 operation 保持 fail-closed unavailable。无数据迁移。

## 验证

- Go：`service/internal/adapters/discovery_gateway_test.go`（loopback fail-closed、schema/词表/未知字段 fail closed、honest unavailable、双 operation dispatch）。
- SDK：`packages/task-sdk/test/discovery-client.test.ts`（envelope 归一化、outcome 解析、memoization/refetch、unavailable 不升级）。
- 跨仓 conformance：`tests/conformance/discovery-fixtures.test.ts`（`WORKBENCH_DISCOVERY_FIXTURES_DIR=<root>/docs/contracts/discovery/fixtures`，valid 全过/invalid 全拒）。
- 组件：`apps/web/test/command-discovery.test.tsx`（双数据路径、全部 availability 状态、copy-only、redaction）。
