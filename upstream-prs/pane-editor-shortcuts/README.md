# VS Code 风格按键与多 Pane 交互

在 pane-keyboard-cycle 后应用。删除 Ctrl+B 前缀，恢复侧栏直接操作，加入 Ctrl/Cmd+反斜杠分屏与数字键聚焦。多 Pane 分屏、循环与全树重排逻辑保留。Alt+左右、Alt+0 等为本工作台的直接扩展快捷键，不宣称与 VS Code 默认键位完全一致。

```bash
bash upstream-prs/pane-editor-shortcuts/apply.sh /path/to/staging-checkout
node scripts/export-pane-editor-shortcuts-patch.mjs temp/pane-vscode-before
```

所有六个文件使用已有增量导出方式；重复应用不会恢复前缀。
