# DSH × Workbench AI 做剧 Bridge V2：CEO 产品与架构方案

> 状态：提案；Owning OpenSpec：`dsh-workbench-ai-drama-bridge-v2`  
> 决策范围：DSH → Workbench 做剧上下文连续性、产品分工、跨仓合同与上线门  
> 不包含：Workbench owner state 重构、Ordo 调度/账本改造、旧合同立即删除

## 1. CEO 决策摘要

DSH 与 Workbench 不应继续按“两个都能做剧的产品”并行堆功能，而应成为一条创作生产漏斗的两个工作面：

- **DSH 是创作入口和协作前台**：承接对话、灵感、即时选择、下一步行动、轻量评审和异常提醒。
- **Workbench 是制作现场和复杂操作后台**：承接整剧/整集空间组织、多资产比较、批量处理、专业评审和证据复核。
- **Ordo 是执行与审计唯一账本**：拥有 run/task/session/lease/approval/verification/evidence/closeout；DSH 和 Workbench 都不复制它的状态机。

Bridge V2 的商业意义不是“多一个跳转按钮”，而是降低从创作意图到生产动作的上下文损耗。用户在 DSH 中形成意图，在 Workbench 中扩展复杂度，再回到 DSH 继续协作；资源身份、版本、权限和证据在过程中保持连续。

决策：先冻结和落地一条方向明确、可观测、可回滚的 DSH → Workbench V2 桥，再扩展更多做剧功能。桥未收敛前，不继续增加第三套入口或新的场景合同。

## 2. 当前问题不是功能少，而是系统断裂

当前链路有四个结构性问题：

1. **合同分裂**：DSH 使用 `drama.workbench-handoff.v1`，Workbench 使用 `workbench.harness.dsh_bridge.v1alpha1`，字段、nonce 和目标语义不一致。
2. **签发不等于激活**：DSH 可以生成 handoff，但 Client 主要停留在“已签发，请去 Workbench”的提示，没有可信 launcher 和消费回执。
3. **目标产品已迁移**：Workbench 入口已转向 `/agent` Unified Spatial Creative Runtime，旧 Show Control Room 叙事会继续制造错误产品预期。
4. **跨仓完成定义缺失**：DSH provider 和 Workbench consumer 可以分别单测通过，却没有同一 fixture 和端到端 rollout gate。

如果只补 UI 跳转，短期看起来“连上了”，长期会积累租户错配、版本覆盖、权限漂移、死按钮和双合同维护债务。

## 3. 产品 operating model

### 3.1 用户任务按复杂度分层

| 用户任务 | 默认工作面 | 原因 |
| --- | --- | --- |
| 询问下一步、选择剧集、查看 blocker | DSH | 对话内完成，切换成本最低 |
| 单项生成、轻量 repair、下一项评审 | DSH Pane | 上下文窄、动作由 owner descriptor 控制 |
| Episode timeline、跨场景/跨候选比较 | Workbench Creative Production | 需要空间布局和多对象同时可见 |
| 集中审片、差异对比、批量决策 | Workbench Review | 需要专业评审面与一致决策上下文 |
| receipt、verification、异常追踪 | DSH 快速查看或 Workbench Evidence | 轻查留在 DSH，深查进入证据 lens |
| run/task/lease/approval 终态 | Ordo | 唯一权威 owner，两个 UI 只投影 |

这套分工的核心原则是：**以认知负荷选择工作面，不以团队边界复制能力。**

### 3.2 目标用户闭环

```text
在 DSH 表达意图
  -> 识别 show / episode / artifact / review / evidence 上下文
  -> 展示 owner-authored 下一步与风险
  -> 简单任务在 Pane 完成
  -> 复杂度上升时签发 V2 launchRef
  -> Workbench /agent 重新鉴权、refetch、打开正确 lens
  -> Workbench 完成复杂操作，结果由 owner/Ordo 记录
  -> DSH 订阅新 projection，继续对话与下一步
```

Bridge 只负责“上下文连续进入”，不负责搬运或复制 domain state。

## 4. 目标体验

### 4.1 DSH 侧

- `/drama` 默认呈现当前 show/episode、freshness、primary blocker 和一个 owner-approved next action。
- “Open in Workbench” 在点击前说明将打开的 lens、焦点资源、版本和有效期。
- V2 不可用时，入口保持可见并显示原因：consumer 不兼容、capability stale、target unavailable、权限不足或合同错误。
- 旧 consumer 仅支持 V1 时，明确显示 `legacy_bridge`，不把“已签发”包装成“已消费”。
- unknown/timeout 不自动重试 mutation；用户可查询状态或显式签发新 handoff。

### 4.2 Workbench 侧

- 接受逻辑目标 `workbench.agent.spatial`，由 host registry 解析部署地址，不接收浏览器拼接的任意 URL。
- 根据意图打开固定 lens：
  - `open_show` / `open_episode` / `open_artifact` → Creative Production；
  - `open_review` → Review；
  - `open_evidence` → Evidence。
