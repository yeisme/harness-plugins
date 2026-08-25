## 1. Contract closure

- [x] 1.1 Owner: root maintainer；Lane: owner-routing；Dependencies: none；Scope: all seven related changes；Exclusions: 不移动 canonical state；Acceptance: capability ledger、path lease、cross-project handoff 和 local/release gate 完成；Validation: `openspec list` 与 strict validation；Expected: 每个 open task 都有唯一 owner。
- [x] 1.2 Owner: root maintainer；Lane: contract-routing；Dependencies: 1.1；Scope: Ordo task scope、Pane alias tasks、composition UI handoff；Exclusions: 不在 shim 中新增业务实现；Acceptance: Ordo 实现统一落在 bundle package，composition picker 指向 DSH client owner，platform 5.2/5.3 不创建第二 reducer；Validation: `git diff --check` 与各 change strict validation。

## 2. Official CLI and profile composition

- [x] 2.1 Owner: DSH core/client owner；Lane: official-cli；Dependencies: 1.1；Scope: `apps/cli/**`；Exclusions: 不新增旁路 `dsh-pane` 命令；Acceptance: `dsh plugin manifest init|validate|pack` 为 additive official namespace，既有 profile plugin commands 保持兼容；Validation: CLI args/process tests 和 output contract tests。
- [ ] 2.2 Owner: Harness Plugins；Lane: profile-composition；Dependencies: 1.2；Scope: bundle patches、package conformance、profile fixtures；Exclusions: 不发布或修改 production state；Acceptance: unified Ordo、independent composition、Pane Workbench rows 可被 clean profile 解析且无 duplicate/unresolved row；Validation: packed local profile test。（Pane Workbench 子切片已由最新 `temp/integration-test-runs/2026-08-19T07-01-59-861Z-396072-pane-profile/summary.json` 证明 install/dump/boot/remove 无 duplicate/unresolved；统一 Ordo + independent composition 的完整 clean profile 仍受本仓库没有 composition package/artifact 与 DSH peer release 的外部 owner 约束，未以 Pane-only 证据勾选 umbrella task。（blocked 2026-08-24: missing independent composition package/artifact + DSH peer release. Pane-only profile evidence is not enough.）

## 3. Evidence and closeout

- [ ] 3.1 Owner: Harness Plugins test engineer；Lane: evidence；Dependencies: 2.2；Scope: integration/component/system/e2e evidence；Exclusions: 不修改 tracked source、tests、fixtures、snapshots、config 或 lockfile；Acceptance: 每次运行生成 `temp/integration-test-runs/<run-id>/summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`，并完成 redaction；Validation: profile lifecycle and browser evidence。（2026-08-19 已生成 Pane profile conformance evidence：`temp/integration-test-runs/2026-08-19T07-01-59-861Z-396072-pane-profile/`；Ordo unified bundle focused tests 31/31 通过。browser Playwright 与 unified Ordo+composition clean-profile evidence 仍缺，任务保持 open。（blocked 2026-08-24: official browser Playwright + composition clean-profile evidence. Depends on 2.2.）
- [ ] 3.2 Owner: root maintainer；Lane: final-acceptance；Dependencies: 3.1；Scope: this change and all child changes；Exclusions: 不 archive、不 publish、不 push；Acceptance: seven changes strict valid，所有 deliver-now task 有 evidence，external release blocker 明确记录；Validation: `openspec validate dsh-plugin-ecosystem-consolidation-v1 --strict --no-interactive`、`git diff --check`。（blocked 2026-08-24: depends on 2.2/3.1 composition artifact + official profile/browser evidence. Strict validate already exits 0; change stays active.）

## 2026-08-16 收束状态

- 1.1、1.2、2.1 已完成：owner ledger、path lease、DSH client handoff 已写入 design；官方 CLI 的 16 项 args/manifest 测试、CLI typecheck、GUI 3773 项测试和 composition E2E 4 项通过。
- manifest pack 已补充 `shell:false`、lifecycle-script 禁止、realpath/lstat 边界、目录边界正确的 glob 展开、绝对 out-dir、重复打包识别、暂存逐文件 SHA-256 绑定和 tar member/完整 metadata binding；输出继续使用安全占位命令，不携带用户路径。
- 2.2、3.1、3.2 保持未完成：Pane bundle/profile 的 install/dump/real Web Loader evidence 已补齐，但 browser evidence 尚未完成；Harness 侧 unified Ordo + independent composition 的 packed composition 仍无法对齐已安装 DSH peer 的 standing/source read API。DSH E2E evidence 位于 `client/deepseek-harness/temp/integration-test-runs/20260816T062748Z-dsh-composition-e2e/`，不能替代 Harness profile evidence。
- Harness composition-preview typecheck/test 的失败已分类为 pre-existing/concurrent dependency/API mismatch（缺少 `standingFactsFor`、`tools.sources`、`sectionSources`、`attributions` 等已冻结 additive read seam），不得通过私有字段或本地事实副本绕过。
- 2026-08-19 更新：Pane profile evidence 刷新至 `temp/integration-test-runs/2026-08-19T07-01-59-861Z-396072-pane-profile/`；Ordo unified bundle focused tests 31/31、typecheck/build 全绿。browser Playwright 与 unified Ordo+composition clean-profile 仍为外部/环境 blocker。
