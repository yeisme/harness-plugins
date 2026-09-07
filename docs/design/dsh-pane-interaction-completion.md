# Pane 风格交互与后续支持

Explorer 和选区工具条使用现有 Pane 的紧凑深色、低对比边框和小圆角。Explorer 的操作收进“文件操作”折叠区；每行引用与多选在 hover/focus/选中时显现，触控保留。目录树独立滚动，悬浮信息改为底部紧凑状态行，不覆盖文件列表。

目录鼠标与方向键使用相同懒加载路径，异步结果不还原后来的选择；滚动驱动真实虚拟窗口。单击预览、双击或 Enter 固定文件 Pane。筛选清空后重读根目录，失败显示原因。

## 键盘与布局

| 按键（Mac 可用 Cmd 替代 Ctrl） | 行为 |
|---|---|
| Ctrl+B | 非编辑区域切换侧栏 |
| Ctrl+Alt+1 / Ctrl+Alt+Enter | 聚焦当前组／还原 |
| Ctrl+Alt+2 | 左右两栏；单组有多个标签时分离末尾标签 |
| Ctrl+Alt+3 | 上下两栏 |
| Ctrl+Alt+L | 打开布局菜单 |

只有一个标签时不创建空 Pane。窄容器继续遵循宿主可读尺寸约束。输入法、编辑器、终端、表单和已处理的事件保留原快捷键，不抢占加粗或终端输入。

## MCP 与能力缺席

`/mcp`、`/explorer` 和 `/pane` 的裸命令选择由客户端 `commandUi` 打开已安装面板，复用原生选项界面；不把浏览器能力交给 Host 判断，不发送模型消息。Tools 活动从新版宿主的 chat 投影读取，并兼容旧 snapshot；会话切换释放旧订阅。真实服务缺失仍报告原因，不把空标签计作功能通过。

## 验证与下一阶段

本轮规格见 `openspec/changes/dsh-pane-interaction-completion-v1/`。真实浏览器执行 `node scripts/test-pane-interactions.mjs`，通过临时 `DSH_PREVIEW_URL` 接收本地授权链接，证据不保存 token 或用户正文。

后续设计见 `openspec/changes/dsh-pane-workspace-followups-v1/`：目录 watch/reconcile、文件引用跨刷新恢复、未保存冲突、右键/Shift+F10 菜单与布局模板。它们仍是 planned，不能用本轮基本浏览与布局测试代替验收。
