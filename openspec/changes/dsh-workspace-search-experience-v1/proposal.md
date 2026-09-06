## Why

当前“添加面板”将命令、面板和会话顺序堆叠，同一目标重复出现，缺少分组、筛选、键盘选择和数据等待反馈。用户要求同时完善搜索能力与视觉美化，使它成为与 DSH 宿主一致的“搜索与打开”入口。

## What Changes

- 空查询显示最近使用、已打开和常用工具；关键词结果按会话、面板、命令组织，分类内可按项目或功能分组。
- 提供类别、项目、已打开、可用状态和类别相关筛选；分组计数区分精确总数与已加载数量。
- 按稳定目标引用合并“打开面板”命令与面板结果，保留命令身份和兼容入口；不凭同名去重。
- 本地目录即时搜索；历史来源采用分组异步查询、分页、取消、有限内存缓存与后台更新，明确 loading/empty/error/stale/partial/disabled/unknown。
- 同轮重做搜索框、分类与筛选栏、语义图标、结果行、分组标题、键盘提示、主题和响应式尺寸。
- 支持定位已打开 Pane、选择打开方式、拖入停靠区，以及后续固定为搜索 Pane和保存常用筛选。

## Capabilities

### New Capabilities

- `workspace-search-discovery`: 结果身份、分组、排序、筛选及去重。
- `workspace-search-query-lifecycle`: 异步来源、分页、有限缓存、取消及失效。
- `workspace-search-surface`: 搜索 UI、主题、键盘、触控与状态反馈。
- `workspace-search-open-and-preferences`: 打开／定位／拖拽、搜索 Pane 与本机偏好。

### Modified Capabilities

无。增量复用既有注册、命令、会话搜索及布局合同，不修改已发布格式。

## Impact

- 准入分类：split-owner。DSH 宿主拥有搜索呈现、焦点和 Pane 打开；插件注册器提供安全目录与动作描述；历史服务拥有会话正文、权限、索引和查询。
- 设计及任务 owner：本 change。宿主实现经既有 staging 与 `upstream-prs/unified-multi-pane-workbench/` 维护；本计划不创建新 core fork。
- 预期实现路径：宿主 `packages/client/ui-layout`、locale 与必要的搜索 provider 适配；插件 `packages/client/ui-pane-workbench/src/unified-host.tsx`、view/command registry；所属项目现有 Playwright、Vitest 和证据入口。
- 复用 `dsh-long-term-history-global-search-v1` 的历史 owner 合同；其已完成设计任务不等于目标运行时拥有全部查询能力。先核实 `PaneWorkspaceContextProviderV1.search`、`PaneConversationSearchHostV1` 的实际可用性。
- 与 `dsh-pane-workspace-experience-v3` 及 `dsh-workspace-productivity-ui-v3` 的管理／选择器需求共用结果模型，避免第二套搜索 owner。
- 本轮只交付设计与待实施任务；不修改运行界面、profile、会话数据或现有未提交实现。不发布、不推送、不发送业务命令或付费请求。
