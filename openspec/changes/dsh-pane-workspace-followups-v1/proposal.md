## Why

当前已补齐目录滚动、基本加载、文件打开、客户端 MCP 入口和常用布局切换。用户要求继续推进目录、文件与布局体验；长期使用还需要文件变化后的可靠恢复、引用重开以及上下文操作。本change已完成目录上下文菜单切片；目录事件、引用恢复和完整布局连续性仍按任务分别验收。

## What Changes

- 目录 watch 与 cursor gap 的 owner reconcile，不用轮询覆盖用户选择。
- opaque 文件引用跨刷新重新解析，保留 dirty/version/conflict 边界。
- 目录右键/Shift+F10 菜单，复用已有预检、冲突和撤销服务。
- 布局模板、快捷键可发现性和跨项目恢复使用既有 host preset。

## Capabilities

### New Capabilities
- `dsh-pane-workspace-continuity`: 目录变化、资源引用与布局在长会话中的恢复合同。

## Impact

`fit`：pane client 拥有交互；文件服务拥有版本、事件、权限与 mutation；宿主拥有布局持久化。仅在现有服务缺少必要接口时另写 owner 增量，不新增 client 数据库或第二套文件索引。
