## Why

Pane Workbench 已具备 pinned/preview/overflow、原子 bulk close、拖拽和键盘导航，但大量 Tab 时仍依赖长条滚动与逐项关闭，现有 Quick Pick 也只能打开视图，不能统一搜索、管理、恢复和保护不可恢复工作。当前 Overlay/Core Chrome 正在收敛到同一组件，适合在不破坏既有 reducer 与持久化合同的前提下补齐一个共享 Pane 管理中心。

## What Changes

- 将普通停靠态收敛为单行、连接式圆角 Tab Chrome；活动 Tab 承担标题，右侧提供“打开 Pane”和“管理 Tab”两个明确入口。
- 新增居中 Pane 管理中心：按任务领域和用户分组展示可用 Pane，支持当前工作区内的 Pane、Tab、标题、状态和关闭历史搜索、筛选、排序与多选管理。
- 新增可选 conversation search Host capability；只有用户显式启用“包含对话内容”或输入 `@conversation` 才发起可取消、分页的 owner 搜索。
- 新增安全优先批量关闭意图：保留既有原子 `bulk_close`，新流程先关闭可恢复目标，再把 dirty、运行中、终端、confirm/deny 目标交给保护确认。
- 新增关闭历史、10 秒撤销、工作区固定和 provider-approved 恢复状态；资源或插件失效时显示安全缓存/说明 Pane，不伪装恢复成功。
- 新增独立 `pane.management.v1` 与 `pane.closed-history.v1` 本地 envelope；不修改 `pane.workspace.persisted.v2`，旧 Host 无 workspaceRef 时诚实降级为会话范围。

## Capabilities

### New Capabilities

- `dsh-pane-management-center`: 单行 Tab Chrome、分组 Pane 选择、Tab 管理模式、快捷键、筛选与可访问交互。
- `dsh-pane-history-recovery`: 安全优先批量关闭、关闭历史、撤销、固定范围和 provider-approved 恢复/失效降级。
- `dsh-pane-search-sources`: 本地 Pane/Tab/历史索引与显式、可取消的可选对话搜索 Host 合同。

### Modified Capabilities

无。既有 `bulk_close` 保持全有或全无语义，`pane.workspace.persisted.v2` 与现有 provider 注册继续兼容；本 change 只增加新意图、可选字段、独立 envelope 和新 UI 入口。

## Impact

- 主要实现：`packages/client/ui-pane-workbench` 的 controller、tabs、region chrome、view registry、persistence 与新管理中心组件。
- 可选 Host 合同：新增安全 workspace context 与 conversation search 的本地 TypeScript capability；缺失时功能降级并显示原因。
- 依赖关系：在 `dsh-web-pane-experience-completion-v1` 的共享 Overlay/Core Chrome 稳定后接入，同一 worktree 中保留其现有未提交改动。
- 测试：复用现有 Vitest 与 `test:integration` runner，证据写入本项目 `temp/integration-test-runs/<run-id>/`。
- 兼容与回滚：所有公开变化 additive，无弃用窗口；回滚旧包后新 envelope 被忽略，既有布局和原子 bulk close 保持可用。
