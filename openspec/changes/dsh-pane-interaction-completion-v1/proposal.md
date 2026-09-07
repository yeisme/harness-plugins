## Why

用户截图中的选区工具条颜色和密度偏离 Pane；Explorer 在统一宿主下丢失旧 chrome 样式，展示大按钮、固定高度列表与重叠元信息。目录键盘展开未加载子项，滚动未驱动虚拟窗口。`/mcp` 仍通过 Host 判断浏览器 pane 是否存在，导致已安装能力被误报缺席。

## What Changes

- 统一宿主中的插件内容独立加载 scoped pane 样式；选区工具条使用紧凑 Pane token。
- Explorer 聚合次要文件操作，支持键盘懒加载、真实滚动、预览/固定打开和明确失败反馈。
- 浏览器将 `/mcp`、`/explorer`、`/pane` 路由至实际已注册的 pane，保留 Host 与旧宿主诚实降级。
- `Ctrl/Cmd+B` 切换导航侧栏；增加 Pane 布局快捷操作，并尊重编辑器、终端和输入法。
- 记录后续目录监听、恢复与高级布局能力；首批仍复用现有 owner 服务和布局状态。

## Capabilities

### New Capabilities
- `dsh-pane-interaction-completion`: 同风格工具交互、目录浏览、文件打开与浏览器 pane 入口。

## Impact

全部 `fit`：harness-plugins 拥有插件交互与命令桥，宿主快捷键通过 staging/upstream-prs 维护。文件、MCP 和会话 canonical owner 不变。已有搜索任务的脏改动保留；不改其 owned paths。无协议删除或数据迁移。
