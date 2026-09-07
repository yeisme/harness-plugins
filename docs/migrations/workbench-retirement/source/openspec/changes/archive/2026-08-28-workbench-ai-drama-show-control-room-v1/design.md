## Context

Agent 对话适合发起意图、询问状态和局部修改，但整部剧会产生大量 Episode、Scene、Shot、Asset、Candidate、Run 和 Review 对象，需要可视化空间完成比较与异常处理。Workbench 已具备适合承载该产品面的 shell 和安全 consumer 基础。

## Owner Fit

| 能力 | 决策 | Canonical owner | Workbench 责任 |
| --- | --- | --- | --- |
| Show/Episode 导航 | split-owner | Auctra/既有 owner refs | layout、selection、safe summary |
| Series Bible | split-owner | Auctra | read-only projection、deep link |
| Visual assets | split-owner | Eikona | Asset Wall、compare、allowed actions |
| Audio/subtitle | split-owner | Sonora | safe preview、review、handoff |
| Runs/evidence | split-owner | Ordo/Aigora | timeline、cost/ETA、receipt/reconcile |
| Reference context | split-owner | Pinax | attach intent 与 lineage |
| Production/delivery | frozen-consumer | 既有 Scaena contract | projection/action consumer |
| Page layout、Review Inbox、study UX | fit | Workbench | complete owner |

## Data Flow

    Browser
      -> WorkbenchClient typed facade
      -> workbenchd / TaskService / Proposal authority
      -> allowlisted owner adapters
      -> safe projection + allowed action + receipt

浏览器不得直连 owner。Service 只保存 task metadata、attempt、event index、safe refs、study event 和 transport receipt；不得保存 owner payload 或 artifact bytes。

## Projection Model

ShowWorkspaceProjectionV1 至少包含：

- context：tenant/workspace/project/show/episode refs 与 revision。
- stages：setup、story、foundation、plan、generate、review、assemble、deliver。
- entities：bounded Episode/Scene/Shot/Asset/Review summaries。
- blockers：最多三个 primary blocker 与 owner-authored next action。
- readiness：available、needs_contract、permission_required、degraded、offline、contract_mismatch、reconcile_required。
- actions：owner、descriptor ref、target/version、risk/cost/rights、confirmation、expiry。
- receipts：status、owner receipt ref、redacted summary、next safe actions。

未知字段、超限 payload、raw URLs、paths、credentials、raw prompt 或 provider payload 使整份 owner segment fail closed。

## UI Composition

### Main layout

    Left: Shows / Episodes / Saved views
    Center: current Show Home, Episode Board or Asset Wall
    Right: Inspector / Review / Evidence
    Bottom: bounded Run timeline when explicitly opened

Panel state 使用现有 Pane reducer；不得创建第二 docking engine。Agent open intent 可以打开 Show Control Room 或定位具体 artifact。

### Review Inbox state machine

    new -> viewed -> decision_submitted -> accepted | rejected | repair_requested
                         -> unknown | partial -> reconcile_required

Workbench 只拥有 presentation state。最终 decision status 来自 owner receipt；unknown 或 partial 不自动重试。

### Create Show

向导字段：genre、audience、format/aspect、episode duration/range、language、visual direction、reference refs、budget posture。提交生成 proposal；owner 可能部分接受。Workbench 应把 partial acceptance 展示为 owner-by-owner readiness，而不是整剧成功。

## DSH Handoff

- Open in Workbench 接收 signed/validated context refs 和 presentation intent。
- Continue in DSH 只生成 profile/command/deep-link payload，不携带 session token 或 owner data。
- 两端都重新读取 owner projection。
- context revision 不一致时进入 reconcile_required。

## Responsive and Accessibility

- Desktop：完整 Show Control Room、多 Pane compare。
- Tablet：单主面板 + Review/Inspector sheet。
- Mobile：Show status、下一 review、receipt/reconcile、受控继续入口。
- 全端要求键盘等价、焦点恢复、live status、非颜色状态、reduced motion 和 bounded media。

## L0 切片：Create Show 三入口与 DSH handoff ingress

本切片是首个可独立验证的闭环入口，只覆盖入口解析与 fail-closed 呈现；Show workspace query composer、Create Show proposal 提交与 owner readiness 合成仍属 tasks 2.x/3.1 后续任务。

### Entry intent 模型

Create Show 有三个进入面，统一解析为 `ShowControlRoomEntryIntent`：

- `agent`：Agent 对话 intent（open intent / proposal 起点），可携带 `showRef` 定位既有 show。
- `project`：项目页入口，可携带 `showRef`。
- `dsh`：DSH Director Pack 的 Open-in-Workbench handoff，必须携带 `HarnessDshDeepLink` payload。

`showRef`、`episodeRef` 只允许 opaque ref；handoff payload 只接受 `workbench.harness.dsh_bridge.v1alpha1` 的 closed 字段（`contractVersion`、`targetRef`、`sourceSurfaceId`、`resourceRef`、`resourceVersion`、`mode`、`embedded`、`handoffNonce`）。未知字段、URL/scheme、credential/token/raw prompt/private path 字段名、非法 mode 或越界 embedded 约束一律 fail closed，返回 typed `contract_mismatch`，不做部分解析。

### Handoff 信任边界

- 浏览器侧 ingress 只做结构与安全校验；handoff 携带的 `resourceRef`/`resourceVersion` 是**不可信提示**，目标端 server 必须重新读取 owner projection 并按 context revision gate 复检后才允许定位 show/episode。
- handoff 不携带 session token、owner payload 或 artifact bytes；`handoffNonce` 只用于一次性关联，不构成授权。
- revision 漂移或 server 无法重验时进入 `reconcile_required`，不由浏览器推断成功。

### Fail-closed 呈现

在 Create Show proposal Operation 注册进统一 registry（task 1.4/2.2）之前，三个入口一律渲染 `needs_contract`：展示入口来源与已验证的 safe refs，禁用向导提交，不出现无功能控件或伪造的创建按钮。DSH 侧渲染与 Director Pack 本身由 agent/harness-plugins 的 dsh owner 生态实现，本仓不伪造。

## Evidence and Tests

### Unit/contract

- strict projection/action/receipt codecs。
- owner mismatch、context drift、unknown field、size limit、redaction。
- score event 不含内容正文或敏感字段。

### Component

- Show Home 三 blocker 上限。
- Episode Board stale/needs_contract。
- Asset Wall rights/lineage/accepted state。
- Review Inbox accept/reject/repair/unknown/reconcile。
- mobile/keyboard/accessibility。

### Integration/E2E

- Create Show proposal -> partial owner readiness。
- DSH context -> Workbench open -> owner projection reload。
- review action -> unknown -> reconcile -> authoritative receipt。
- Episode 2 复用 Episode 1 accepted refs。

integration/component/e2e 入口必须写入 temp/integration-test-runs/<run-id>/ 六件套证据并脱敏。

## Migration

1. 先以 fixture 和 needs_contract 构建只读 Show Home/Review Inbox。
2. 接入 Auctra/Eikona safe projection。
3. 接入 Ordo/Aigora run evidence。
4. 接入 DSH handoff。
5. 逐个 owner 通过 provider ready + consumer done + integration evidence 后显示 available。
6. Scaena 只消费既有合同，不成为本 change 阻塞或新增实现 lane。
