## 0. 前置：落地与自动化激活

- [x] 0.1 提交在途工作并 push develop，触发 ci.yml 首跑（typecheck/test/build/check:bundles/openspec 全绿为验收）。（progress 2026-08-22：首跑连环红后修到 `a73c2b8`/`46e2e0d`。验收 run：https://github.com/yeisme/harness-plugins/actions/runs/32556110363 与 32555256174，node 22/24 + OpenSpec + check:bundles 全绿。）
- [x] 0.2 手动 dispatch 一次 upstream-canary.yml 与 pr-rebase.yml，确认发布版安装冒烟与四系列 apply-check 真实运行；红灯则开 issue 并闭环。（progress 2026-08-22：canary install-smoke + overrides-test 在 `46e2e0d` run 32556111499 绿；#4 为环境/trap/bump-PR 假阳，关。pr-rebase 四系列真实跑过：user-actions-slot 绿，#1/#2/#3 真实 drift 留 Wave A。）
- [ ] 0.3 归档 openspec `✓ Complete` 状态的 change（openspec archive），active 列表收敛到真在做的事。（progress 2026-08-22：19/20 已归档；dsh-pane-workspace-docking-v2 的 spec delta 依赖 dsh-pane-workbench-interaction-v1 尚未归档时创建的 spec，待其完成后归档）

## 1. Wave A：已有完整 patch 的系列（按解锁价值排序）

- [x] 1.1 推送 user-actions-slot：PR staging worktree apply + dsh 仓测试全绿 → 推 `yeisme/deepseek-harness` 分支 → 上游 PR。验收：PR 链接登记进 `upstream-prs/user-actions-slot/README.md`。（progress 2026-08-22：修 typecheck/note 后 rebase 到 `b150a551b8d`。`tsc -b tsconfig.client.json` 绿；聚焦 spec 98/98；note-format + pairing 绿。分支 `yeisme:pr/user-actions-slot` `593ba0cae`；fork review PR https://github.com/yeisme/deepseek-harness/pull/1。当前 PAT 不能对 `deepseek-ai/deepseek-harness` 调 `createPullRequest`，上游入口是 compare https://github.com/deepseek-ai/deepseek-harness/compare/master...yeisme:deepseek-harness:pr/user-actions-slot）
- [ ] 1.2 推送 pane-workspace-layout、plan-dock、login-token-auth（同一流程；可并行 staging 验证）。验收：三个 PR 链接登记。
- [ ] 1.3 user-actions-slot 合入后：conversation-rewrite 6.2/6.3 解锁并完成，摘除降级提示；`upstream-prs/user-actions-slot/` 归档标记 merged。

## 2. Wave B：骨架系列补 patch（差异化直连）

- [ ] 2.1 web-cookieJars：补齐 changes.patch/new-files/apply.sh（host-owned jar apply/switch/clear typed API），staging 验证后推 PR。验收：cookie 插件 3.1 可勾。
- [ ] 2.2 session-fork-before-message：同流程（首轮 seedLength 0、边界校验、workspace 归属）。验收：rewrite 6.1 解锁。
- [ ] 2.3 preview-resource-v1：同流程（owner-issued ref、MIME sniff、range/rendition、abort/release）。验收：rich-media 4.1/4.2 解锁。

## 3. Wave C：合同已定、按需排期

- [ ] 3.1 fs-watch → File pane live（file-git-panes 3.2）。
- [ ] 3.2 git-typed-actions → Git pane typed actions。
- [ ] 3.3 TerminalInteractiveCapabilityV1 → terminal-interactive 剩余任务（Lane: commodity-parked，排在差异化之后）。

## 4. 生命周期与卫生

- [ ] 4.1 每个合入的系列：插件侧摘降级（probe 改直连 slot）、`upstream-prs/<slug>/README.md` 标记 merged+PR 链接、删除 patch 正文（保留 README 作记录）。
- [ ] 4.2 pr-rebase 红灯（冲突 issue）响应 SLA：48h 内 rebase 或明确降级决策，不做长期未合入 patch 囤积。
