## Why

DSH Web 当前只能粗粒度地按 Workspace 展示会话；已有 tags 插件、`/session` 命令和历史搜索设计彼此独立，无法形成可自动整理、可批量治理、可安全撤销的对话资料库。随着单个 Workspace 的会话数量增长，用户需要稳定的功能分类、标签目录、组合筛选和回收流程，而不是继续在侧栏堆叠临时按钮。

## What Changes

- 新增 additive `sessionOrganization` Host/Remote 合同，在不改变 `sessionTags.list/set` 的前提下管理功能类型、会话 assignment、标签目录元数据、自动分类状态、规则和批次 receipt。
- 新增 `yeisme_session_organization_v1` sidecar；Workspace 和会话日志仍由 DSH canonical owner 持有，组织数据不进入模型上下文或 SessionEvent。
- DSH Web 侧栏按 `Workspace → 功能类型` 展示，并提供标签、状态和关键词快速筛选；上游两级分组 seam 缺失时诚实回退现有 Workspace 视图。
- 在 Desktop Workbench 增加独立会话管理页，支持组合筛选、多选、批量分类/标签、归档预览、回收站、管理员永久删除、批次历史和 CAS 撤销。
- 标题生成后异步执行一次结构化分类；高置信结果自动落库，低置信结果进入待确认，人工修改锁定对应字段。
- 复用 `dsh-long-term-history-global-search-v1` 的 DSH owner 搜索合同，Web 只消费安全投影，不创建第二索引。
- 不支持跨 Workspace 移动、层级标签、向量搜索、规则自动永久删除或团队 RBAC。
- 全部公开面为 additive；无 breaking change。

## Capabilities

### New Capabilities

- `dsh-session-organization`: 功能类型、标签目录、自动分类、组织规则、批次计划/执行/撤销和兼容迁移合同。
- `dsh-web-conversation-manager`: 原生侧栏快捷组织、独立管理页、批量治理、管理员门和搜索消费体验。

### Modified Capabilities

无。

## Impact

- Host：`packages/host/dsh-session-tags` 增加独立 organization domain/service/Remote，保留 tags v1 原实现。
- Client：`packages/client/ui-session-tags` 增加功能分组与组织编辑；`packages/client/ui-desktop-workbench` 增加管理页。
- Bundle：`packages/bundle/dsh-session-tags` 与 `packages/bundle/dsh-desktop-workbench` 进行 additive 装配和 capability probe。
- DSH 上游 handoff：`upstream-prs/session-grouping-provider/` 增加可选父组/颜色字段；历史全文搜索继续由既有 `dsh-long-term-history-global-search-v1` 交付。
- 新公开 TypeScript/Remote/schema surface 均为 `1.0` additive；旧客户端和旧 sidecar 可继续使用。
