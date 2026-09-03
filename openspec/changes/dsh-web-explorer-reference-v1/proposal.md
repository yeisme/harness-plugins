## Why

DSH Web 当前同时暴露 `file.tree`、`workspace.explorer`、`desktop.files` 与一个未接真实数据的 `dsh.explorer`，导致目录树为空、隐藏条目被过滤、文件类型被误投影为目录且打开链路分叉。用户还无法把已检视文件与精确选区作为同一类结构化引用稳定交给 Composer。

## What Changes

- 将 `dsh.explorer` 建为唯一 canonical 文件导航视图，并让旧 view kind 在两个 release 的兼容窗口内以隐藏 shim / request alias 迁移。
- 新增分页、全量可见、opaque-ref 的 `FileTreeProjectionCapabilityV2`，表达 hidden、ignored、sensitive、symlink、freshness 与 typed availability。
- 复用 `PreviewResourceV1` 的 owner inspect/rendition 作为唯一打开与引用门；目录展开独立，未获真实预览证明的文件保持可见但不可打开或引用。
- 新增 `ComposerReferenceCapabilityV1`，统一文件预览窗口和 selection anchor，管理一个活动引用与最多八个固定引用，并把结构化引用投影到公开 `conversation.input.dock`。
- 增加 350ms hover/focus metadata affordance、行内 pending、键盘/触控等价路径和敏感资源的 session+version reveal gate。
- 修复 opaque 文件 API 在 session 无法解析时回退 `process.cwd()` 的实现偏差；V2 请求必须精确绑定 session/workspace owner。
- **BREAKING（延后移除）**：旧 view kind 最终退役；本 change 只增加兼容 shim、弃用诊断与回滚策略，不在当前 release 删除任何公开 kind。

## Capabilities

### New Capabilities

- `dsh-web-canonical-explorer-v2`: canonical Explorer、分页目录投影、全量条目、预览门、响应式和兼容迁移。
- `dsh-composer-reference`: 结构化文件/选区引用、活动/固定引用、发送门、stale 历史与 Composer dock。

### Modified Capabilities

无。旧 FileHost/FileEntry、selection 事件和 Pane view kind 在兼容窗口内保持可用；新行为通过新增 capability 与 alias adapter 进入。

## Impact

- Pane Workbench Explorer/provider、Desktop Workbench 文件打开组合与旧 File Tree 入口。
- File Host 的 V2 tree/session owner 投影和 PreviewResource adapter。
- Selection Interaction V2、Composer dock 和 DSH Conversation owner 的上游结构化引用 seam。
- Public TypeScript API 新增 V2/V1 capability；现有导出不删除、不重命名。
- Compatibility：Release 1 隐藏旧 provider 并记录 deprecated；Release 2 只保留请求/持久化 alias；之后才允许另行移除。Rollback 切回 legacy Explorer policy 并禁用引用发送，不删除布局或引用快照。
