# dsh-file-git-panes-v1

File watcher 与 Git Manager Pane handoff。文件变化走 owner event；缺 `FileWatchCapabilityV1` 时不得宣称实时。Git 只接受 typed action，任意 argv 拒绝，worktree 不释放 Ordo lease。
