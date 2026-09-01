# dsh-plugin-dev-toolchain-v1

插件开发工具链地基：`pnpm check:plugins` 五检查器（bundle-contract / declaration-lint / safe-projection-audit / dispose-hmr-conformance / visual-token-conformance）+ `packages/sdk/dsh-plugin-contracts` 内部类型契约。对应 roadmap G18。

**状态（2026-09-01）**：§1–§6 已实现（16/19，evidence 见 tasks.md）；R8 硬门达成判读（V3 本地已尽、剩项全外部停车）见设计文档 §6.4。首跑基线报告 `temp/toolchain-runs/2026-09-01T014345901Z-toolchain/`：合计 50 红灯（declaration-lint 2 / safe-projection 12 / dispose 36），bundle-contract 与 visual-token 首跑即绿；清零归 `dsh-plugin-consistency-coverage-v1`（G21）。
