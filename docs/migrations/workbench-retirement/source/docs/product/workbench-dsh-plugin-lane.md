# dsh 插件车道 PRD（workbench-dsh-plugin-lane-v1）

> 状态：proposal 阶段。OpenSpec owner：`openspec/changes/workbench-dsh-plugin-lane-v1/`（四件套随本 PRD 一并交付）。
> 上位权威：`docs/design/plugin-ecosystem.md`（插件生态红线）、`docs/product/agent-workbench-blueprint.md`（§6 Pane 产品模型、§11 安全与隐私）、`openspec/changes/workbench-harness-studio-v1/`（Harness Studio 互补客户端分工与 DSH compact bridge 先例）。

## 1. 问题陈述与目标用户

dsh（deepseek harness）是外部 agent 工具/生态，与 Workbench 是互补客户端关系：dsh 侧做紧凑 agent 会话与插件执行体验，Workbench 做全尺寸运营/审阅工作区。当前两边只有一条已冻结的 handoff 合同（`HarnessDshDeepLink`，`workbench.harness.dsh_bridge.v1alpha1`），而 Workbench 侧的"插件入口"仍有多处裸实现：

- composer slash 命令目录硬编码在前端（`apps/web/src/workbench/agent/conversation/composer.tsx:260-264` 四项命令），无 server-authored 合同，新增/下架命令必须发版前端。
- dsh 侧插件能力（渲染、Director Pack）由外部仓 `agent/harness-plugins` 演进，Workbench 缺少一份"哪些车道可用、哪些车道关闭、解锁条件是什么"的准入真源，任何"接入 dsh 插件"的请求目前只能靠口头回答。

目标用户：Workbench 用户（需要在会话中安全地发起/跳转 dsh 工作流）、dsh 生态作者（需要明确的 Workbench 侧消费合同）、Workbench 维护者（需要可审查的车道准入与 fail-closed 判定依据）。

## 2. 准入判定（owner-fit）

| 判定对象 | 结论 | 理由 |
| --- | --- | --- |
| L0 深链/handoff 合同的 Workbench 侧消费与证据要求 | **fit** | 跨项目导航、安全投影、owner receipt 属 Workbench 天然范围；合同已冻结，本仓只需 spec 化消费语义。 |
| L1 server-authored declarative surface descriptor + slash 命令目录合同 | **fit** | 服务端投影驱动 UI、UI 只派生不授予，是蓝图 §7 与接口合同 §10 的既有模型；本仓交付合同与校验器规格。 |
| dsh 侧渲染与 Director Pack | **split-owner** → owner 为外部仓 `agent/harness-plugins` | 领域规则、执行与渲染真相留在 dsh owner 生态；Workbench 不复制其状态机，只消费 typed handoff。 |
| L2 embedded iframe 车道 | **reject-now（本期）** | `docs/design/plugin-ecosystem.md` §7.2 的六前提（签名发布、content-addressed artifact、digest-pinned allowlist、default-deny 执行面、kill switch、供应链审计）未交付；在全部满足前一律 `needs_contract`。 |

总体结论：**split-owner**。Workbench 交付合同、准入判定与 handoff 证据要求；`agent/harness-plugins` 交付 dsh 侧渲染与 Director Pack。任何请求若在六前提齐备前要求"在 Workbench 内嵌 dsh iframe"，答案直接是 `needs_contract`，不等待 spec 完成后再裁掉。

## 3. Required Capability Ledger

