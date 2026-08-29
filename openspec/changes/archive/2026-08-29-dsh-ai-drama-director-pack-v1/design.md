## Context

做剧工作有两个尺度：会话内按阶段完成当前项目生产，以及整部剧的专业批量/全局管理。DSH Pane 支持前者的端到端流程，Workbench 擅长后者。Director Pack 必须保持薄，避免复刻 Workbench 的密集管理页面，也避免竞争状态和导航所有权。

## Dependencies

- 已归档并晋升主规格的 creator-studio-host-projection、creator-studio-pane-experience、creator-studio-artifact-composition。
- Pane Workbench 的 view/command/intent registry 与生命周期。
- Rich Media 的安全 artifact renderer。
- Ordo Agent Ops 的 run/approval/verification/evidence safe projection。
- 根级 dsh-pane-plugin-ecosystem-v1 的 snapshot + event、freshness、gap recovery 与 no-polling 方向。

## Owner Fit

| 能力 | 决策 | Owner |
| --- | --- | --- |
| /drama command、Pane preset、capability probe | fit | Harness Plugins |
| Show/episode/scene/shot refs | split-owner | Auctra/既有 domain owner |
| visual/audio assets | split-owner | Eikona/Sonora |
| run/cost/evidence | split-owner | Ordo/Aigora |
| production/delivery | frozen-consumer | 既有 Scaena contract |
| whole-show navigation and bulk review | split-owner | Workbench |

## Package Design

### Host

ai-drama-director Host 提供：

- current context resolution 与 revision validation。
- command descriptors 与 typed handlers。
- creator-studio projection 的 bounded selector。
- action descriptor revalidation 和 one-shot dispatch。
- Workbench handoff signer/validator。
- event subscription teardown 与 gap/reconcile。

它不得直接调用 provider、拼接 shell、读取私有文件或创建第二 owner directory。

### Client

Client 原子注册：

- 一个 Drama command group。
- Context、Story、Visual、Audio、Run、Review 六个 view descriptor。
- open、compare、review、repair、handoff intents。
- 一个默认 Director preset。

注册必须 effect-scoped、可 dispose、HMR-safe。卸载后不得残留命令、listener、subscription 或布局节点。

### Bundle

Bundle 只添加自身 profile line 和 preset。它不隐式安装 Pane Workbench、Creator Studio、Rich Media、Ordo 或 Workbench。capability probe 失败时保留 disabled entry 和可操作说明。

结构化 manifest、profile patch 和 compatibility metadata 由 bundle 的 repository application service 生成；build 先运行 drift check，不允许独立手写 machine metadata。兼容 ledger 同时固定 DSH range、贡献 key、V1/V2 合同状态、digest 和 profile conformance 命令。

## Command Contract

DramaCommandRequestV1 包含 command、selector、contextRevision、optional user-visible fields 和 presentation intent。它不得携带任意 argv、shell text、raw prompt、provider payload、credential 或 absolute path。

命令处理规则：

1. 解析稳定 selector。
2. 读取 current context snapshot。
3. 检查 capability/readiness。
4. 对 mutation 重新读取 server-authored descriptor。
5. 返回 opened、proposal_created、submitted、unknown、reconcile_required 或 needs_contract。
6. unknown 不自动 retry。

## Pane Preset

默认最多三个 visible panes：

- Context：current refs、readiness、primary blocker、next action。
- Review：下一项异常、compare 与 owner decision。
- Run：Ordo/Aigora attempt、cost/ETA、receipt/reconcile。

Story/Visual/Audio 通过 command、Creator Home 或 artifact intent 按需打开。当前项目的故事、视觉、音频、生成、审阅和 owner 导出动作可继续留在 Pane；若用户需要完整 Episode Board、专业 Asset Wall、跨集比较或批量 Review Inbox，则提供可选 Open in Workbench。

## Event Model

Director Pack 只消费 snapshot + push event。首次打开、context switch、cursor expiry 或 gap 时读取 snapshot；之后消费 event。没有 stream capability 时显示 needs_contract/offline，不以 setInterval 或隐藏 refetch 交付 first-support。

contextRevision、installation、plugin release、owner version 或 contract digest 变化时：

1. 暂停 mutation。
2. teardown 旧 listener。
3. 清空 presentation cache。
4. 读取新 snapshot。
5. 由用户重新确认过期 action。

## Workbench Handoff

Handoff payload 只包含：

- DramaContextV1 refs/version/revision。
- target surface id。
- presentation intent：open_show、open_episode、open_review、open_artifact、open_evidence。
- optional artifact/receipt refs。
- expiry 与 nonce。

Workbench 必须重新读取 owner data。DSH 不传 session token、domain payload、private URL 或 cached facts。

## Product Evidence

记录：

- pack installed/disabled reason。
- /drama help/open/review/evidence/handoff 的成功或失败类别。
- context recover duration。
- review action settlement 类别。
- Workbench handoff opened/expired/contract mismatch。

不记录命令自由文本、剧本正文、Prompt、provider payload、媒体内容或 private refs。evidence 只用于产品评分与诊断，不作为 owner truth。

## Tests

### Unit

- command parsing、selector ambiguity、context drift、descriptor expiry、redaction。
- event duplicate/gap/reset、teardown、HMR/dispose。
- handoff nonce/expiry/surface/context validation。

### Component

- enabled/disabled entries、missing dependencies、keyboard/focus、responsive。
- Context/Review/Run preset 与 secondary pane open。
- unknown/partial/reconcile/no-auto-retry。

### Integration

- /drama open -> snapshot -> event。
- /drama review -> one-shot owner action -> unknown -> reconcile。
- /drama handoff -> Workbench re-fetch same refs。
- install/uninstall/reinstall profile idempotency。

官方 DSH 尚未实现的 seam 只通过 probe 和 contract test 验证，不作为插件完成阻塞。

## Migration

1. 发布 Host command/context contract 和 disabled-only bundle canary。
2. 接入现有 Creator Studio safe projection 与 Pane registry。
3. 实现 Context/Review/Run 三 Pane first slice。
4. 接入 Workbench handoff。
5. 增加 Story/Visual/Audio secondary panes。
6. 通过真实 DSH release canary 后再提升兼容状态；Scaena 无新增 lane。
