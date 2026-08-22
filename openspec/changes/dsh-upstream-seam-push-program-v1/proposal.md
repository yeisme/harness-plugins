## Why

fork 退役后，core seam 的唯一通道是 `upstream-prs/<slug>/` patch 系列，插件侧以 capability probe + 降级承接。本 program 的验收止于 `yeisme/deepseek-harness` fork review PR + compare URL，不向 `deepseek-ai/deepseek-harness` 开官方 PR。Wave A/B/C 骨架系列现已全部 fork-ready；插件在发布版上继续 probe。与此同时，插件侧一等一的差异化功能映射到这些 seam：

| seam 系列 | 解锁的插件任务 |
| --- | --- |
| user-actions-slot | dsh-conversation-rewrite-plugin-v1 6.2/6.3/6.6（Edit/Retry 首轮可用） |
| session-fork-before-message | 同上 6.1（原子分支） |
| web-cookie-jars | dsh-session-cookie-manager-plugin-v1 3.1/3.2（真实 jar 应用/切换/清除） |
| preview-resource-v1 | dsh-rich-media-plugin-v1 4.1/4.2（真实媒体投影） |
| fs-watch | dsh-file-git-panes-v1 3.2（File pane live freshness） |
| git-typed-actions | Git pane typed actions 合同闭合 |
| TerminalInteractiveCapabilityV1 | dsh-terminal-interactive-v1 剩余（真实 PTY duplex） |
| login-token-auth / pane-workspace-layout / plan-dock | 已有完整 patch，fork review PR 已登记 |

seam 不推 → 插件永久降级态 → 差异化护城河只在本地成立。这不是实现问题，是编排问题：需要一个 change 把"推送顺序、staging 验证、上游 PR、合入后插件解锁"固化为可勾选、可验证的任务链。

## What Changes

- 立项 upstream seam 推进 program（本 change）：定义 4+5 系列的推送波次、每系列的标准生命周期（patch 就绪 → staging worktree 全量验证 → 推 yeisme/deepseek-harness 分支 → fork review PR + compare URL）、以及 fork-ready 判据。官方 `deepseek-ai/deepseek-harness` PR 不在本 change 验收内。
- 不新增插件代码、不改 DSH core（patch 内容已在各系列目录冻结）。本 change 只锁编排合同与验收。
- 插件侧解锁任务保留在各 owner change 内（上表映射），本 change 的任务引用它们但不复制。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| upstream PR 生命周期编排 | required | Harness Plugins | deliver-now | 本 change tasks 全勾 |
| staging worktree 验证标准 | required | Harness Plugins | deliver-now | 每波次 apply-check + 对应包测试记录 |
| canary/pr-rebase 自动化激活 | required | Harness Plugins | deliver-now | 首次 workflow run 绿灯（或红灯 issue 闭环） |
| 插件侧解锁映射 | required | Harness Plugins | reference | 本 proposal 表格 + 各 change 任务 |

## Capabilities

### New Capabilities
- `dsh-upstream-seam-push`：上游 seam PR 的波次编排、生命周期与解锁映射。
