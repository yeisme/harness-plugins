## Why

当前 Tools tab 已能列目录、启停条目和派生 MCP 调用，但截图暴露出首屏大面积空白、目录与活动层级混乱、筛选控件失真、raw transport error 直接占据主视觉、全部正文硬编码英文等问题。用户无法在 5 秒内判断“什么可用、哪里异常、刚用了什么、能做什么”，且自动测试尚不能形成最终人工视觉验收门。

## What Changes

- 将现有 Tools tab 重构为紧凑状态条 + 目录/活动双栏工作台；中窄容器降级为内部页签，不新增并列主壳。
- 把目录条目从卡片堆叠改为高密度列表，增加覆盖度、状态筛选、条目详情、本会话最近使用与安全启停反馈。
- 新增原生工具 + MCP 的统一安全活动派生、列表/瀑布时间线、运行中/成功/失败/耗时可视化；不读取 private tool arguments 推断 Skill 身份。
- 将 transport/404/contract/storage failure 归一为稳定安全 reason code；主界面不得展示 raw JSON、堆栈或请求 payload。
- 对 `toolHub.list@1` 做纯 additive 扩展：保留 `specVersion: 1.0`，增加 optional observed/health/reason projection；旧客户端继续工作。
- 支持可选 `ctx.mcpServers.list()` provider 的安全 MCP health 投影；provider 缺失时显示“未提供连接健康”，不得猜测 connected/offline。
- 所有可见文案进入现有 `mcpInspector` locale namespace，补齐键盘、ARIA、reduced-motion 与 container-query 响应式行为。
- 新增窄范围浏览器截图证据与 `pnpm run ui:acceptance` 人工验收 CLI；没有绑定当前 commit、受影响源码 digest 和截图 digest 的 `accept` 回执时不得归档 change。

### Required Capability Ledger

| Capability | Admission | Canonical owner | Visible host | Delivery | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| Tools 目录与启停 UI | `fit` | `dsh-tool-hub` prefs/CAS；UI 只组合 | DSH Web Tools tab | committed | component/contract tests + screenshots |
| 会话工具活动 | `split-owner` | DSH ConversationSnapshot | DSH Web Tools tab | committed | pure derivation tests + activity screenshots |
| MCP 连接健康 | `split-owner` | optional `ctx.mcpServers` provider | DSH Web Tools tab | committed consumer/degraded path；provider 可后接 | provider-present/absent fixtures |
| Workbench 复用 | `split-owner` | DSH/Tool Hub typed projection | future Workbench consumer | retain-next | 不在本 change 声称 |
| 最终人工视觉验收 | `fit` | harness-plugins closeout workflow | local acceptance board | committed hard gate | generated `human-acceptance.json` |

## Capabilities

### New Capabilities

- `dsh-tools-center-observability`: Tools 工作台的信息架构、安全目录/健康投影、会话活动可视化、响应式与人工验收合同。

### Modified Capabilities

无。现有 `dsh-mcp-inspector-v1`、包名、slot id、公开导出和 `toolHub.*@1` 语义保持；本 change 以 additive capability 承接扩展。

## Impact

- 主要代码：`packages/client/ui-mcp-inspector/`、`packages/host/dsh-tool-hub/`。
- 组合面：`packages/bundle/dsh-mcp-inspector/` 只保持现有 host/client 安装关系，不更名。
- 公共 TypeScript/wire：只增加 optional 字段与新增导出；不删除、重命名、收窄或改变 required-ness。
- 测试/证据：新增一个最小浏览器截图路径与 repository-level acceptance script；证据写入 `temp/integration-test-runs/<run-id>/`，不提交。
- 依赖：优先复用现有 React/Vitest/visual-kit；仅浏览器截图缺口允许增加一个 Playwright dev dependency，并在 design 记录理由与回滚。
