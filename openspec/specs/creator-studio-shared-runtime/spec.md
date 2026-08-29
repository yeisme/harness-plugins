# creator-studio-shared-runtime Specification

## Purpose
Define the single shared Creator Studio client projection runtime, its compatibility fallback, context fences, and exact lifecycle.

## Requirements

### Requirement: Creator Studio SHALL publish one shared client runtime
Creator Studio Client SHALL 发布 `CreatorStudioRuntimeV1`，提供 snapshot、subscription、显式 refresh、asset paging、artifact resolve、owner action dispatch 与 approval receipt；Creator 与 Director MUST 共享同一 runtime instance。

#### Scenario: Creator and Director are both mounted
- **WHEN** 两个 client 同时消费 Creator Studio 能力
- **THEN** 它们 SHALL 观察同一 snapshot identity、pending action 和 receipt，且 MUST NOT 各自启动独立 polling controller

#### Scenario: Runtime is disposed
- **WHEN** Creator bundle unload 或 HMR 替换
- **THEN** runtime provider、subscription、pending read 和 timer SHALL 被精确撤销，迟到结果 MUST NOT 更新新 generation

### Requirement: Shared runtime SHALL preserve the legacy remote surface
新增 runtime MUST NOT 删除或改变 `remote.creatorStudio` 的 snapshot、dispatch、resolveArtifact、assets 或 decideApproval 方法。

#### Scenario: Only legacy remote is installed
- **WHEN** Director 探测到旧 remote 而未探测到 shared runtime
- **THEN** Director SHALL 提供显式只读兼容投影，mutation SHALL 禁用并说明缺少 runtime

### Requirement: Shared runtime SHALL fence context and snapshot identity
Runtime MUST 以 tenant/workspace/project/principal/revision/runtime generation 与 snapshotRef/snapshotVersion 栅栏状态。

#### Scenario: Context identity changes
- **WHEN** project、session 或 runtime generation 变化
- **THEN** asset pages、selection、pending action 和旧 receipt SHALL 清空，并从新 authoritative snapshot 重建
