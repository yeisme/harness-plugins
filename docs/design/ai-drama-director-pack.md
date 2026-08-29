# DSH AI Drama Director Pack

## 定位

Director Pack 是 DSH 中的 Agent 侧做剧工作入口。它让用户在对话上下文中选择 Show/Episode，按需推进故事、视觉、音频、生成、审查和 owner 导出动作；复杂生产工作通过 Bridge V2 进入 Workbench `/agent` Spatial Creative Runtime 的 Creative Production、Review 或 Evidence lens。

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
| /drama handoff | 打开 Workbench 或 approved external handoff | 仅 typed refs |

命令 parser 不接受任意 argv、shell fragment、绝对路径或 provider payload。命令只解析选择器和用户可见字段，再交给 Host typed handler。

## Pane preset

默认 Director preset 最多显示三个 Pane，避免在会话侧复制完整 Workbench：

1. Context：Show/Episode/Scene/Shot、readiness、primary blocker。
2. Review：下一项 compare/decision/repair。
3. Run：当前 Ordo/Aigora attempt、cost/ETA、receipt/reconcile。

Story、Visual 和 Audio 为按需打开的 secondary panes。当前项目的完整阶段流程可以留在 Pane；用户需要完整 Episode Board、专业 Asset Wall、跨集比较或大量候选批量处理时，使用可选 Open in Workbench。

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

DSH 优先解决“我现在和 Agent 一起做什么”；Workbench 解决“整部剧全局发生了什么”。因此：

- DSH 不实现 Workbench 级 Show/Episode 批量管理、跨集比较、专业 Asset Wall 或 Delivery dashboard。
- Workbench 不复制 DSH conversation、subagent 或 slash-command state。
- Open in Workbench 只传安全 context refs、resource version 和封闭 presentation intent；浏览器不拼接任意 URL。
- Continue in DSH 只生成已批准 profile/command/deep-link payload。

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

## Owning OpenSpec

[dsh-ai-drama-director-pack-v1](../../openspec/changes/dsh-ai-drama-director-pack-v1/)

[dsh-workbench-ai-drama-bridge-v2](../../openspec/changes/dsh-workbench-ai-drama-bridge-v2/)
