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

## Validation

    pnpm install
    pnpm run typecheck
    pnpm run test
    pnpm run build
    openspec validate <change-id> --strict --no-interactive
    git diff --cached --check

集成/组件/系统/e2e 测试证据写入本仓库 temp/integration-test-runs/<run-id>/，脱敏 secret、raw prompt、provider payload、private tool arguments、绝对路径与完整思维链。

## Skill Triggers

- 设计/实现/评审 Ordo Agent Ops 适配：读取 .agents/skills/dsh-ordo-agent-ops/SKILL.md。
- 创建/评审 DSH UI 插件：参考 fork client/deepseek-harness 的 dsh-plugin-experience skill。
- 决定 owner 边界：遵循本仓库 openspec/changes/ordo-dsh-plugin-visualization-v1/。

