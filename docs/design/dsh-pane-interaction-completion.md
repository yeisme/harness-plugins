# Pane 风格交互与后续支持

Explorer 和选区工具条使用现有 Pane 的紧凑深色、低对比边框和小圆角。Explorer 的操作收进“文件操作”折叠区；每行引用与多选在 hover/focus/选中时显现，触控保留。目录树独立滚动，悬浮信息改为底部紧凑状态行，不覆盖文件列表。

目录鼠标与方向键使用相同懒加载路径，异步结果不还原后来的选择；滚动驱动真实虚拟窗口。单击预览、双击或 Enter 固定文件 Pane。筛选清空后重读根目录，失败显示原因。

## 键盘与布局

日常使用下方的 Ctrl+B 前缀操作。直接快捷键仍支持 Ctrl/⌘+Alt+1（聚焦）、2（所有停靠组左右排列）、3（上下排列）、L（布局菜单），编辑区域保留其原有直接快捷键。

## MCP 与能力缺席

`/mcp`、`/explorer` 和 `/pane` 的裸命令选择由客户端 `commandUi` 打开已安装面板，复用原生选项界面；不把浏览器能力交给 Host 判断，不发送模型消息。Tools 活动从新版宿主的 chat 投影读取，并兼容旧 snapshot；会话切换释放旧订阅。真实服务缺失仍报告原因，不把空标签计作功能通过。

## 验证与下一阶段

本轮规格见 `openspec/changes/dsh-pane-interaction-completion-v1/`。真实浏览器执行 `node scripts/test-pane-interactions.mjs`，通过临时 `DSH_PREVIEW_URL` 接收本地授权链接，证据不保存 token 或用户正文。

后续设计见 `openspec/changes/dsh-pane-workspace-followups-v1/`：目录 watch/reconcile、文件引用跨刷新恢复、未保存冲突、右键/Shift+F10 菜单与布局模板。它们仍是 planned，不能用本轮基本浏览与布局测试代替验收。

## macOS 与 tmux 风格多 Pane

Ctrl+B 现在进入前缀模式：松开两个键，再在两秒内按下表中的按键。Mac 使用 Control（⌃），不是 Command（⌘）。

| 后续按键 | 行为 |
|---|---|
| o / Shift+O | 下一 / 上一 Pane，首尾循环 |
| 空格 | 左右、上下、网格布局循环，作用于所有停靠 Pane |
| %（Shift+5） / 双引号 | 选择内容并向右 / 向下继续分屏 |
| z | 聚焦 / 还原当前 Pane |
| b | 切换侧栏 |
| Escape | 取消前缀 |

旧单次 Ctrl+B 侧栏操作改为 Ctrl+B b；Mac 非编辑区也可用 ⌘B。输入框内可用显式前缀，终端和模态框保留自己的按键。直接布局快捷键保留 Ctrl/⌘+Option+1/2/3/L；物理 code 匹配避免 Option 产生特殊字符。布局菜单也提供鼠标入口。

可以继续分出第三、第四及更多 Pane；选择已有内容会移动该 Pane，不创建相同会话的副本。浮动 Pane 参与焦点循环，布局重排保留浮动位置。显示面积受屏幕大小限制，过密时可用 z 聚焦；不设置双 Pane 上限。

规格：`openspec/changes/dsh-pane-keyboard-cycle-v1/`。
