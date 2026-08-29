# DSH AI Drama Director Pack

## 定位

Director Pack 是 DSH 中的 Agent 侧做剧工作入口。它让用户在对话上下文中选择 Show/Episode，按需推进故事、视觉、音频、生成、审查和 owner 导出动作；`show-control` preset 进一步提供单部剧的 Episode Board、Review Inbox、Asset Wall 与 Delivery 安全投影。更高密度、空间化和外部专业工具工作仍可通过 Bridge V2 进入 Workbench `/agent` Spatial Creative Runtime。

它不是第二个 Creator Studio、第二个 Workbench 或第二个 scheduler。它复用现有 Pane Workbench、Creator Studio safe projection、Rich Media renderer、artifact intents 和 Ordo Agent Ops。

## 安装包

建议发布三个可独立测试的包：

- packages/host/ai-drama-director：context binding、command handlers、owner-safe projection adapter 和 Workbench handoff。
- packages/client/ui-ai-drama-director：Context、Story、Visual、Audio、Run、Review Pane views。
- packages/bundle/dsh-ai-drama-director：安装 profile、capability probe 和默认 preset。

bundle 不隐式安装 provider、owner runtime 或 Workbench，也不修改用户已有 Pane layout。缺少 capability 时注册 disabled entry 并给出原因。

## 命令

| 命令 | 行为 | 风险边界 |
| --- | --- | --- |
| /drama | 打开 command center 与当前 context | 只读 |
| /drama new | 创建 Create Show proposal 或打开 Workbench | 不直接写 owner state |
| /drama open | 切换 show/episode/scene/shot context | 重新验证 revision |
| /drama plan | 打开 Story/Plan projection | 只读或 proposal |
| /drama generate | 显示 owner-authored generation actions | 必须 cost/rights/permission gate |
| /drama review | 定位下一项异常或人工决定 | mutation 由 owner descriptor 驱动 |
| /drama repair | 创建 repair proposal | 不直接覆写 artifact |
| /drama evidence | 打开 run/receipt/verification | 只读 |
| /drama show | 打开 Episode Board | 只读投影；context switch 由 owner descriptor 驱动 |
| /drama inbox | 打开跨集 Review Inbox | 只选择已加载目标，批量动作先 preview |
| /drama assets | 按需打开 Asset Wall | 只读 compare/open intent |
| /drama delivery | 打开 Delivery readiness | prepare/submit/remediate 由 owner 发布 |
| /drama handoff | 打开 Workbench 或 approved external handoff | 仅 typed refs |

命令 parser 不接受任意 argv、shell fragment、绝对路径或 provider payload。命令只解析选择器和用户可见字段，再交给 Host typed handler。

## Pane preset

默认 `director` preset 保持三个 Pane，兼容现有会话工作流：

1. Context：Show/Episode/Scene/Shot、readiness、primary blocker。
2. Review：下一项 compare/decision/repair。
3. Run：当前 Ordo/Aigora attempt、cost/ETA、receipt/reconcile。

Story、Visual 和 Audio 为按需打开的 secondary panes。新增的 `show-control` preset 默认展示 Show Board、Review Inbox、Run 与 Delivery；Asset Wall 按需打开。两个 preset 共享 owner 投影，不共享导航状态，也不创建第二个领域 store。

## Context contract

DramaContextV1 只包含：

- workspaceRef、projectRef、showRef、episodeRef、可选 sceneRef/shotRef。
- owner、version、contextRevision、freshness。
- display-safe title/summary。
- approved Workbench presentation intent。

context 变化时，插件必须 teardown 旧 subscription、清空 presentation cache、重新读取 snapshot，并在 revision 不匹配时禁用 mutation。

## Artifact handoff

复用现有 ArtifactRef/Intent 机制：

