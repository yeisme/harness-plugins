## Why

DSH Web 会话一多就难以管理，社区插件分散且维护风险高。用户需要一套自研、自维护的桌面级多 Pane 工作台，把会话管理、文件树/预览、终端、事件通知与全局搜索整合到同一个可安装 bundle 中，并形成类 Claude Desktop / Codex 的体验。

本 change 在 `@yeisme/harness-plugins` 内新建 `@yeisme/dsh-desktop-workbench` 及其 host/client 支持包。代码以 MIT/Apache-2.0 社区项目为参考/复制来源，但不 fork、不 submodule、不形成运行时依赖；所有代码进入 `@yeisme/*` 命名空间并由本仓库维护。

准入结论为 `fit + split-owner`：Harness Plugins 拥有工作台 shell、会话管理 UI、文件/终端视图与事件通知组合；DSH 继续拥有 session、fs、terminal、approval、subagent 等 canonical state。

## What Changes

- 新增 `@yeisme/dsh-desktop-workbench` 可安装 bundle，组合会话管理、文件树/预览、终端、事件通知与多 Pane shell。
- 新增 `@yeisme/dsh-session-manager` host 包：会话列表、搜索、标签、归档/回收站、未读、继续/暂停/fork、工作区分组。
- 新增 `@yeisme/dsh-client-ui-desktop-workbench` client 包：桌面级工作台 UI、会话侧栏、Pane shell 集成。
- 新增 `@yeisme/dsh-file-host` 与 `@yeisme/dsh-terminal-host` 最小 host 骨架，为真实 DSH fs/terminal seam 预留适配边界。
- 复用现有 `@yeisme/dsh-workbench-core`、`@yeisme/dsh-client-ui-pane-workbench`、`@yeisme/dsh-file-document`、`@yeisme/dsh-terminal`、`@yeisme/dsh-rich-media`、`@yeisme/dsh-pane-protocol`。
- 复制并改造社区 `dsh-session-manager`、`dsh-notify-center`、`dsh-task-notify`、`dsh-codex-ui`/`dsh-archive-manager` 的可复用逻辑，保留 LICENSE 并在 `THIRD_PARTY_NOTICES.md` 记录。
- 建立 source-independence scan，确保运行时依赖不含原社区包或私有 API。
- 若 DSH 官方 seam 不足，只做最小 additive upstream patch，不 DOM patch、不改 DSH core 行为。

## Capabilities

### New Capabilities

- `desktop-workbench-session-manager`: 会话管理 host/client 合同，覆盖列表、标签、归档/回收站、未读、继续/暂停/fork、工作区分组。
- `desktop-workbench-file-preview`: 文件树与文件预览合同，基于 `FileEntryV1`/`MediaRefV1` 安全投影。
- `desktop-workbench-terminal`: 终端视图合同，基于 DSH terminal seam 与 xterm.js。
- `desktop-workbench-event-notify`: 事件监听与通知合同，覆盖 turn/end、approval、subagent/end、workflow/end、后台任务。
- `desktop-workbench-multipane`: 类 Claude Desktop 多 Pane shell 合同，复用 Pane Workbench reducer 与 Workbench Core registry。
- `desktop-workbench-global-history`: 全局历史/标签/搜索合同，对齐根级 `dsh-long-term-history-global-search-v1`。

### Modified Capabilities

无。本 change 全部 additive；不修改既有 Workbench Core、Pane Workbench、Rich Media、File Document、Terminal 或 Ordo package 合同。

## Impact

- 新 owner package：`packages/host/dsh-session-manager/`、`packages/host/dsh-file-host/`、`packages/host/dsh-terminal-host/`、`packages/client/ui-desktop-workbench/`、`packages/bundle/dsh-desktop-workbench/`。
- 依赖关系：复用现有 `@yeisme/dsh-*` workspace 包；运行时只依赖 DSH 官方发布 surface 与 React；不依赖社区包。
- 根级 handoff：`/workspaces/yeisme-agent/openspec/changes/dsh-pane-plugin-ecosystem-v1/` 与 `dsh-long-term-history-global-search-v1/`。
- 合同兼容分类：全新、additive、experimental；rollback 为移除 bundle，不涉及数据迁移。
