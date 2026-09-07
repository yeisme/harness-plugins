# Pane 风格交互与后续支持

Explorer 和选区工具条使用现有 Pane 的紧凑深色、低对比边框和小圆角。Explorer 的操作收进“文件操作”折叠区；每行引用与多选在 hover/focus/选中时显现，触控保留。目录树独立滚动，悬浮信息改为底部紧凑状态行，不覆盖文件列表。

目录鼠标与方向键使用相同懒加载路径，异步结果不还原后来的选择；滚动驱动真实虚拟窗口。单击预览、双击或 Enter 固定文件 Pane。筛选清空后重读根目录，失败显示原因。

## 键盘与布局

使用 VS Code 风格的直接快捷键，macOS 用 Command（⌘），Windows/Linux 用 Ctrl；没有 Ctrl+B 前缀模式。

| 快捷键 | 行为 |
|---|---|
| Ctrl/Cmd+B | 直接切换侧栏 |
| Ctrl/Cmd+反斜杠 | 选择内容向右分屏 |
| Ctrl/Cmd+Shift+反斜杠 | 选择内容向下分屏 |
| Ctrl/Cmd+1…9 | 聚焦对应 Pane 组 |
| Ctrl/Cmd+Alt+右 / 左 | 下一 / 上一 Pane，首尾循环 |
| Ctrl/Cmd+Alt+0 | 左右、上下、网格布局循环 |
| Ctrl/Cmd+Alt+1 | 聚焦 / 还原当前组 |
| Ctrl/Cmd+Alt+2 / 3 | 所有停靠组左右 / 上下排列 |
| Ctrl/Cmd+Alt+L | 打开布局菜单 |

macOS 的 Alt 即 Option（⌥）。布局循环、上下分屏等为工作台扩展；按键风格对齐编辑器，不宣称逐项复刻 VS Code 默认值。快捷键在 composer 内可用，终端、模态和输入法保留自己的输入处理。普通 o、空格、百分号等始终正常输入。

Pane 交互借鉴 tmux 的可组合分屏、独立上下文与循环导航。可以继续分出第三、第四及更多 Pane；选择已有内容会移动它，不复制会话。浮动组参与焦点循环，布局重排保留浮动位置；显示面积受屏幕大小限制，可用聚焦模式查看内容。

## MCP 与能力缺席

`/mcp`、`/explorer` 和 `/pane` 的裸命令选择由客户端 `commandUi` 打开已安装面板，复用原生选项界面；不把浏览器能力交给 Host 判断，不发送模型消息。Tools 活动从新版宿主的 chat 投影读取，并兼容旧 snapshot；会话切换释放旧订阅。真实服务缺失仍报告原因，不把空标签计作功能通过。

## 验证与下一阶段

本轮规格见 `openspec/changes/dsh-pane-interaction-completion-v1/`。真实浏览器执行 `node scripts/test-pane-interactions.mjs`，通过临时 `DSH_PREVIEW_URL` 接收本地授权链接，证据不保存 token 或用户正文。

后续设计见 `openspec/changes/dsh-pane-workspace-followups-v1/`：目录 watch/reconcile、文件引用跨刷新恢复、未保存冲突、右键/Shift+F10 菜单与布局模板。它们仍是 planned，不能用本轮基本浏览与布局测试代替验收。


当前快捷键规格：`openspec/changes/dsh-editor-style-pane-shortcuts-v1/`。此前前缀方案已由本规格替代。
