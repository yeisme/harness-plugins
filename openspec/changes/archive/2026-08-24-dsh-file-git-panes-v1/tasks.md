## 1. File watch 合同与探针

- [x] 1.1 冻结 `FileWatchCapabilityV1` 与 owner event 形状（opaque ref、cursor、created/changed/deleted/renamed）。验收：payload 无绝对路径。验证：`pnpm --filter @yeisme/dsh-file-host run test`。
- [x] 1.2 File host/File Pane 探测 capability；缺失时 freshness 非 live，禁止 `setInterval`。验收：负向 fixture `contract_mismatch`/`unknown`。验证：file-host + file-pane tests。
- [x] 1.3 上游 `upstream-prs/fs-watch/` 写清拟议 DSH 合同、apply.sh 骨架与禁止轮询。验收：README 可被 staging worktree 使用。

## 2. Git typed actions

- [x] 2.1 冻结 `GitTypedActionsCapabilityV1` 与封闭 action 枚举。验收：未知 action / 任意 argv → `not_available`。验证：`pnpm --filter @yeisme/dsh-git-host run test`。
- [x] 2.2 `worktree.remove` MUST NOT 映射到 Ordo `lease.release`。验收：负向 fixture。
- [x] 2.3 上游 `upstream-prs/git-typed-actions/` 骨架。验收：README 标明任意 argv 拒绝。

## 3. 验证

- [x] 3.1 `openspec validate dsh-file-git-panes-v1 --strict --no-interactive`。
- [x] 3.2 真实 DSH `ctx.fs` watcher 合入后才宣称 File live；本 change 不勾 live 验收。（progress 2026-08-22：fork 合同 PR #6 已登记。发布版未合入，File pane 仍不得宣称 live。）
