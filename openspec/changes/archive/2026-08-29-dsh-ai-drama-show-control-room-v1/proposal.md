## Why

当前 Director 只围绕当前会话/项目工作，无法在 DSH 内浏览整部剧的 Episode Board、跨集 Review Inbox、Asset Wall 和 Delivery readiness。用户需要一个 owner-backed 全剧控制台，同时继续保证 Episode、Review、Run、Approval 和 Delivery facts 由领域 owner 持有。

## What Changes

- 新增 `DramaShowControlOwnerAdapterV1` 目录与 Host gateway，组合 episode、review、asset、delivery 和 owner-authored action preview。
- 新增 `DramaShowControlRemoteV1` 的 snapshot、episodes、reviews、assets、delivery、previewAction 和 dispatch additive RPC。
- 新增 Show Board、Review Inbox、Asset Wall 和 Delivery 四个 Pane，以及 `/drama show|inbox|assets|delivery` 命令。
- 新增 additive `show-control` preset；原 `director` preset 和 `/drama open` 行为保持不变。
- 批量操作只接受最多 100 个显式已加载目标，并必须经过 owner-issued descriptor、版本栅栏、confirmation 和 receipt。
- Creator Home 增加独立“全剧控制台”入口，Workbench handoff 继续作为可选高级空间分析入口。

## Capabilities

### New Capabilities

- `dsh-ai-drama-show-control-projection`: 全剧 summary、episode/review/asset pages、delivery readiness 与 owner adapter 边界。
- `dsh-ai-drama-show-control-client`: 四个全剧 Pane、筛选、分页、选择、响应式和 reconcile 状态。
- `dsh-ai-drama-show-control-actions`: preview-before-submit 的 context switch、批量 review、repair、generate 和 delivery owner actions。

### Modified Capabilities

- `creator-studio-drama-workflow`: DSH 增加 owner-backed 全剧控制台，Workbench 从唯一全剧宿主调整为可选高级宿主。
- `dsh-ai-drama-command-surface`: 新增 show/inbox/assets/delivery 导航命令，不改变旧命令语义。
- `dsh-ai-drama-pane-preset`: 新增 show-control preset，不改变 director preset。

## Impact

- 影响 AI Drama Director Host/Client/Bundle、Creator Studio Client 入口和主规格文档。
- RPC、TypeScript、profile metadata 全部 additive，使用 `v1alpha1` wire schema。
- 无数据库迁移；owner adapter 缺失时返回 needs_contract/partial，不伪造全剧数据。