- open：在 Rich Media 或对应 Pane 打开。
- compare：并排比较两个或少量候选。
- attach_context：将 Pinax/Auctra 等 owner ref 作为目标 action 的输入建议。
- generate：仅调用当前 owner 发布的 descriptor。
- review：打开 owner decision surface。
- repair：创建 proposal。
- handoff：打开 Workbench 或批准的外部目标。

来源插件不得直接调用目标 provider；Host 必须重新读取目标 owner snapshot 和 descriptor。

## 与 Workbench 的边界

DSH 现在同时覆盖“当前集怎么继续”和“单部剧有哪些待处理项”，但只承载 owner-safe 操作投影：

- Show Control Room 一次绑定一个 tenant/workspace/show；浏览器不能切换租户，也不能拥有 Episode、Review、Approval、Run 或 Delivery ledger。
- 批量操作只针对最多 100 个已加载目标，必须先取得 owner-issued batch descriptor，再一次提交；unknown 不自动重试。
- Workbench 保留为可选的高密度、空间化和高级分析宿主，适合大规模跨集布局、复杂比较和外部专业工具，不是 DSH 控制台的必经路径。
- Workbench 不复制 DSH conversation、subagent 或 slash-command state；Bridge V2 只传安全 refs、resource version 和封闭 presentation intent。

## Bridge V2 迁移

当前实现中的 `drama.workbench-handoff.v1` 是兼容期 legacy provider 合同；它能够签发和本地校验，但不等于 Workbench 已消费。后续统一路径由 `dsh.workbench_ai_drama_bridge.v2` 提供：

- DSH Host 探测 Workbench consumer capability，签发短期 opaque `launchRef` 并返回 host-approved launch descriptor。
- Workbench 在 `/agent` server ingress 重新鉴权、refetch owner 数据并检查 resource version/context revision。
- `open_show`、`open_episode`、`open_artifact` 进入 Creative Production；`open_review` 进入 Review；`open_evidence` 进入 Evidence。
- V1 至少保留两个连续 DSH 插件发布窗口；V2 不可用时显式 legacy fallback 或 disabled，不生成死按钮。
- 删除旧合同必须使用独立变更，并以跨仓 conformance、采用率和回滚证据为前提。

完整产品与架构方案见 [DSH × Workbench AI 做剧 Bridge V2](dsh-workbench-ai-drama-bridge-v2.md)。

## Scaena 边界

Director Pack 不要求 Scaena 新增 adapter、projection 或 action。若已有 Scaena segment 可用，可显示 production/delivery 摘要；缺失时只禁用相关动作。Story、Visual、Review 和 Run 的非 production 纵切仍可通过正确 owner 继续。

## 验证

- command parser、selection、context switch、descriptor expiry 和 redaction 单元测试。
- Pane preset、keyboard、focus、responsive、missing capability 和 disabled reason 组件测试。
- DSH -> Workbench handoff、context revision、unknown receipt 和 reconcile 集成测试。
- bundle init/validate/pack、profile patch 幂等与卸载恢复测试。
- integration evidence 写入 temp/integration-test-runs/<run-id>/，不依赖官方 DSH 尚未合入的 seam。

能力状态与仍需外部 owner/人工解锁的事项见 [AI Drama 能力缺口 ledger](dsh-ai-drama-capability-gap-ledger.md)。

## Owning OpenSpec

[dsh-ai-drama-director-pack-v1（已归档）](../../openspec/changes/archive/2026-08-29-dsh-ai-drama-director-pack-v1/)

[dsh-ai-drama-operational-panes-v1](../../openspec/changes/dsh-ai-drama-operational-panes-v1/)

[dsh-ai-drama-show-control-room-v1](../../openspec/changes/dsh-ai-drama-show-control-room-v1/)

[dsh-ai-drama-review-delivery-depth-v1](../../openspec/changes/dsh-ai-drama-review-delivery-depth-v1/)

[dsh-workbench-ai-drama-bridge-v2（已归档）](../../openspec/changes/archive/2026-08-29-dsh-workbench-ai-drama-bridge-v2/)
