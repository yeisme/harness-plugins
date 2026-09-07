# Pane 快捷键与布局切换

接在 `unified-multi-pane-workbench`、`composer-multi-reference-v1`、`workbench-runtime-cleanup` 后应用。Ctrl/Cmd+B 切换侧栏；Ctrl/Cmd+Alt+1/2/3 控制聚焦、左右和上下布局；Ctrl/Cmd+Alt+L 打开布局菜单。编辑器、终端、表单、输入法和已处理事件保留原行为。

```bash
bash upstream-prs/pane-interaction-completion/apply.sh /path/to/staging-checkout
pnpm dsh:workbench -- --rebuild --prepare-only
```

补丁是五个已有文件的零上下文增量与两个新文件，由 `node scripts/export-pane-interaction-patch.mjs <pre-change-source-directory>` 生成；`apply.sh` 使用 `--unidiff-zero`，并保护本地已经修改的新文件。布局复用既有 workspace 状态和 geometry 提交，不复制会话。
