# DSH AI Drama Director Pack

## 定位

Director Pack 是 DSH 中的 Agent 侧做剧工作入口。它让用户在对话上下文中快速选择 Show/Episode、查看下一项审查、发起允许的生成或修复动作，并在需要管理整部剧时打开 Workbench Show Control Room。

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

Story、Visual 和 Audio 为按需打开的 secondary panes。用户需要浏览整个 Episode Board、Asset Wall 或大量候选时，使用 Open in Workbench。

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

- DSH 不实现完整 Show/Episode tree、Asset Library、批量 Review Inbox 或 Delivery dashboard。
- Workbench 不复制 DSH conversation、subagent 或 slash-command state。
- Open in Workbench 只传 context refs 和 presentation intent。
- Continue in DSH 只生成已批准 profile/command/deep-link payload。

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