- 在打开前重新校验用户、tenant、workspace、project、resource 和版本。
- 版本不一致时进入 `reconcile_required`，不静默覆盖；无权限时返回 `denied`，不泄露资源细节。
- 消费结果可被 DSH 以安全 receipt/evidence ref 查询，但 Workbench 不把内部 state 暴露给浏览器桥。

## 5. Bridge V2 合同原则

新合同 identity 为 `dsh.workbench_ai_drama_bridge.v2`，方向固定为 `dsh_to_workbench`。它包含：

- source/target surface identity；
- workspace、project、show、episode、resource 等 bounded opaque refs；
- resource version 与 context revision；
- 封闭的 presentation intent；
- epoch-millisecond expiry；
- 32 位小写十六进制随机 nonce；
- canonical digest；
- 可选 artifact/evidence refs。

安全边界：

- 不含 raw URL、origin、cookie、token、绝对路径、raw prompt、provider payload 或 private tool arguments。
- digest 只检测序列化/传输损坏，不代表身份和授权。
- 浏览器只获得短期 opaque `launchRef` 与安全展示字段。
- Workbench ingress 永远重新鉴权和 refetch，不信任 DSH 传来的标题、可写权限或终态。
- replay 以 tenant + nonce + contract version 做有界幂等；相同 payload 返回原结果，不同 payload 拒绝。

完整规范见 [OpenSpec design](../../openspec/changes/dsh-workbench-ai-drama-bridge-v2/design.md) 与 [capability spec](../../openspec/changes/dsh-workbench-ai-drama-bridge-v2/specs/dsh-workbench-ai-drama-bridge/spec.md)。

## 6. 合同迁移策略

| 阶段 | DSH 行为 | Workbench 行为 | 发布状态 |
| --- | --- | --- | --- |
| Contract freeze | 实现 V2 schema/fixture，默认关闭 | 评审 consumer packet | planning-complete |
| Provider complete | V2 provider、probe、launcher 通过；保留 V1 | 可尚未发布 | plugin-complete |
| Consumer conformant | canary 签发 V2 | ingress 通过相同 fixture | consumer-conformant |
| Canary | 优先 V2，可观测 fallback | 返回消费结果与 reason | canary-enabled |
| Default on | V2 默认，legacy 仅兼容 | V2 正常消费 | rollout-ready |
| Legacy exit | 独立变更提出删除 | 确认无依赖 | 不属于本变更 |

V1 signer/validator/adapter 至少保留两个连续 DSH 插件发布窗口。回滚时关闭 V2 签发，让已有短期 launchRef 自然过期，然后切回显式 legacy 或 disabled；不迁移、不删除、不回写任何 owner state。

## 7. 90 天推进方案

### Phase 0：合同冻结（第 0–2 周）

- 完成 Bridge V2 OpenSpec、字段账本、reason codes 和跨仓 consumer packet。
- 固定五种 intent → lens 映射，停止新增临时 deep-link 字段。
- 用 canonical fixtures 把非法字段、nonce、expiry、版本和 replay 行为变成可执行合同。

**退出条件**：双方对 identity、字段、鉴权、版本冲突和回滚无开放阻断项。

### Phase 1：DSH provider complete（第 2–5 周）

- Host 实现 V2 signer/validator、capability probe、target registry 和 launchRef。
- Client 将 handoff 从提示文本升级为批准 launcher，并补齐 disabled/reconcile/unknown 状态。
- Bundle/SDK 以增量 surface 导出 V2，V1 测试保持通过。

**退出条件**：本仓 typed probe、client tests、bundle contract、fixtures、typecheck/test/build 全绿，可诚实报告 plugin-complete。

### Phase 2：Workbench consumer conformant（第 4–8 周）

- Workbench `/agent` ingress 消费 launchRef，重新鉴权、refetch、版本检查和 lens 定位。
- 双方跑同版本 fixture，输出独立证据。
- 失败状态和 correlation ref 能跨仓对齐，但不暴露 nonce 或 envelope。

**退出条件**：provider 与 consumer conformance 都绿，方可进入 canary。

### Phase 3：Canary 与默认开启（第 8–12 周）

- 小比例 profile 开启 V2，观察签发到消费转化、拒绝、reconcile、过期和 legacy fallback。
- 修正交互和 reason 文案，不在 canary 期扩大合同字段。
- 达到退出阈值后默认开启；旧合同进入至少两个发布窗口的观察期。

**退出条件**：核心成功指标稳定、严重安全/权限事件为零、回滚演练通过。

## 8. CEO 经营指标

Bridge V2 不以“按钮点击量”作为成功标准，重点看从意图到生产结果的连续性：

| 指标 | 定义 | 用途 |
| --- | --- | --- |
| Handoff activation rate | `launch_requested / bridge_issued` | 判断 DSH 是否给出清晰、可信入口 |
| Consumer open rate | `bridge_consumed / launch_requested` | 判断跨仓合同和 target 可用性 |
| Context continuity rate | 打开后资源与预期 show/episode/artifact 一致的比例 | 衡量真正减少重新定位 |
| Reconcile rate | `reconcile_required / consumed attempts` | 暴露版本漂移和长链路延迟 |
| Denied/mismatch rate | 权限拒绝与合同错误比例 | 监控安全和发布兼容性 |
| Time to productive action | 从 DSH 发起到 Workbench 首个有效 owner action 的时间 | 衡量业务效率，而非页面跳转 |
| Legacy fallback share | legacy handoff 占兼容 handoff 的比例 | 决定何时可以提出退役 |
| Return-to-DSH continuity | Workbench 动作后 DSH 收到新 projection 并继续协作的比例 | 衡量是否形成双向产品闭环 |

