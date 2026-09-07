## ADDED Requirements

### Requirement: Direct editor shortcuts
工作台 SHALL 使用直接组合键操作侧栏、分屏和聚焦，不要求 Ctrl+B 前缀。

#### Scenario: Direct action and ordinary typing
- **WHEN** 用户按 Ctrl/Cmd+B、反斜杠或数字组合键
- **THEN** 立即执行对应操作，后续普通 o 和空格不作为 Pane 命令

### Requirement: Preserve multi-pane interaction
工作台 SHALL 保留多 Pane 分屏、首尾循环和全树重排，保持会话身份。

#### Scenario: More than two panes
- **WHEN** 用户通过直接快捷键创建至少四个 Pane 并循环焦点和布局
- **THEN** 可正反绕回起点，数字键聚焦对应组，内容身份不变
