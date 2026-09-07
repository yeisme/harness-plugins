# macOS 前缀与多 Pane 循环

接在 pane-interaction-completion 后应用。Ctrl+B 改为 tmux 风格前缀，Ctrl+B b 切换侧栏；macOS 保留非编辑区 Cmd+B。o/Shift+O 循环焦点，空格循环全树布局，%/双引号继续分屏。使用原 workspace 服务和原生选择器，保留内容身份。

```bash
bash upstream-prs/pane-keyboard-cycle/apply.sh /path/to/staging-checkout
node scripts/export-pane-keyboard-cycle-patch.mjs temp/pane-cycle-before
```

六文件增量由导出脚本生成，apply.sh 预检后原子应用并支持重复执行。不应用之前补丁的旧新文件副本覆盖本补丁。
