# 编辑器风格按键纠正

用户要求按键风格延续 VS Code，Pane 交互借鉴 tmux；此前前缀模式属于误解。已移除 Ctrl+B 前缀、超时和提示，恢复直接侧栏操作，增加直接分屏和数字聚焦；多 Pane 循环和布局重排保留。

验证：宿主 keyboard/AppFrame/workspace-model 52 项、runtime 10 项通过；locale/layout 类型检查和 bundle 通过。真实 Chromium 覆盖四 Pane 分屏、正反循环、布局重排、数字聚焦、Meta/Control 和普通 o 输入，证据 `temp/integration-test-runs/pane-interactions-2026-09-07T06-37-24-717Z/`。六段补丁重建与幂等通过，证据 `temp/integration-test-runs/workbench-patches-2026-09-07T06-37-25-469Z/`。surface/plugin 和视觉回归按项目门执行。

macOS 仅验证 Meta/Option 事件，未进行真机/Safari 系统快捷键验证。终端和弹窗保留自己的按键处理。实际键位见 [Pane 交互说明](../design/dsh-pane-interaction-completion.md)；布局循环和向下分屏是编辑器风格扩展，并非逐项复刻 VS Code 默认键位。
