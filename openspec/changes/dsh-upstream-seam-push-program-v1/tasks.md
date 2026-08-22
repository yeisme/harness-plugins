## 0. 前置：落地与自动化激活

- [ ] 0.1 提交在途工作并 push develop，触发 ci.yml 首跑（typecheck/test/build/check:bundles/openspec 全绿为验收）。
- [ ] 0.2 手动 dispatch 一次 upstream-canary.yml 与 pr-rebase.yml，确认发布版安装冒烟与四系列 apply-check 真实运行；红灯则开 issue 并闭环。
- [ ] 0.3 归档 openspec `✓ Complete` 状态的 change（openspec archive），active 列表收敛到真在做的事。

## 1. Wave A：已有完整 patch 的系列（按解锁价值排序）

- [ ] 1.1 推送 user-actions-slot：PR staging worktree apply + dsh 仓测试全绿 → 推 `yeisme/deepseek-harness` 分支 → 上游 PR。验收：PR 链接登记进 `upstream-prs/user-actions-slot/README.md`。
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