指标只记录稳定类别、版本和 opaque correlation/evidence refs，不记录内容、nonce、凭据或完整 handoff。

建议用以下初始 go/no-go 门槛启动 canary，首个稳定窗口后再基于真实基线调整运营指标，但安全门不得下调：

- 跨 tenant、越权写入、静默覆盖和敏感字段泄露事件必须为 0。
- `context continuity rate` 不低于 99.5%。
- V2 `contract_mismatch` 不高于兼容请求的 0.1%，健康窗口内 `target_unavailable` 不高于 0.5%。
- 所有 unknown/timeout 路径均无自动 mutation retry，回滚开关演练可在 15 分钟内停止新 V2 签发。
- activation rate 和 time to productive action 用于产品优化，不因追求转化率绕过权限、版本或用户确认门。

## 9. 组织 owner 与决策门

| 范围 | Owner | 交付 |
| --- | --- | --- |
| V2 provider contract、safe projection、launcher | DSH/harness-plugins | schema、fixtures、host/client/bundle、证据 |
| `/agent` ingress、lens、资源授权与 refetch | Workbench | consumer adapter、conformance、canary |
| run/task/lease/approval/evidence owner | Ordo | 权威状态与 action descriptors |
| contract removal 与发布窗口 | DSH + Workbench release owners | 独立 OpenSpec/change、采用率证据、回滚演练 |
| go/no-go | 产品 + 安全 + 两仓技术 owner | consumer conformance 和 canary evidence |

任何一方都不能通过修改本地 validator 单方面宣布合同升级完成。

## 10. 风险、止损和禁止扩张

- 如果连续 canary 中 `contract_mismatch` 或 `denied` 显著上升，立即关闭 V2 签发并保留证据，不能以 Client 重试掩盖问题。
- 如果 Workbench consumer 迟迟未完成，DSH 仍可作为 plugin-complete 发布，但入口必须保持 disabled/legacy，不宣布跨仓上线。
- 如果需求要求在浏览器传 raw URL、token 或 owner payload，停止实现并回到 host registry/server exchange 设计。
- 如果团队提出在 DSH 复制 Workbench scene graph 或在 Workbench 复制 Ordo ledger，必须作为新的架构决策评审，不得借 Bridge V2 顺带扩张。
- 如果两个发布窗口后 legacy 使用率仍高，先解决 consumer 覆盖和迁移问题，不按日历强删合同。

## 11. 完成定义

Bridge V2 只有同时满足以下条件才算“业务可用”：

1. DSH provider、Client launcher、bundle 和 SDK 通过本仓门禁。
2. Workbench consumer 通过相同 fixture 版本，并能打开三个目标 lens。
3. 权限拒绝、版本冲突、过期、replay 和 unknown 路径均 fail-closed。
4. canary 指标可观测，且不包含敏感内容。
5. 回滚到 legacy/disabled 已演练，不改写 owner state。
6. 产品文案和文档不再把 Show Control Room 描述为当前目标入口。

实施清单见 [tasks.md](../../openspec/changes/dsh-workbench-ai-drama-bridge-v2/tasks.md)。

## 12. 发布门 checklist（四态门）

四个状态是严格递进的事实声明，任何一方不得用本地绿灯跳过前一态：

- [ ] **plugin-complete**（DSH 单仓）：typed probe、host/client/bundle/fixture 测试、typecheck、build、`check:bundles` 全绿；V2 flag 默认 off；legacy 面不变。
- [ ] **consumer-conformant**（Workbench 单仓）：consumer+both actor fixtures 同版本（`2026-08-29.1`）全绿，证据独立落盘于 Workbench 仓；ingress 拒绝 raw route/URL、重新鉴权、版本对账、replay 幂等与冲突行为可复现。
- [ ] **canary-enabled**（联合）：产品+安全+两仓 owner go/no-go 通过；canary profile 开启 V2；issued/launch_requested/consumed/denied/reconcile/legacy fallback 指标可见；回滚演练 ≤15 分钟完成。
- [ ] **cross-repository rollout-ready**（联合）：双方同版本 fixtures 持续绿、canary 指标满足 §8 门槛（安全门零事件、context continuity ≥99.5%、mismatch ≤0.1%）；此后才可默认开启，legacy 进入 ≥2 个发布窗口的观察期，退役另立变更。

跨仓关联物：[Workbench consumer packet](../integrations/dsh-workbench-ai-drama-bridge-v2-packet.md)（匹配 change `workbench-dsh-ai-drama-bridge-consumer-v1`）与 [运维 cookbook](../cookbook/dsh-workbench-bridge-v2.md)。
