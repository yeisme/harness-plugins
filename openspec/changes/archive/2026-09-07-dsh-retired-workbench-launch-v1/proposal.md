## Why

独立 Workbench 已由用户决定退役。DSH 的旧 launch 通道不能再把用户引向即将删除的服务，缓存的 capability 也不能重新启用它。

## What Changes

- 当前 DSH 客户端 activate 和 handoff 命令返回既有 `target_unavailable`，不调用 V2 或 legacy transport。
- 保留公开合同类型、校验器和入站 owner 引用兼容面；不静默把旧 Workbench launchRef 重解释为 DSH Pane。
- 不影响 DSH 原有导演 Pane、领域动作或工作区。

## Capabilities

### New Capabilities
- `dsh-retired-workbench-target`: 已退役目标的消费侧 fail-closed 行为。

## Impact

仅 `packages/client/ui-ai-drama-director` 的活动启动接线与回归测试，未改变 wire schema。
