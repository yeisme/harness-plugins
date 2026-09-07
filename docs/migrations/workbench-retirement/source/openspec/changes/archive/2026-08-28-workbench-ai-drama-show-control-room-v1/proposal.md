## Why

Workbench 已有 Agent-first shell、Pane、Task/Proposal authority 和 owner typed consumer，但做剧用户仍需要一个以 Show、Episode、Asset、Review、Run/Evidence 和 Delivery 为核心的完整视觉控制室。现有通用 Harness/Owner 页面更适合展示能力与运行状态，不能替代连续做多集、比较候选、处理例外和复用资产的产品路径。

本 change 把做剧产品化缺口留在正确 owner：Workbench 负责视觉组合与安全动作；Auctra、Eikona、Sonora、Ordo、Aigora、Pinax 和既有 Scaena 合同继续拥有领域真相。它不要求 Scaena 新增功能。

## What Changes

- 新增 Show Control Room 薄专业工作区，支持 Show Home、Series Bible、Episode Board、Asset Wall、Review Inbox、Run/Evidence、Delivery 和 Next Episode reuse。
- 新增 Create Show proposal 向导，只收集创作者输入并向 owner 提交 typed proposal，不直接写领域状态。
- 新增 exception-first Review Inbox，将 candidate conflict、rights/cost gate、stale、unknown 和 repair proposal 聚合为待决定项。
- 新增跨 owner safe projection facade：统一 owner、ref/version、freshness、readiness、allowed actions、receipt 与 deep link，禁止 canonical payload。
- 新增 DSH Director Pack handoff：可从 DSH 打开同一 show/episode context，也可从 Workbench 生成受限继续入口。
- 新增 evidence-only 产品研究导出，记录任务时长、阻塞、review 结果和跨集复用，不记录 raw prompt、provider payload 或内容正文。
- 不新增 Scaena 页面、状态机、生产能力或 owning change；已有合同缺失时 fail closed。

## Capabilities

### New Capabilities

- workbench-ai-drama-show-navigation: Create Show、Show Home、Series Bible、Episode Board 与 Next Episode 导航合同。
- workbench-ai-drama-review-inbox: 异常优先 review、compare、accept/reject/repair proposal 与 receipt 合同。
- workbench-ai-drama-owner-projection: 多 owner safe projection、readiness、allowed actions、deep link 和 fail-closed consumer。
- workbench-ai-drama-experience-evidence: 脱敏产品研究事件、两集观察任务和评分 evidence export。

### Modified Capabilities

无。该工作区复用 Agent-first shell、Task/Proposal authority、Pane composition 和 owner backend integration，不修改其既有语义。

## Impact

- UI：apps/web 中新增注册 Show Control Room Pane/route 和可复用的 Show/Episode/Review 组件。
- SDK/合同：packages/task-sdk 与 api/schema/proto 中新增安全 Show workspace projection/action 模型。
- Service：service/internal 中新增 owner composition/readiness adapter 与 product-study evidence projection；所有 mutation 继续进入 TaskService/Proposal authority。
- 文档：docs/product/ai-drama-show-control-room.md。
- DSH handoff 依赖 agent/harness-plugins/openspec/changes/dsh-ai-drama-director-pack-v1/。

## Non-Goals

- 不持久化剧本、图片、音频、视频、Prompt、provider payload 或 owner 私有对象。
- 不创建新的跨 owner production scheduler。
- 不复制 Scaena Candidate Wall、Production Canvas、production acceptance 或 delivery 状态机。
- 不把手机端发展成复杂专业编辑器。
- 不在本 change 中启用真实 provider、生产部署或外部发布。
