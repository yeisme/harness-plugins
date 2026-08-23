# harness-plugins Agent Instructions

## Product Mission

Yeisme 自研 DeepSeek Harness（DSH）插件聚合仓库。它把 Ordo Agent Ops 的 host/client 插件、/ordo 命令、组合预览投影等能力，打包成可通过 `dsh plugin add` 安装的 bundle 层，并作为独立 Git 仓库发布 `@yeisme/dsh-*` 包。

Ordo 是 run/task/session/lease/approval/verification/evidence/closeout 的唯一 owner；本仓库只做 DSH 侧的安全只读投影、命令入口、UI 面板与组合摘要，不造第二个 scheduler、task ledger 或 terminal state。

## Technology

- TypeScript + pnpm workspace，默认 ESM（"type": "module"）。
- 依赖 DeepSeek Harness 的已发布 surface（@deepseek-ai/dsh-*、@deepseek-ai/cordis），不 vendoring、不改写 DSH core。
- 运行时 bundling 使用 tsdown；类型由 tsc 输出到 lib/types。

## Architecture Boundaries

- packages/host/*：Host 插件 —— 类型化服务/transport、事件订阅、命令、dispose。
- packages/client/*：Client 插件 —— dsh.client bundle、受审查 slot、可访问 UI。
- packages/preset/*：组合/预设投影与只读摘要。
- packages/bundle/*：可安装的 dsh --profile patch 层（声明 dsh.bundle.patch）。通常只引用本仓库插件行；自包含的轻量安装器/预设数据（如 `anchored-standard`）可作为例外放在 bundle 内。
- Host 边界只向浏览器传 safe projection：opaque ref、有界摘要、版本、freshness、evidence ref、server-authored action；不传 cookie/token/raw URL/文件路径/任意 fetch。

## Prohibited Actions

- 不新增 DSH core fork、浏览器侧 domain store、任意 iframe bridge。
- 不创建 scheduler、task ledger、writer lease、approval ledger、capacity reservation 或 terminal result。
- 不把真实凭据、raw prompt、provider payload、private tool arguments、绝对路径写进源码、patch、fixture、日志或证据。
- unknown/partial/cancel_unknown/stale cursor 只禁用 mutation 并要求 owner reconcile，绝不自动 retry 或替换 writer。
- 不手写带 schema/state/audit 语义的 JSON/YAML/JSONL/Markdown metadata（用 openspec CLI 或应用服务生成）。
- 不把官方 DSH 合入、官方 `dsh web`、真实 profile Playwright 或 host 几何实现写成插件完成条件。详见 `docs/plugin-host-protocol.md`。
- 新 OpenSpec capability 只写 `ADDED`。目标主 spec 不存在时禁止 `MODIFIED`。

## Validation

插件完成门是本仓库协议对接，不依赖官方 DSH 已实现 seam、不启动官方 `dsh web`、不把官方合入当验收。

    pnpm install
    pnpm run typecheck
    pnpm run test
    pnpm run build
    pnpm run check:bundles
    openspec validate <change-id> --strict --no-interactive
    git diff --cached --check

包测试只验 typed probe、bundle 合同、ModuleLoader 面与诚实降级。官方 `dsh plugin add` / Web boot 是可选 host 集成，MUST NOT 阻塞插件完成。集成证据写入本仓库 temp/integration-test-runs/<run-id>/，脱敏 secret、raw prompt、provider payload、private tool arguments、绝对路径与完整思维链。

## Upstream Seam Channel（fork 退役后唯一 core 通道）

2026-08-20 起 monorepo 不再维护 `client/deepseek-harness` 源码 fork：

- 需要 DSH core 改动的 seam 一律固化为 `upstream-prs/<slug>/`（changes.patch + new-files/ + apply.sh + README，必要时 head.bundle），在 staging worktree 内开发与验证，推 `yeisme/deepseek-harness` 的 `pr/<slug>`。不向 `deepseek-ai/deepseek-harness` 开官方 PR，也不在 fork `master` 上开审查 PR；发布版未合入前插件继续 probe。
- 插件侧先 capability probe：seam 未合入时不渲染入口（禁用+原因），杜绝死按钮。
- 上游跟进自动化：`.github/workflows/upstream-canary.yml`（每日，发布版安装冒烟 + overrides 顶最新跑 gates；绿→bump PR，红→canary issue）与 `pr-rebase.yml`（每日 apply-check 各系列）。本地同路径：`scripts/upstream-canary.sh {resolve|install-smoke|overrides-test}`。人只在红灯 issue 时介入。

## Skill Triggers

- 本项目 active skills 由根目录 `.skills/profiles/targets/agent/harness-plugins.txt` 声明，并由 `scripts/skills.sh sync-target agent/harness-plugins` 生成到 `.agents/skills/` 与 `.claude/skills/`；不得再把 runtime 副本当作 skill 源码。
- 设计/实现/评审 Ordo Agent Ops 适配：使用 `dsh-ordo-agent-ops`。
- 创建/评审 DSH UI 插件：参考上游 deepseek-ai/deepseek-harness 的 dsh-plugin-experience skill（经 PR staging worktree 或上游仓读取）。
- 决定 owner 边界：遵循本仓库 openspec/changes/ordo-dsh-plugin-visualization-v1/。
- TypeScript、host transport、safe projection、CLI output、集成证据和稳定合同变更分别使用本 profile 中的 `yeisme-coding-execution-driver`、`backend-system-workflow`、`ai-native-cli-output-contract`、`project-integration-test-evidence` 与 `yeisme-evolutionary-change-policy`。
