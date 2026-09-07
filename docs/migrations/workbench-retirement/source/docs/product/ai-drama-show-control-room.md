# AI 做剧 Show Control Room

> 状态：已退役的历史产品设计。独立 Web 路由和页面编排已由 `/agent` 内的 Unified Spatial Creative Runtime 取代；本文仅保留旧合同与迁移背景，不再作为当前 UI、响应式或入口设计依据。当前真源见 [Workbench Unified Spatial Creative Runtime V1](unified-spatial-creative-runtime.md)。

## 产品定义

Show Control Room 是 Workbench 内的薄专业做剧工作区。它解决“能力分散但用户看不清整部剧”的问题：在一个可视入口中展示 Show、Episode、Scene、Asset、Review、Run、Evidence 和 Delivery 的关系。

它不是新的做剧引擎。剧本、角色设定、视觉资产、声音、运行、成本和生产状态仍由各 owner 持有；Workbench 只保存 task metadata、safe refs、presentation state、user preferences 和 owner receipts。

## 核心用户

- 个人 AI 漫剧创作者：需要快速创建一部剧，持续完成多集并复用资产。
- 2–8 人小团队：需要共享阶段、候选、审查、运行和交付事实。
- 导演/制片角色：需要只处理例外，知道谁在做什么、为什么阻塞和怎样恢复。

## 首个可用路径

1. 用户从 Agent 对话、项目页或 DSH Director Pack 进入 Create Show。
2. 向导收集题材、受众、画幅、时长、语言、视觉方向、参考和预算姿态。
3. Workbench 创建 proposal 与 task，不直接写领域状态。
4. Auctra/Eikona/其他 owner 返回安全 refs、readiness 和下一动作。
5. Show Home 展示阶段、阻塞、待审项目和可复用资产。
6. 用户在 Review Inbox 比较候选、接受、拒绝或请求修复。
7. Run/Evidence 展示 Ordo/Aigora attempt、cost、ETA、receipt 和 reconcile。
8. Delivery 展示 owner-authored readiness、导出或外部编辑 handoff。
9. Next Episode 总结已接受的设定、资产、声音和规则，作为下一集输入。

## 面板体系

### Show Home

- 当前 Show 与 Episode。
- 8 阶段进度：setup、story、foundation、plan、generate、review、assemble、deliver。
- 最多三个 primary blockers。
- 下一项人工决定。
- 最近接受的资产与下一集复用入口。

### Series Bible

- Auctra 提供的 accepted world、character、relationship、tone 和 episode refs。
- Eikona/Sonora 的视觉与声音 binding refs。
- 只显示 safe summary、version、freshness 和 owner deep link。
- Workbench 不允许直接修改 canonical Bible。

### Episode Board

- Episode -> Scene -> Shot 的可折叠关系。
- 每项展示 owner、status、freshness、blocker、run/receipt refs。
- 允许 open、compare、review、repair proposal 和 handoff。
- 未验证 production fact 不拼接成成功状态。

### Asset Wall

- 角色、场景、道具、风格、声音、字幕和交付资产。
- 显示 rights、lineage、accepted/candidate、binding、reuse count 和 stale reason。
- 对大媒体使用 owner grant proxy、lazy load 和 bounded lists。

### Review Inbox

- 只显示需要人决定的异常、冲突、rights/cost gate、stale 和 unknown settlement。
- 每项必须给出候选差异、影响对象、风险、成本、可逆性和 owner receipt。
- 接受、拒绝和 repair 都是 typed action；未知结果禁止自动重试。

### Run & Evidence

- Ordo DAG、attempt、lease、approval、verification、failure class。
- Aigora provider job、成本预估、实际成本、ETA、cancel/reconcile。
- 所有证据只显示 redacted summary 与 evidence ref。

### Delivery

- owner-authored delivery readiness。
- 输出包、字幕、音轨、NLE handoff 和回滚说明。
- Workbench 不根据文件存在或 HTTP 2xx 推断已交付。

## 历史导航说明

旧独立 Control Room 与其手机/平板 Web 设计已经删除，不再作为当前验收范围。当前桌面交互统一进入 `/agent` 的 Creative Production、Run、Review 与 Evidence Lens；未来移动应用由独立客户端承接。

## Scaena 边界

本工作区不新增 Scaena 产品功能。若已有 Scaena production projection 可用，Workbench 将它作为一个 owner 卡片或阶段投影消费；若不可用则显示 needs_contract。首个纵切优先验证 Show 创建、剧本/视觉候选、Review Inbox 和运行证据，不把完整视频装配设为 UI 产品化的前置条件。

## 成功指标

| 指标 | V1 目标 |
| --- | --- |
| Create Show 到首个可审候选 | 目标用户中位数不超过 15 分钟；provider 慢任务单独记录 |
| 状态定位 | 80% 用户在 30 秒内指出当前阶段、primary blocker 和下一动作 |
| Review 完成 | 90% review 项有明确 accept/reject/repair/owner handoff 结果 |
| 跨集复用 | 第二集至少复用一个 accepted character/style/voice/rule ref |
| 恢复 | stale/unknown/partial/context switch 不产生重复 mutation |
| 真实证据 | 至少 5 位设计伙伴完成两集观察测试 |

## Owning OpenSpec

[workbench-ai-drama-show-control-room-v1](../../openspec/changes/archive/2026-08-28-workbench-ai-drama-show-control-room-v1/)
