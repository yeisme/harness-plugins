# macOS 快捷键与多 Pane 循环验收

> 本文记录早先的前缀方案。用户随后明确要求 VS Code 风格按键，当前行为以 [编辑器风格纠正](dsh-editor-style-pane-shortcuts-2026-09-07.md) 为准；多 Pane 交互逻辑保留。


已实现 Ctrl+B 前缀、编辑区域显式激活、o/Shift+O 正反循环、空格循环全树布局、%/双引号继续分屏与原生选择器、z 聚焦和 b 侧栏。Meta+B 非编辑区侧栏保留；Option 特殊字符用物理 code 匹配。单次 Ctrl+B 侧栏入口被前缀取代，使用 Ctrl+B b。

焦点循环包括浮动组；布局重排只改变停靠树。分屏选择已存在内容时移动该 Pane，不克隆会话；取消选择器不固定原先的预览标签。

## 验证

- 宿主 keyboard、AppFrame 和 workspace-model：52 项通过，覆盖 1/3/8/32 Pane、首尾循环、浮动组、身份保持和 macOS 物理键。
- locale/layout 类型检查与 bundle 通过；启动器/runtime 10 项通过。
- surface、plugin gates 通过；视觉测试 92 项通过，证据 `temp/integration-test-runs/ui-visual-2026-09-07T06-27-59-513Z-486700/`。
- 真实 Chromium：四 Pane 继续分屏、双向绕回、四次布局循环、编辑区草稿保持、Meta+B、前缀 b、Escape 和超时通过。证据 `temp/integration-test-runs/pane-interactions-2026-09-07T06-29-47-135Z/`。
- 增量包接在 pane-interaction-completion 后；重建检查覆盖全部六个变更文件和幂等应用。

初次从插件根目录运行宿主 Vitest 时误收集了临时快照，出现依赖解析失败；已改在宿主源码目录运行其现有 Vitest 配置。初次补丁逐字比较发现旧包应用时清除了尾随空格；已规范化对应空白并重新导出验证，未更改业务逻辑。

当前为 Linux Chromium 的 Meta/Option 事件验证，没有 macOS 真机或 Safari 系统级快捷键验证。不宣称无限屏幕面积；Pane 数量不限制为两个，过密时可用 z 聚焦。

使用说明：[Pane 交互](../design/dsh-pane-interaction-completion.md)。规格：`openspec/changes/dsh-pane-keyboard-cycle-v1/`。
