# Spatial V3 Capability & Rollback Matrix（0.2）

四项 capability 全部 **default-off**，仅 server 进程环境变量可启用；principal、route、query、localStorage、SDK 参数均不参与启用判定。快照只读暴露于 `GET /v1/spatial/capabilities`（`workbench.spatial_capabilities.v1`）。

| Capability | 环境变量 | 控制 face | 关闭后行为 | 数据处理 |
| --- | --- | --- | --- | --- |
| `spatialCanvasShellV3` | `WORKBENCH_SPATIAL_CANVAS_SHELL_V3_ENABLED` | V3 shell/自适应 context rail/HUD 等级 | 恢复现有 mode layout 与既有 Lens 内栏 | 纯 UI face，无持久化 |
| `spatialViewportV3` | `WORKBENCH_SPATIAL_VIEWPORT_V3_ENABLED` | `QuerySpatialSurfaceV3` 等 V3 查询/布局/搜索方法 | V3 方法返回 truthful `capability_disabled`；客户端只调 V2 | 无（投影只读） |
| `spatialDraftCollaboration` | `WORKBENCH_SPATIAL_DRAFT_COLLABORATION_ENABLED` | Draft document/patch/undo/watch/promotion | Draft 面不可用；已存 Draft 表保留为只读 | 新表保留、停读，无破坏性反向迁移 |
| `spatialPresence` | `WORKBENCH_SPATIAL_PRESENCE_ENABLED` | ephemeral presence hub/watch | `presence_degraded`，Draft revision/refetch 继续可用 | presence 从不持久化，关闭即消失 |

独立性与顺序约束：

- 四个开关彼此独立；关闭 `spatialViewportV3` 不影响 `spatialDraftCollaboration` 的服务端方法可用性（但 Web 面整体 shell 由 `spatialCanvasShellV3` 控制）。
- 任一开关关闭都不影响 V2 读路径与既有 ProposalAuthority/TaskService 变更链。
- 非法取值（非 `true|false|空`）在启动期 fail-closed。
- reason code：未配置 → `not_enabled_by_default`；显式 false → `server_config_disabled`；启用 → `ready`。快照每项携带 `source=server_config`，本身即「非浏览器可启用」的证据。

回滚矩阵（roll forward 关闭即回滚）：

1. 关 `spatialCanvasShellV3` → 现有 2.x mode layout 原样保留（本 change 不删除它们）。
2. 关 `spatialViewportV3` → SDK/浏览器回退只调 V2；V2 method identity 不变。
3. 关 `spatialDraftCollaboration` → Draft 表/记录保留只读；已创建 proposal/Task/receipt 继续由既有 authority 完成或 reconcile。
4. 关 `spatialPresence` → 无数据善后（从未持久化、不入 audit/backup/lifecycle export）。

验证：`service/internal/spatial/capability_test.go`（default-off、独立启停、非法 fail-closed、truthful reason）+ `service/internal/runtime/spatial_capabilities_test.go`（env 解析、状态 handler 只读）+ `apps/web/test/spatial-v3-capability.test.ts`（浏览器侧输入永不启用）。
