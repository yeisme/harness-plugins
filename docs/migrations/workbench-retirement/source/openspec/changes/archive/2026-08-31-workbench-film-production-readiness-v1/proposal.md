## Why

Workbench 已有 AI Drama Director Canvas 与 owner integration 基础，但当前画布主要围绕镜头/资产审阅，尚不能把 production intent、scene closure、audio、budget、autorun、continuity 和 final return 组合成一条小团队可理解的电影完成路径。若客户端自行推断这些状态，就会形成第二套生产状态机。

## What Changes

- 新增 additive `workbench.film_project_index.v1`，只索引 owner refs、revisions/digests、freshness、scene readiness、actor roles、pending decisions 和 receipts。
- 在现有 `/agent` spatial runtime 中增加 Film Production Readiness 组合视图；不恢复独立旧 Show Control Room，不新增完整 NLE。
- 支持四个 profile、项目 milestone、scene dependency closure、prototype/production lane、budget buckets、audio readiness、continuity 和 final master return 的 safe projection。
- 统一 owner decision box：canonical accept、rights/waiver、budget change、external apply 与 final delivery 都使用 owner-authored action/receipt。
- 支持本地 actor id/role、working/sealed package 摘要和 external editor handoff 深链。
- 所有 mutation 继续进入 WorkbenchClient/TaskService/owner adapter；浏览器不直连 owner。

## Capabilities

### New Capabilities

- `film-production-readiness`: 联邦电影项目索引、场景就绪矩阵、跨 owner 决策与交付回流投影。

### Modified Capabilities

无。现有 agent spatial runtime、director canvas、bridge consumer 和 TaskService 保持兼容。

## Impact

- 预期实现：Proto/JSON contracts、Go service composition/adapters、Task SDK、React lens/panes、tests/evidence 和文档。
- Owner APIs：Auctra、Scaena、Eikona、Sonora、Ordo、Aigora typed projections/actions。
- 根级依赖：`openspec/changes/ai-film-federated-production-workbench-v1/`。
