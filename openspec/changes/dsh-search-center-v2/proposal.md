## Why

现有工作区搜索已经具备会话、窗格、命令分组和固定搜索 Pane，但还不能按全工作区资源发现内容。用户希望以参考图的左侧分类、右侧探索布局为起点，先完整设计搜索风格、分类、预览和交互，再实施页面与来源适配。

首轮交付设计文档和待实施任务；2026-09-11用户要求建立Goal并推进实施与验收。搜索中心 v2 的设计完成不代表页面、领域查询或历史正文检索已经可用，进度以tasks及实际证据为准。

## What Changes

- 一个搜索中心 Pane 与一个快捷浮层共享查询语义；延续既有 `workspace.search`、搜索 Pane 身份和打开机制。
- 建立八个一级分类、两层以内的资源导航，覆盖会话、项目、文件知识、素材成果、提示词模板、Skills/工具、任务执行和窗格操作。
- 空查询使用分类探索卡片；有查询使用分组列表；媒体可以显式切换缩略图；宽屏按需预览。
- 明确每种资源的 owner、查询字段、筛选、权限范围、打开/预览方式及接入状态，区分目录、元数据和正文检索。
- 设计增量来源适配和可选展示元数据，不改变旧 V1 类型、命令或持久化语义，不创建第二份领域索引。
- 补齐 UI Contract、六类页面线框、故障恢复、场景矩阵、兼容与回退、分阶段任务及验证命令。

## Capabilities

### New Capabilities

- `dsh-search-center`: 分类探索、共享搜索体验、来源能力协商、只读预览、状态与可访问性。

### Modified Capabilities

无。本 change 使用 `ADDED`；现有工作区搜索 v1 尚有未完成真实历史验收，不能把其设计当作已归档主 spec 修改。

## Impact

- 准入：`split-owner`。本仓 `ui-pane-workbench` 负责搜索交互与聚合投影；DSH host 拥有主题、焦点、布局、会话和授权；文件、工具、领域资源与 Ordo 各自拥有查询和业务动作。
- 设计阶段文件：本 change 的 proposal/design/spec/tasks，搜索设计使用说明、文档索引和旧搜索 v1 演进链接；任务由仓库脚本初始化并按证据更新。实施阶段在同一change中维护代码与验证记录。
- 后续代码 owner：`packages/client/ui-pane-workbench` 复用查询/身份/打开模块；工具适配复用 `ui-mcp-inspector` 与 `dsh-tool-hub`；其他来源使用已有 host safe projection seam。需要宿主扩展时遵循 `upstream-prs` 通道。
- 已授权本地页面与适配实施；不修改用户运行 profile、不安装或修改 Skills、不发布、不部署；不新增联网搜索、语义搜索、独立 Workbench、领域数据库或通用索引服务。验证可使用隔离fixture，不把fixture通过当真实owner接入。
- 前置设计：[工作区搜索 v1](../dsh-workspace-search-experience-v1/design.md)、[长期历史](../dsh-long-term-history-global-search-v1/design.md)、[统一视觉系统](../../../docs/design/dsh-unified-panel-visual-system.md)。全部用户要求保留在本 change 能力账本中，来源缺失只影响对应阶段。