| # | 能力 | 状态 | canonical owner | visible host | 交付切片 | 验收证据 |
| --- | --- | --- | --- | --- | --- | --- |
| C1 | L0：`HarnessDshDeepLink` 深链/handoff 消费语义（closed 字段、目标端 server 重新验证授权、非法合同 fail closed） | committed（合同已冻结于 `packages/task-sdk/src/harness/types.ts:292`，本期 spec 化） | Workbench（本仓） | Workbench Web / dsh Web | deliver-now（仅 spec 与既有测试锚定，无新代码） | 既有 vitest（`harness-asset-library`/`harness-contract-gates` 中的 DSH handoff 用例）+ 本 change spec |
| C2 | L1：server-authored slash 命令目录合同（`workbench.agent.slash_catalog.v1alpha1` 级别的版本化目录投影，UI 只投影不硬编码） | committed | Workbench（本仓） | composer | retain-next（本期只出合同 spec，不实现；composer.tsx 保持现状） | 本 change spec + 后续实现 change 的 parity/单测 |
| C3 | L1：declarative surface descriptor 通用准入规则（closed schema、forbidden field、availability 永远 `server`） | committed | Workbench（本仓） | pane/slot registry | retain-next（spec 化准入规则，复用 plugin-ecosystem.md §3/§7 语义） | 本 change spec；实现时复跑 `blocked_supply_chain`/`deep_link_denied` 回归 |
| C4 | L2：embedded iframe 车道 | rejected-with-user-decision（本期 reject-now，解锁条件见 §6） | 外部仓 `agent/harness-plugins` + Workbench 控制面签名发布 | Workbench Studio slot | not-requested（前提未交付） | 解锁时按 plugin-ecosystem.md §7.2 六前提逐项取证 |
| C5 | dsh 侧渲染与 Director Pack | split-owner（不属于本仓交付） | `agent/harness-plugins` | dsh Web | not-requested（本仓只规定 handoff 证据要求） | 跨仓 handoff 证据（contract digest/version、schema fixtures、隔离用例） |
| C6 | 运行时安装/更新/卸载 API、服务端下发可执行代码 | rejected-with-user-decision（永久不做，非排期问题） | — | — | non-goal | plugin-ecosystem.md §1.2 红线 |

范围 review 纪律：C1–C3 是用户明确要求的能力，review 可调整切片与顺序，但不得静默删除；C4 的移除是本期显式判定并写明解锁条件；C6 是红线不是 backlog。

## 4. Owner/consumer 边界与体验组合模型

- Workbench 只持有：合同定义、closed 校验器规格、availability 投影语义、handoff 证据要求。不持有 dsh payload、credential、私有路径、artifact blob。
- 浏览器只经 `WorkbenchClient` typed facade 消费；不得直连 dsh 服务、不得读取 session token。
- handoff 方向是双向互补：Workbench → dsh（深链打开紧凑会话/插件入口）与 dsh → Workbench（深链进入全尺寸 Studio）。两端都只携带 `HarnessDshDeepLink` 的 closed 安全字段；**目标端 server 必须重新验证授权**，sourceSurfaceId/handoffNonce 只是关联与审计线索，不构成授权事实。
- mutation 仍只经 TaskService gate；dsh 车道不引入第二条执行通道。

## 5. 三层车道设计

```text
L0 深链/handoff        L1 declarative descriptor     L2 embedded iframe
（本期 deliver-now）    （本期 spec-only, retain-next） （本期 reject-now）
HarnessDshDeepLink      server-authored slash 目录      sandboxed-iframe
workbench.harness.      + declarative surface           plugin-ecosystem.md
dsh_bridge.v1alpha1     descriptor 准入规则              §7.2 六前提交付后解锁
```

- **L0（deliver-now，spec 化既有冻结合同）**：`HarnessDshDeepLink` 只携带 `contractVersion/targetRef/sourceSurfaceId/resourceRef(+version)/mode/embedded 约束/handoffNonce`。非法合同 fail closed：不渲染目标、不提供打开动作。`mode: "embedded"` 在当前构建中只表示受限 layout-only 窗口约束元数据，不授权任何 iframe 加载。
- **L1（retain-next，本期只出合同）**：composer slash 命令从前端硬编码（composer.tsx:260-264 的 `insert-pane`/`prepare-context`/`refresh-context`/`stop-turn`）迁往 server-authored 版本化命令目录投影：每条命令携带稳定 id、i18n key、icon semantic、参数 schema、所需 capability 与 `ActionDescriptorV1` 风格的 availability；UI 只投影，目录缺失/未知版本一律诚实空态或 `needs_contract`，不回退硬编码清单。本期不改 composer.tsx。
- **L2（reject-now）**：embedded iframe 仅在 plugin-ecosystem.md §7.2 六前提（控制面签名发布、content-addressed artifact、digest-pinned 静态 allowlist、default-deny sandbox/CSP/bridge/egress、capability cohort kill switch、供应链审计与分层证据）**全部**交付并各自留证后才解锁；在此之前任何接入请求一律回答 `needs_contract`。

