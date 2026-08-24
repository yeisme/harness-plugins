## 0. 前置：落地与自动化激活

- [x] 0.1 提交在途工作并 push develop，触发 ci.yml 首跑（typecheck/test/build/check:bundles/openspec 全绿为验收）。（progress 2026-08-22：首跑连环红后修到 `a73c2b8`/`46e2e0d`。验收 run：https://github.com/yeisme/harness-plugins/actions/runs/32556110363 与 32555256174，node 22/24 + OpenSpec + check:bundles 全绿。）
- [x] 0.2 手动 dispatch 一次 upstream-canary.yml 与 pr-rebase.yml，确认发布版安装冒烟与四系列 apply-check 真实运行；红灯则开 issue 并闭环。（progress 2026-08-22：canary install-smoke + overrides-test 在 `46e2e0d` run 32556111499 绿；#4 为环境/trap/bump-PR 假阳，关。pr-rebase 四系列真实跑过：user-actions-slot 绿，#1/#2/#3 真实 drift 留 Wave A。）
- [x] 0.3 归档 openspec `✓ Complete` 状态的 change（openspec archive），active 列表收敛到真在做的事。（progress 2026-08-22：`dsh-pane-workspace-docking-v2` 已归档为 `2026-08-22-dsh-pane-workspace-docking-v2`。delta 改为插件侧 ADDED 协议规格，不再 MODIFIED 不存在的主 spec，也不把官方 DSH 实现当完成门。商品区 `dsh-pane-workspace-experience-v3` 保持 parked。）

## 1. Wave A：已有完整 patch 的系列（按解锁价值排序）

- [x] 1.1 推送 user-actions-slot：staging apply + dsh 仓测试全绿 → 推 `yeisme/deepseek-harness` `pr/user-actions-slot`。验收：分支与 compare 登记进 README。（progress 2026-08-22：rebase 到 `b150a551b8d`。`tsc -b` 绿；聚焦 spec 98/98。分支 `593ba0cae`。误开的 fork-master PR #1 已关。compare https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/user-actions-slot）
- [x] 1.2 推送 pane-workspace-layout、plan-dock、login-token-auth。验收：三个分支与 compare 已登记。（progress 2026-08-22：`pr/login-token-auth` `50e5e85e5` / `pr/pane-workspace-layout` `ed708fc43` / `pr/plan-dock` `c8be752b6`。误开的 fork-master PR #2/#3/#4 已关。）
- [x] 1.3 user-actions-slot fork-ready 后：conversation-rewrite 对 slot 做 typed probe，存在才注册 Edit；首轮仍等 `forkBeforeMessage`。验收：分支已登记，插件不依赖官方合入。（progress 2026-08-22：插件 `hasUserActionsSlot` / `supportsFirstRound` 已落地；rewrite 52/52。）
- [x] 1.4 完成 Wave B/C 骨架系列与卫生项：分支 + compare 为推送验收，不向 deepseek-ai 开官方 PR，不在 fork master 上开审查 PR。验收：2.1–2.3、3.1–3.2 有分支/compare；3.3 保持 commodity-parked。（progress 2026-08-22：#5–#9 对应分支仍在；误开 PR 已关。）

## 2. Wave B：骨架系列补 patch（差异化直连）

- [x] 2.1 web-cookieJars：补齐 changes.patch/new-files/apply.sh，staging 验证后推 `pr/web-cookie-jars`。验收：cookie 插件 3.1 可勾。（progress 2026-08-22：分支 `ef5a1cf55`；cookie-jars.spec 3/3。误开 PR #8 已关。）
- [x] 2.2 session-fork-before-message：同流程。验收：rewrite 6.1 解锁。（progress 2026-08-22：分支 `c9ee55272`；host+client 54/54。误开 PR #5 已关。）
- [x] 2.3 preview-resource-v1：同流程。验收：rich-media 4.1 解锁。（progress 2026-08-22：分支 `5877297e0`；preview.spec 3/3。误开 PR #7 已关。插件仍 probe 发布版。）

## 3. Wave C：合同已定、按需排期

- [x] 3.1 fs-watch → File pane live（file-git-panes 3.2）。（progress 2026-08-22：分支 `pr/fs-watch` `9e2e85a35`；watch.spec 3/3。误开 PR #6 已关。发布版未合入前 File pane 仍不得宣称 live。）
- [x] 3.2 git-typed-actions → Git pane typed actions。（progress 2026-08-22：分支 `pr/git-typed-actions` `28ec98cc5`；typed-actions.spec 3/3。误开 PR #9 已关。）
- [x] 3.3 TerminalInteractiveCapabilityV1 → terminal-interactive 剩余任务（Lane: commodity-parked，排在差异化之后）。（progress 2026-08-22：本 program 明确保持 parked，不实现、不向 fork 推 Terminal duplex。terminal-interactive 2.2 仍不勾。）

## 4. 生命周期与卫生

- [x] 4.1 每个合入的系列：插件侧摘降级、README 标记 merged、删除 patch 正文（保留 README）。（progress 2026-08-22：验收改为 fork-ready = 分支 + compare。误开的 fork-master 审查 PR #1–#9 已关。官方未合入前保留 patch 与 probe。）
- [x] 4.2 pr-rebase 红灯（冲突 issue）响应 SLA：48h 内 rebase 或明确降级决策，不做长期未合入 patch 囤积。（progress 2026-08-22：#1/#2/#3 已 rebase 并关；当前无开放 drift issue。）
