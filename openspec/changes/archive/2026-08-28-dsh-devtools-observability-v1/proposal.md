## Why

DSH Web 启动后主要只输出访问地址，开发者缺少安全、低开销、可复盘的运行日志与 Host/Web 性能诊断面。现有 session telemetry、Tools 活动和 token usage 各自解决单一问题，不能直接提供本地开发所需的统一日志、时间线、性能 finding 与按需 CPU profile。

## What Changes

- 新增公开 `@yeisme/dsh-devtools-host`、`@yeisme/dsh-client-ui-devtools` 与 `@yeisme/dsh-devtools` bundle。
- 安装 bundle 后，`dsh --profile web` 在 stderr 输出英文脱敏日志、慢操作与周期性能摘要；stdout 保持现有 Web URL/CLI 合同。
- Host 复用 Cordis logger、DSH session events 与 Node 原生性能 API，维护有界内存记录，不默认写盘或联网。
- Web 端复用浏览器 Performance API，提供 Overview、Timeline、Logs、Performance 诊断面；Pane Workbench 缺失时诚实降级到 overlay。
- 新增 `devtools.snapshot@1` 与本地授权的 `devtools.captureCpuProfile@1` Typert Remote，并提供版本化、脱敏的浏览器诊断导出。
- 精确 RPC trace correlation 保留为 optional future capability；V1 明确报告不可用，不依赖 DSH core 新 seam。

### Required Capability Ledger

| Capability | Admission | Canonical owner | Delivery |
| --- | --- | --- | --- |
| Host 日志与性能投影 | `fit` | Cordis/DSH/Node runtime；插件只读投影 | committed |
| Web 性能投影 | `fit` | Browser Performance API；插件本地投影 | committed |
| 终端诊断摘要 | `fit` | DevTools renderer，stderr only | committed |
| Web DevTools 面板 | `fit` | DevTools client；Pane/overlay 只组合 | committed |
| CPU Profile | `fit` | Node inspector；Host 本地授权 | committed |
| 精确跨端 RPC trace | `split-owner` | future DSH core seam | retained-next |

## Capabilities

### New Capabilities

- `dsh-devtools-observability`: 公开 DevTools bundle 的安全日志、Host/Web 性能采集、时间线、finding、按需 CPU profile、Web 展示与导出合同。

### Modified Capabilities

无。

## Impact

- 新增三个 package owner 路径：`packages/host/dsh-devtools/`、`packages/client/ui-devtools/`、`packages/bundle/dsh-devtools/`。
- 新增 pre-1.0 additive Typert Remote 与 TypeScript 公共类型；没有删除、重命名、收窄或迁移现有合同。
- 复用 Node `perf_hooks`、`inspector`、`crypto` 和浏览器 Performance API；不新增运行时依赖。
- 新增 package-local Vitest/component/browser fixture 与项目 integration evidence 入口；证据写入 `temp/integration-test-runs/<run-id>/` 并脱敏。
- 回滚为移除/卸载新 bundle；无持久状态或数据迁移。
