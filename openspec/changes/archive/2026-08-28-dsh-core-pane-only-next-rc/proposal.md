## Why

当前官方 Web 仍可能落入独立 `details` 列或插件 overlay/footer 兼容宿主，导致同一个 Tool Details 同时存在两套几何与生命周期。上一 RC 已完成 Core Pane 主路径和兼容窗口；下一 RC 直接收口为唯一 `workspace.core-pane.v1` 路径，避免继续维护无法保证一致性的历史分支。

## What Changes

- **BREAKING**：DSH Web 删除独立 legacy Details 列、对应几何状态与无 Core host 时的回退逻辑。
- **BREAKING**：Pane Workbench 删除 `shell.overlay`、`sidebar.footer.action` official-host 兼容实现及 `ctx.layout.openDetails()` monkey patch。
- Pane Workbench 只接受 `workspace.core-pane.v1`、`shell.workspace.right`、`shell.workspace.bottom` 与 `ctx.workspaceLayout`；缺失时明确加载失败，不降级。
- Tool Details 只作为 `dsh.tool-details` Core view 由 Right/Bottom Pane 渲染、打开与关闭。
- 新版本采用整包 RC 升级；回滚只能恢复上一完整 DSH + Pane Workbench RC 组合，不提供运行时兼容开关。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `dsh-unified-core-pane`：删除一 RC legacy Details fallback，Core Pane 成为唯一 Tool Details 宿主。
- `dsh-pane-workspace-docking`：删除独立 Details 几何与兼容优先级，只保留 Right/Bottom Pane 布局。
- `dsh-pane-workbench-extension`：旧宿主不再挂载 overlay/footer，缺少 Core seam 时 fail fast。

## Impact

- DSH staging：`packages/client/ui-layout`、`packages/client/ui-conversation` 及其测试和上游 patch。
- Harness Plugins：`packages/client/ui-pane-workbench`、`packages/bundle/pane-workbench`、组合 bundle 与合同测试。
- 外部消费者必须同步升级 DSH 与 Pane Workbench；旧 DSH 不能加载新 Pane bundle。
- 合同分类：公开 TypeScript/布局服务行为与 profile peer floor 为 breaking change；用户已明确选择下一 RC 直接切换。
- 迁移：发布新 DSH RC 后再发布/安装匹配 Pane Workbench RC，所有内仓消费者同批更新。
- 弃用窗口：上一 RC 已完成完整兼容窗口；本 change 是已声明的下一 RC removal release。
- 回滚：恢复上一组 DSH + Pane Workbench RC 包与 profile lock，不混装新旧版本。
