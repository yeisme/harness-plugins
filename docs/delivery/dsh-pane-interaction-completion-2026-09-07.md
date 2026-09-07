# Pane 交互补齐验收

本轮修复统一宿主中的插件内容样式缺失，并把 Explorer 的大按钮区收为折叠操作、列表改为有界滚动、元信息改为紧凑状态行。选区工具条与固定反馈使用深色 Pane token、小圆角和轻量边框；主动作、More、固定、拖动与触控入口保留。

目录右键菜单和完整 watch/reconcile 不属于已实现项；本轮实现方向键懒加载、异步结果保留后续选择、实际滚动更新虚拟行、筛选清空恢复根目录、文件预览/固定与失败反馈。

`/mcp`、`/explorer`、`/pane` 裸命令经客户端原生选择界面进入已安装 Pane。Tools 面板修复了两个旧假设：生命周期 SessionSnapshot 不再承载 chat 数据，chat.nodes 是索引而非旧数组。当前从宿主 chat 的 legacy 兼容投影订阅安全调用活动，旧宿主的数组快照继续可用。目录为空是允许的真实状态，不伪造 MCP 服务或调用结果。

## 验证

| 范围 | 结果与证据 |
|---|---|
| Explorer 与统一宿主组件 | Explorer 22 项、统一宿主 7 项通过；包含键盘异步加载、选择保持、滚动、搜索清空/错误、打开文件 |
| 选区工具条 | 30 项交互测试通过 |
| 浏览器命令桥 | 8 项 bridge/bind 测试通过 |
| 新旧 Tools 快照兼容 | 7 项测试通过，覆盖索引型 chat + legacy 投影 |
| 宿主快捷键/AppFrame | 30 项测试通过；类型检查、locale/layout bundle 通过 |
| 视觉回归 | 92 项通过；`temp/integration-test-runs/ui-visual-2026-09-07T05-09-35-357Z-2979790/` |
| 真实浏览器 | `temp/integration-test-runs/pane-interactions-2026-09-07T05-45-56-791Z/`：紧凑 Explorer、真实 README 打开、布局/侧栏切换、`/mcp` 且 Tools 内容呈现 |
| 其他门 | surface、plugin contract 检查通过；所有修改包完成类型检查与构建 |

浏览器截图隐藏文件名；没有发送模型消息、执行 MCP 工具或修改用户文件。之前的失败证据保留用于追踪 Explorer 高度与 Tools 旧接口问题，不计作成功。

操作说明见 [Pane 风格交互](../design/dsh-pane-interaction-completion.md)。本轮规格在 `openspec/changes/dsh-pane-interaction-completion-v1/`，后续规划在 `openspec/changes/dsh-pane-workspace-followups-v1/`，后者仍为 planned。

## 后续规格适用范围

本文记录较早的 Pane 入口与快照兼容结果。会话工具 Tab、固定旁栏、目录连接恢复和原消息定位改由 [会话工具工作区 V2](../design/dsh-session-tools-workspace.md) 及其独立验收记录维护；本文的入口呈现通过不代表 V2 全功能通过。
