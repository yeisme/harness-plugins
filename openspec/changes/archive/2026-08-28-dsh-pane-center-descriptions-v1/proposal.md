# DSH Pane Center 窗格详细描述

## Why

窗格中心（Ctrl/Cmd+P 的 Pane Management Center）是 Web 端跨窗格/标签页/关闭历史/对话内容的统一搜索页面，但每条结果只显示标题与「来源 · 分组」一行，无法回答「这个窗格是做什么的」。`PaneViewDescriptorV1.presentation.description` 与 `PaneViewRegistrationV1.i18n.descriptionKey` 的合同已在协议层存在（`dsh-pane-management-i18n`），却没有任何消费面：描述既不进入搜索条目模型，也不参与匹配，更没有展示位。用户在几十个窗格里搜索时只能靠标题猜功能。

## What Changes

- `PaneManagementEntryV1` 增加 additive `description`（与 `updatedAt`）：按「本地 i18n descriptionKey → descriptor `presentation.description`」链解析，pane/tab/history 条目共享同一注册的描述；对话结果行以命中片段作为描述。
- 描述文本进入 `filterAndRankPaneEntries` 匹配面：用户可以用功能语义词（如「源代码管理」）搜到窗格。
- 搜索结果每行渲染一行省略描述（`title` 提示全文），对话结果行显示命中片段。
- 新增行级「窗格详情条」：info 按钮（实时 `aria-expanded`）或 ArrowRight 展开，展示完整描述 + 有界元数据（提供方、类型、角色、区域、状态、关键词、工作区、关闭时间、对话片段与更新时间）；ArrowLeft 或关闭按钮收起；Escape 先收起详情条再进入既有 target/关闭链；Hide/Escape 收起后焦点回归触发行 info 按钮；详情条置于列表之外，不破坏虚拟滚动与既有键盘导航。
- 对话内容结果行以 host 命中片段作为描述行并携带更新时间；远端工作区结果行显示 host 描述，均不为描述发起额外 host 请求。
- `PaneWorkspaceSearchItemV1` 增加 optional `description`，远端工作区搜索结果可携带宿主批准的有界摘要；无描述走诚实空态。
- 为内置注册补真实描述：ui-pane-workbench 内置视图（designer/capabilities）走 `descriptionKey`，dsh-desktop-workbench 内置窗格（files/file/documents/git/terminal/media/sessions）补 `presentation.description`。

## Capabilities

### New Capabilities

- `dsh-pane-center-descriptions`: 定义窗格中心搜索条目的描述解析链、搜索匹配、行内描述展示、详情条交互与安全边界。

### Modified Capabilities

无。本 change 全部为 additive：不改 `PaneViewDescriptorV1` schema（`presentation.description` 已存在）、不改既有键盘导航与虚拟滚动合同、不改 `session.search`/`history.*`。

## Impact

- 实现 owner：`packages/client/ui-pane-workbench`（management.ts / management-center.tsx / region-chrome.ts / i18n/locale.ts / core-pane.ts / capabilities-view.tsx）。
- 描述数据 owner：`packages/bundle/dsh-desktop-workbench`（apply.ts 内置 descriptor 只做 additive 补描述）；其他 pane provider 后续自行补 `presentation.description`，无需本仓配合。
- 协议面：`packages/host/pane-protocol` 不改（schema 已含 description）。`PaneWorkspaceSearchItemV1` 为本包导出的 host 合同，optional 字段 additive。
- 兼容分类：全部 additive/optional；旧 provider 无描述时行内不渲染描述行、详情条显示诚实空态，不影响任何既有测试合同。
- 不做的事：不引入远端富文本/markdown 描述渲染、不给描述加点击跳转、不把描述写进持久化 profile（描述始终从 registration/descriptor 现算）。
