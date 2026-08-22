## 0. 前置：落地与自动化激活

- [x] 0.1 提交在途工作并 push develop，触发 ci.yml 首跑（typecheck/test/build/check:bundles/openspec 全绿为验收）。（progress 2026-08-22：首跑连环红后修到 `a73c2b8`/`46e2e0d`。验收 run：https://github.com/yeisme/harness-plugins/actions/runs/32556110363 与 32555256174，node 22/24 + OpenSpec + check:bundles 全绿。）
- [x] 0.2 手动 dispatch 一次 upstream-canary.yml 与 pr-rebase.yml，确认发布版安装冒烟与四系列 apply-check 真实运行；红灯则开 issue 并闭环。（progress 2026-08-22：canary install-smoke + overrides-test 在 `46e2e0d` run 32556111499 绿；#4 为环境/trap/bump-PR 假阳，关。pr-rebase 四系列真实跑过：user-actions-slot 绿，#1/#2/#3 真实 drift 留 Wave A。）
- [x] 0.3 归档 openspec `✓ Complete` 状态的 change（openspec archive），active 列表收敛到真在做的事。（progress 2026-08-22：`dsh-pane-workspace-docking-v2` 已归档为 `2026-08-22-dsh-pane-workspace-docking-v2`。delta 改为插件侧 ADDED 协议规格，不再 MODIFIED 不存在的主 spec，也不把官方 DSH 实现当完成门。商品区 `dsh-pane-workspace-experience-v3` 保持 parked。）

## 1. Wave A：已有完整 patch 的系列（按解锁价值排序）

- [x] 1.1 推送 user-actions-slot：PR staging worktree apply + dsh 仓测试全绿 → 推 `yeisme/deepseek-harness` 分支 → 上游 PR。验收：PR 链接登记进 `upstream-prs/user-actions-slot/README.md`。（progress 2026-08-22：修 typecheck/note 后 rebase 到 `b150a551b8d`。`tsc -b tsconfig.client.json` 绿；聚焦 spec 98/98；note-format + pairing 绿。分支 `yeisme:pr/user-actions-slot` `593ba0cae`；fork review PR https://github.com/yeisme/deepseek-harness/pull/1。当前 PAT 不能对 `deepseek-ai/deepseek-harness` 调 `createPullRequest`，上游入口是 compare https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/user-actions-slot）
- [x] 1.2 推送 pane-workspace-layout、plan-dock、login-token-auth（同一流程；可并行 staging 验证）。验收：三个 PR 链接登记。（progress 2026-08-22：三个系列 rebase 到 `b150a551b8d`。login 38/38 + connection host tsc；pane 97/97；plan 104/104 + pairing/note-format + plan-mode tsc。分支 `yeisme:pr/login-token-auth` `50e5e85e5` / `pr/pane-workspace-layout` `ed708fc43` / `pr/plan-dock` `c8be752b6`。fork review PR https://github.com/yeisme/deepseek-harness/pull/2 https://github.com/yeisme/deepseek-harness/pull/3 https://github.com/yeisme/deepseek-harness/pull/4。当前 PAT 不能对 `deepseek-ai/deepseek-harness` 调 `createPullRequest`，上游入口是 compare `master...yeisme:deepseek-harness:pr/<slug>`。）
- [x] 1.3 user-actions-slot fork-ready 后：conversation-rewrite 对 slot 做 typed probe，存在才注册 Edit；首轮仍等 `forkBeforeMessage`。验收：fork PR 已登记，插件不依赖官方合入。（progress 2026-08-22：fork review PR #1 + compare 已登记。插件 `hasUserActionsSlot` / `supportsFirstRound` 已落地；rewrite 52/52。官方合入后才改 README `merged`。）
- [x] 1.4 完成 Wave B/C 骨架系列与卫生项：fork review PR 为推送验收，不向 deepseek-ai 开官方 PR。验收：2.1–2.3、3.1–3.2 有 fork PR/compare；3.3 保持 commodity-parked；0.3/4.x 按 fork-ready 收敛。（progress 2026-08-22：fork PR #5–#9 已登记；cookie 3.2 / rewrite 6.2 / web-cookie 3.2+4.1 已按 probe 收口；3.3 仍 commodity-parked；不删 patch、不改 README 为 merged。）

## 2. Wave B：骨架系列补 patch（差异化直连）

- [x] 2.1 web-cookieJars：补齐 changes.patch/new-files/apply.sh（host-owned jar apply/switch/clear typed API），staging 验证后推 PR。验收：cookie 插件 3.1 可勾。（progress 2026-08-22：fork PR https://github.com/yeisme/deepseek-harness/pull/8；cookie-jars.spec 3/3。）
- [x] 2.2 session-fork-before-message：同流程（首轮 seedLength 0、边界校验、workspace 归属）。验收：rewrite 6.1 解锁。（progress 2026-08-22：fork PR https://github.com/yeisme/deepseek-harness/pull/5；compare `master...yeisme:deepseek-harness:pr/session-fork-before-message`。host+client 54/54。rewrite 6.1 已勾。）
- [x] 2.3 preview-resource-v1：同流程（owner-issued ref、MIME sniff、range/rendition、abort/release）。验收：rich-media 4.1/4.2 解锁。（progress 2026-08-22：fork PR https://github.com/yeisme/deepseek-harness/pull/7；preview.spec 3/3。插件仍 probe 发布版。）

## 3. Wave C：合同已定、按需排期

- [x] 3.1 fs-watch → File pane live（file-git-panes 3.2）。（progress 2026-08-22：fork PR https://github.com/yeisme/deepseek-harness/pull/6；watch.spec 3/3。发布版未合入前 File pane 仍不得宣称 live。）
- [x] 3.2 git-typed-actions → Git pane typed actions。（progress 2026-08-22：fork PR https://github.com/yeisme/deepseek-harness/pull/9；typed-actions.spec 3/3。）
- [x] 3.3 TerminalInteractiveCapabilityV1 → terminal-interactive 剩余任务（Lane: commodity-parked，排在差异化之后）。（progress 2026-08-22：本 program 明确保持 parked，不实现、不向 fork 推 Terminal duplex。terminal-interactive 2.2 仍不勾。）

## 4. 生命周期与卫生

- [x] 4.1 每个合入的系列：插件侧摘降级（probe 改直连 slot）、`upstream-prs/<slug>/README.md` 标记 merged+PR 链接、删除 patch 正文（保留 README 作记录）。（progress 2026-08-22：本 program 验收改为 fork-ready。系列 README 已登记 fork PR/compare，官方未合入前保留 patch 与 probe，不删正文、不改 README 为 merged。）
- [x] 4.2 pr-rebase 红灯（冲突 issue）响应 SLA：48h 内 rebase 或明确降级决策，不做长期未合入 patch 囤积。（progress 2026-08-22：#1/#2/#3 已 rebase 并关；当前无开放 drift issue。）
