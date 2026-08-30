## Why

`short-drama-radar` 已冻结个人 Profile/Feedback/Opportunity/Edition 与三 lane MCP 合同（M1–M3 全绿，`radar.mcp.handoff.v1` fixtures 已发布）。根 change `personalized-short-drama-radar-experience-v1` 指定 Harness Plugins 复用现有 Director Pack/Pane platform 提供 Drama Radar badge、`/drama radar` 命令与按需 Pane，让用户在“正在和 Agent 做事”的上下文里看到“今天最适合我做什么”，而不创建第二套 plugin 平台或接管 Radar canonical state。

## What Changes

- 新增 `dsh-personal-radar` 包边界（host adapter + client UI + bundle 行，可并入现有 Director Pack bundle 行）：Context badge、`/drama radar` 命令族、按需 Drama Radar Pane。
- 新增 host adapter：固定启动 `radar mcp --transport stdio --lane <reader|curator|operator>`，命令解析只生成 typed intent，host 重新校验 capability、lane、scope、idempotency。
- 新增 capability probe：官方 Pane seam 缺失时禁用入口并显示 reason，不使用私有 DOM、iframe 或 fork fallback。
- 新增 badge 摘要（如 `Radar · 5 fits · 2 new · fresh 38m`）与 `/drama radar [open|save|dismiss|compare|proposal|workbench|refresh] <refs>` 命令族。
- 新增 list/detail/compare Pane：save/dismiss/proposal 经 Radar curator receipt 收敛，Workbench handoff 只携带安全 typed refs；`refresh` 只允许 `edition_build`。
- 新增 fake Radar provider、契约负例、reducer/lifecycle/a11y/responsive 测试与标准 integration evidence。

## Admission Decision

`split-owner`。

| Owner | 本 change 内职责 | 本 change 外职责 |
| --- | --- | --- |
| Harness Plugins | badge、命令、Pane UI、typed intent、safe projection、capability probe、bundle/probe、plugin evidence | 不拥有 Profile、反馈 ledger、机会簇、Edition 或运行状态 |
| short-drama-radar | Profile/Feedback/Opportunity/Edition 真源、curator/operator receipt、audit | 已在 `personalized-radar-agent-experience-v1` 冻结 |
| DSH Core | 公开 plugin/client slots 与 Pane registry | 不为本 change 增加私有 DOM 或 iframe seam |
| Workbench | Personal Radar Lens 与 proposal control plane | 消费同一 Radar refs，见 `client/yeisme-workbench/openspec/changes/personal-radar-lens-v1` |

## Capabilities

### New Capabilities

- `dsh-personal-radar-pane`: DSH Drama Radar badge、命令族、按需 Pane、typed intent、capability probe 与诚实降级。

### Modified Capabilities

无。Director Pack、Pane registry 与 command 平台合同不变。

## Impact

- `packages/host/dsh-personal-radar/`（或并入 `dsh-ai-drama-director` host 行）：Radar adapter、capability probe、typed intent 校验、receipt reconcile。
- `packages/client/ui-personal-radar/`（或并入 `ui-ai-drama-director`）：badge、Pane UI 与 keyboard/aria 实现。
- `packages/bundle/dsh-ai-drama-director/`：新增可安装 bundle 行与 bundle 合同校验。
- 上游合同：`cli/short-drama-radar` `radar.mcp.handoff.v1`；Workbench 深链消费 `PersonalRadarOpportunityHandoffV1` refs。
- 不包含远程 Radar、多用户、实时推送、collect/daily_run 触发或 production mutation。
