# harness-plugins Agent Instructions

## Product Mission

2026-09-07 用户决定退役独立 `client/yeisme-workbench` 及远程仓库，主要交互由本仓 DSH Pane 承接。画布/连续性见 `openspec/changes/dsh-project-canvas-continuity-v1/`，成果/引用复用 `dsh-prompt-reference-creative-workspace-v1`；历史提取材料在 `docs/migrations/workbench-retirement/`，不是 active spec 或完成证据。允许 host 通过已批准的 storage seam 保存项目布局/Draft/安全引用；不持有领域正文、版本、调度或审批真相，不引入 Workbench BFF/TaskService 或第二主壳。旧 Workbench launch 目标退役；保留 DSH 自身 workbench/Panes/预览命名和功能。

Yeisme 自研 DeepSeek Harness（DSH）插件聚合仓库。它把 Ordo Agent Ops 的 host/client 插件、/ordo 命令、组合预览投影等能力，打包成可通过 `dsh plugin add` 安装的 bundle 层，并作为独立 Git 仓库发布 `@yeisme/dsh-*` 包。

Ordo 是 run/task/session/lease/approval/verification/evidence/closeout 的唯一 owner；本仓库只做 DSH 侧的安全只读投影、命令入口、UI 面板与组合摘要，不造第二个 scheduler、task ledger 或 terminal state。

## Technology

DSH 开发预览默认运行 `pnpm dsh:workbench -- --no-open --port 40869`，热开发运行 `pnpm dsh:dev`；先用 `pnpm dsh:workbench -- --check` 验证同代 CLI、renderer、侧栏和 conversation。不得用全局旧版 CLI 混载新版 pane。全局 `dsh` 只有在解析到同一验证构建时才能直接使用。清理、恢复与验证见 [docs/runtime/dsh-workbench.md](docs/runtime/dsh-workbench.md)。

- TypeScript + pnpm workspace，默认 ESM（"type": "module"）。
- 依赖 DeepSeek Harness 的已发布 surface（@deepseek-ai/dsh-*、@deepseek-ai/cordis），不 vendoring、不改写 DSH core。
- 运行时 bundling 使用 tsdown；类型由 tsc 输出到 lib/types。

## Architecture Boundaries

- packages/host/*：Host 插件 —— 类型化服务/transport、事件订阅、命令、dispose。
- packages/client/*：Client 插件 —— dsh.client bundle、受审查 slot、可访问 UI。
- packages/preset/*：组合/预设投影与只读摘要。
- packages/bundle/*：可安装的 dsh --profile patch 层（声明 dsh.bundle.patch）。通常只引用本仓库插件行；自包含的轻量安装器/预设数据（如 `anchored-standard`）可作为例外放在 bundle 内。
- packages/sdk/*：插件 SDK —— 类型定义、schema 校验、验证 helpers。不拥有 DSH/domain state，面向第三方插件作者提供稳定 API。
- packages/tool/*：一致性工具 —— 声明验证、安全审计、集成测试运行器。只读 inspect 被测包，不修改 source。
- packages/catalog/*：插件目录 —— 静态 catalog 入口、构建/查询工具。不建网络服务或遥测。
- packages/example/*：示例插件 —— 参考实现、演示用法。不接管 core state。
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
- 新增、修改或评审任何 React/Web UI 前，必须先读取 `docs/design/dsh-unified-panel-visual-system.md`。完整 surface 使用 `ui-surface`，嵌入 renderer 使用 `ui-visual-kit` token；所属 `design.md` 必须填写该文档 §12 的 UI Contract，并运行 `pnpm run check:surfaces`、`pnpm run test:visual` 与 `pnpm run check:plugins`。
- 设计/实现/评审 Ordo Agent Ops 适配：使用 `dsh-ordo-agent-ops`。
- 创建/评审 DSH UI 插件：参考上游 deepseek-ai/deepseek-harness 的 dsh-plugin-experience skill（经 PR staging worktree 或上游仓读取）。
- 用户明确要求质询、挑战、压力测试或逐问时：DSH 插件相关主题（tab/pane/overlay/preset/投影/seam/change 设计）使用 `dsh-plugin-grill-me`，与 `grill-me` 协议成对激活；其它主题使用 `grill-me`。访谈只收敛决策，不写文件、不创建 OpenSpec change、不启动实现；用法见 [docs/cookbook/dsh-plugin-grill-me.md](docs/cookbook/dsh-plugin-grill-me.md)。
- 决定 owner 边界：遵循本仓库 openspec/changes/ordo-dsh-plugin-visualization-v1/。
- TypeScript、host transport、safe projection、CLI output、集成证据和稳定合同变更分别使用本 profile 中的 `yeisme-coding-execution-driver`、`backend-system-workflow`、`ai-native-cli-output-contract`、`project-integration-test-evidence` 与 `yeisme-evolutionary-change-policy`。
- 设计/实现 3D 导演台、glTF/GLB 能力矩阵、Shot 场景编排或画布/视口联动：使用 `dsh-3d-director-gltf-workbench`，并遵循 `openspec/changes/dsh-3d-director-gltf-workbench-v1/`。