## 6. 用户工作流与状态转移

1. 用户在 Workbench 会话中触发 dsh 入口（深链或未来的 slash 命令）。
2. UI 解析 descriptor/handoff 合同：合法 → 按 `mode` 打开 dsh 侧目标或受控继续入口；非法/合同缺失 → `needs_contract` 诚实占位，不伪造入口。
3. 目标端（dsh server 或 Workbench server）收到 handoff 后**重新验证** tenant/workspace/principal 授权与资源版本；验证失败返回安全拒绝，不依据 handoff 字段授予任何能力。
4. mutation 结果未知 → `unknown_accept`，只允许原 attempt reconcile，禁止自动重试（沿用 `mayAutoRetryHarnessAction` 恒 false 先例）。

状态词汇复用蓝图 §10：`available|needs_contract|permission_required|offline|unsupported`、`stale|degraded|unknown_accept|reconcile_required`。

## 7. 数据与集成合同

- `HarnessDshDeepLink`（`workbench.harness.dsh_bridge.v1alpha1`）：本期不重解释、不扩字段；additive 演进须升合同版本。
- L1 命令目录合同（本期 spec 化命名与语义，实现另立 change）：closed schema，forbidden field 清单沿用 `FORBIDDEN_MANIFEST_FIELDS` 同原则（不得携带 URL/component/JS/credential 语义字段）；availability 永远 `server`，未知枚举值归一为 `needs_contract`。
- 跨仓 handoff：`agent/harness-plugins` 交付 dsh 侧渲染/Director Pack 时，必须提供 contract digest/version、schema fixtures、failure/tenant 隔离证据与 release compatibility；Workbench 只在 provider ready 与 consumer adoption evidence 同时存在时把 capability 显示为 `available`。

## 8. Trace、审计与测试证据要求

- handoff 与目录消费日志只保留 safe refs、digest、状态码与脱敏诊断；不得记录 credential、raw prompt、私有路径或 payload。
- 跨仓 handoff 证据按接口合同 §12 分层：contract → transport → browser → real owner canary → deployment。
- integration 运行写入 `temp/integration-test-runs/<run-id>/`（summary/command/stdout/stderr/env/artifacts，脱敏），保留失败证据与原始退出码。
- 触及第三方车道语义的变更必须复跑 `blocked_supply_chain`/`deep_link_denied` 回归用例。

## 9. 验收标准

- 本 PRD 记录 `split-owner` 判定与 required-capability ledger（§2/§3）。
- change `workbench-dsh-plugin-lane-v1` 四件套齐备且 `openspec validate workbench-dsh-plugin-lane-v1 --strict` 通过。
- spec 明确：L0 消费语义与目标端重新验证授权、L1 server-authored 命令目录合同（本期不实现，不改 composer.tsx）、L2 reject-now 与六前提解锁条件。
- 不新增运行时安装 API、服务端下发可执行代码或 fail-open 预留口；不修改任何既有代码与未提交改动。

## 10. 风险与开放决策

- [composer 硬编码与目录合同并存期漂移] → 迁移前 composer 保持现状并在 spec 中标注其为过渡实现；实现 change 落地时一次性切换并删除硬编码。
- [外部仓合同演进不同步] → handoff 证据要求写入 spec；合同 digest 不匹配时 capability 显示 `needs_contract`/`contract_mismatch`，不做版本猜测。
- [L2 解锁被误当排期承诺] → spec 与 PRD 明确 reject-now 是本期判定，解锁需六前提逐项取证，非"下期自动做"。

开放问题：L1 命令目录的运输形态（复用 session workspace 合同投影 vs 独立 Operation）与合同最终命名；dsh → Workbench 方向的深链目标集合（`allowedDeepLinkTargets` 先例如何映射）。

## 11. OpenSpec taskization

本 PRD 属正式交付（触及跨项目边界与稳定合同语义），已路由至根 `openspec/changes/workbench-dsh-plugin-lane-v1/`：proposal/design/tasks/specs 四件套随 PRD 一并交付；实现（L1 目录落地、composer 切换）另立后续 change，不在本 change 范围内。
