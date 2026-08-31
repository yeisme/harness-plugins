## Why

Pane 管理中心已经具备搜索、筛选、详情、批量管理与多来源能力，但当前首屏同时暴露模式、来源和七个高级筛选，中文环境仍混有 Pane/Tab/Agent、raw status 与 raw region，窄屏也只是压缩居中弹窗。功能完整但层级拥挤，用户难以快速完成“搜索并打开窗格”这一主任务。

## What Changes

- 将 Pane 管理中心重排为标题、模式、搜索、来源快捷筛选、结果五级层次；高级筛选默认折叠并显示启用数量。
- 使用现有 visual-kit token 与语义 SVG 图标补齐模式、来源、筛选、对话和打开位置入口；不引入图标依赖或第二套样式系统。
- 中文界面统一使用“窗格、标签页、智能体、右侧、底部、所有者”等自然文案，并按 DSH LocaleRuntime 热切换；无 LocaleRuntime 时使用浏览器语言作临时展示 fallback，不写入偏好。
- 严格搜索无结果时，对当前授权本地候选执行有界双字符相似度推荐，最多显示三条“你可能在找”，不触发 Host 搜索或持久化。
- 增加远端 loading/partial/error 呈现、按需创建分组、仅选中时显示批量操作栏，以及 600px 以下全屏布局。
- 对导出的 `WorkbenchIconName` 仅增量加入 `filter`、`message`、`chevron-right`、`chevron-down`；不删除、不重命名现有图标名。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `dsh-pane-management-center`: 修改管理中心的信息层级、折叠筛选、按需分组、打开位置入口、批量操作栏与窄屏形态要求。
- `dsh-pane-search-sources`: 增加本地相近结果、远端搜索状态展示和严格的权限/副作用边界。
- `dsh-pane-management-i18n`: 明确自然中文、注册项 labelKey 解析、状态/区域本地化与旧 Host 浏览器语言临时 fallback。

## Impact

- 主要代码：`packages/client/ui-pane-workbench` 的管理中心组件、共享 chrome 样式、图标词表、locale 资源与组件测试。
- Split owner：`packages/client/ui-pane-subagent` 仅为 Agents 注册补充现有 `paneWorkbench` namespace 的本地 i18n 元数据。
- 公开类型：`WorkbenchIconName`/`WORKBENCH_ICON_NAMES` 只增量扩展，属于向后兼容变更；无迁移、弃用窗口或 consumer 重写。
- 不修改 `PaneConversationSearchHostV1`、workspace search、持久化 envelope、协议 schema 或 canonical workspace state；回滚可直接撤销 UI/package 变更，不涉及数据回滚。
