# 工具定位反馈、执行摘要与视觉统一

## Why

用户提供的截图显示：跳转原调用后缺少可辨认的目标高亮；详情只有 bash/edit/read 名称、状态与耗时，无法判断当时实际执行的命令或操作；标题被统计和按钮挤成零碎文字，选中态只覆盖工具名，详情与筛选占据过多纵向空间。

本 change 是 dsh-session-tools-workspace-v2 的体验补充，不接管其任务、目录服务修复或会话绑定实现。此前仅完成规格和文档；现根据用户继续推进其他spec的请求进入实施，先完成基线和归属核对。

## What Changes

- 规定定位后的三层反馈：正确会话/Tab、所在 Pane、原调用记录。
- 规定由调用数据 owner 产生有界、脱敏、可解释的执行摘要；详情显示摘要而非完整参数。
- 统一标题、工具栏、整行选中态、代码摘要和详情返回路径，保持现有 Pane 风格。
- 为缺失记录、无摘要、重复定位、多 Pane、敏感命令与窄屏建立验收条件。

## Capabilities

### New Capabilities

- `dsh-tools-location-command-ux`: 工具排错的定位反馈、执行摘要与界面密度。

### Modified Capabilities

无。沿用主 change 的显式会话绑定、安全投影、列表/时间线及原消息导航能力，补充呈现与安全要求，不覆盖其已确认决策。

## Impact

fit：Tools 详情、工具栏与列表选中态归 ui-mcp-inspector。
split-owner：Chat 原调用定位、摘要生产及 Pane 活动边框属于相应宿主 owner；需要宿主变更时通过 upstream-prs 增量交付。

本轮从独立合成fixture复现开始，不变更真实profile、会话或外部配置。实现只修改本change明确拥有的路径；其他在途分支保留。
