# DSH AI Drama 能力缺口 Ledger

> 基线日期：2026-08-30。该 ledger 记录当前可交付面与真实外部依赖，不回写或美化已归档 change 的历史状态。2026-08-30 的产品组合决定将 Workbench 固定为默认视觉入口、DSH 固定为异常优先导演台；既有 full-show panes 保留为兼容能力。

## 分类规则

| 分类 | 含义 | 处理原则 |
| --- | --- | --- |
| deliver-now | 本仓可在现有公开合同上完成 | 纳入 G15–G17 实现与测试门 |
| external-owner | 依赖 DSH core、领域 owner 或 Workbench consumer | 保留 probe、禁用原因和上游跟踪，不阻塞插件完成 |
| human-gate | 需要真实账号、权限、版权或人工判断 | 只提供 owner action/receipt 入口，不伪造自动结论 |
| superseded | 已由更晚合同或实现替代 | 只引用替代证据，不伪造旧 change 的历史完成 |
| closeout | 已有可重复验证证据，可正常关闭 | 在当前 change verify 后归档 |

## 能力重基线

| 能力 | 分类 | 当前结论与证据 |
| --- | --- | --- |
| Director Pack metadata、安装/卸载/重装 | closeout | G14 已归档；bundle metadata application service、profile conformance 与 ModuleLoader smoke 持续验证。 |
| 六个 Director operational panes | deliver-now | G15 由共享 `CreatorStudioRuntimeV1` 驱动；legacy Creator remote 仅提供显式刷新、只读回退。 |
| Episode Board、Review Inbox、Asset Wall、Delivery | deliver-now | G16 由 `DramaShowControlOwnerAdapterV1` 与 `DramaShowControlRemoteV1` 提供单 Show 安全投影。 |
| `/drama` exception-first 默认入口 | deliver-now | 新 owning change 需要把默认输出收敛为 context、primary blocker 与一个 owner-approved next action；现有 full-show panes 不删除，只降级为 legacy/advanced view。 |
| 批量动作与 selection annotation | deliver-now | 只接受最多 100 个已加载目标；owner descriptor 与 selection owner 分别拥有动作/批注批次。 |
| 富媒体 timeline、regions、caption navigation | deliver-now | G17 对 owner cue、artifact/version 和 enhancer 生命周期做围栏；长音频保留 native fallback。 |
| 视频 chapters 剩余项 | closeout | 已被 owner cue navigation 与 rich-media lifecycle tests 覆盖，可随 G17 关闭。 |
| V3 旧编辑/预览条目 | superseded | 语义文件编辑器、V4 Pane 体验与本轮 operational panes 已提供后继实现；只保留对应归档/测试引用。 |
| 官方 `workspace.core-pane.v1`、真实 slot/geometry | external-owner | 继续由 `upstream-prs/pane-workspace-layout` 与 capability probe 跟踪；Tier 0 overlay 保持可用。 |
| 真实 fs/media/terminal owner seam | external-owner | 本仓只消费已发布 surface；缺失时显示 `needs_contract`/`partial`，不以 mock 冒充生产数据。 |
| 领域 Show/Review/Delivery adapter | external-owner | Harness Plugins 提供目录、gateway 和 conformance；真实领域数据与 canonical state 仍归 owner。 |
| Bridge V2 Workbench consumer 与 Director Workspace | external-owner | Workbench 是 AI 做剧默认视觉入口；consumer 未完成时 DSH 必须显示 `needs_contract`/legacy fallback，不能把已签发描述为已打开。 |
| 共享 decision token/receipt | external-owner | DSH 只消费实际 owner 发布的 decision identity；Workbench/DSH 任一端完成后均 refetch 同一 receipt，不维护本地审批状态机。 |
| OpenChatCut/Kdenlive/OpenCut editor ladder | external-owner | adapter、delivery bundle、semantic diff、quarantine 与 rebase 归 Scaena；DSH 只展示 capability 和 approved handoff。OpenCut 未成熟时固定 planned/unavailable。 |
| 审批、版权清理、最终交付提交 | human-gate | UI 只呈现 owner-authored action、rights/evidence 摘要和 receipt；人工/owner 决策不可由浏览器推导。 |
| 全局持久本地 editor 信任 | human-gate | 保存的本地信任可允许 host 发现/启动 editor 与读取媒体，但不自动授权 canonical accept、rights/cost、external apply、upload/cloud render 或 final export。 |
| 真实 profile 的官方 `dsh plugin add` / Web boot | human-gate | 可选 host integration；需要外部环境与授权，不作为本仓协议完成门。 |

## 关闭纪律

- `stale`、`partial`、`gap`、`unknown`、`cancel_unknown` 只允许只读查看与 reconcile，不自动重试或替换 writer。
- browser projection 不得包含 token、cookie、raw URL、绝对路径、provider payload、raw prompt 或 private tool arguments。
- 兼容期 full-show panes 至少保留两个连续插件发布窗口；默认导航变化不得复用或改义已有 command/pane identity。
- G15–G17 只有在 focused gates、root gates、严格 OpenSpec validation 和脱敏 integration evidence 均可重复后才进入 archive。
