# 添加 Ordo Agent Ops 插件

[English](adding-ordo-agent-ops-plugin.md) | 中文

本文定义 DeepSeek Harness 侧的 Ordo Agent Operations 接入方式，覆盖 tenant-safe host plugin、Web client module、profile/组合包以及 ToolView 展示。[本地 OpenSpec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/README.md)负责跨项目合同和分阶段动作。

## 前置条件

- 阅读[架构文档](../architecture.md)、[client 模块参考](../subsystems/client-modules.md)和[包开发指南](adding-a-package.md)。
- 明确 Ordo 拥有 run、task、session、runtime、lease、worktree、approval、verification、evidence 和 closeout 事实。
- 准备 tenant-bound control-plane adapter 或无密钥 fake 用于本地测试。不得把 provider token 放入浏览器或 profile patch。

## 1. 冻结 owner 边界

创建包之前先写 owner 表。DSH adapter 负责 transport、类型化安全投影、事件订阅、UI 组装和生命周期清理；Ordo 负责 canonical state 和 owner receipt；Workbench 负责完整多租户运维视图。DSH 插件不得创建第二 scheduler、task ledger、lease ledger、capacity reservation 或 terminal state。

跨进程值统一使用 opaque ref 和有界摘要。host 边界必须拒绝 raw prompt、provider payload、credential、generic bearer、private tool arguments、absolute host path、PID 和完整思维链。

## 2. 创建 host face

添加 Cordis host package，并同时定义 service definition、provider 和 consumer。服务只暴露加载 authoritative snapshot、订阅 event stream 和分派 server-authored action descriptor 的类型化方法。每个请求按需要绑定 tenant、workspace、principal、context revision、membership revision、installation、plugin digest、policy revision 和 runtime generation。

host face 负责：

- access-ticket 或 BFF transport 以及 audience 检查；
- snapshot 与 cursor 生命周期；
- duplicate 抑制和 gap 触发的 snapshot reload；
- bounded cache 生命周期和连接 backoff；
- unload、HMR、tenant switch、runtime switch 时的幂等 dispose；
- 在数据进入 browser client module 前完成 redaction。

事件断开只会把 freshness 变为 `stale` 或 `offline`，不能把 run 改成 succeeded、failed 或 stopped。

统一 bundle 现在提供 Host 侧 event contract validator 和有界 cursor consumer：必须
先有 authoritative stream anchor，只接受下一个 sequence，幂等忽略完全重复的 event
ref；gap、entity version 回退、context/membership/digest/runtime 漂移或 reset 都会清空
cursor。它只是安全 consumer 工具，不是 Ordo event source；真实订阅、transport backoff
和 profile 证据仍由 owner 提供。

## 3. 创建 client face

声明 `dsh.client` 并导出构建后的 `./client` bundle。持久 Agent Ops 面板使用现有 UI primitives 和 reviewed client slot。DSH 视图保持紧凑，显示：

- 当前 run 和 task 进度；
- attention 与 approval 数量；
- runtime qualification 和 capacity 来源；
- writer lease/worktree 摘要；
- 最近 verification/evidence refs；
- 经过重新鉴权的 Workbench Studio 链接。

单次 inspect、approval、reconcile 或 evidence 操作使用 ToolView。ToolView 接收 authoritative result，并明确展示 `unknown`、`partial`、`cancel_unknown` 和 `reconcile_required`；不能根据 HTTP status 或本地 optimistic flag 自行生成 terminal result。

## 4. 组装 profile 与组合包

在 package metadata 中声明插件，并通过 profile/组合包 patch 组装。使用以下命令查看实际组合树：

```bash
dsh --profile web --dump-config
```

组合包必须固定兼容的 DSH release，并且可在不修改 DSH core 的情况下移除。一个 runtime profile 和 work directory 只属于一个 tenant/workspace/runtime subject；不得在同一 DSH process 内复用多个 tenant 的授权。

## 5. 实现 state 与 action gate

客户端 state 必须区分 `ready`、`running`、`attention_required`、`approval_required`、`stale`、`offline`、`permission_denied`、`contract_mismatch`、`unknown` 和 `reconcile_required`。mutation control 只能来自 server-authored `allowed_actions`。

每个 action 在 dispatch 前显示 target、requested effect、owner、approval、expiry、expected version、policy、cost/rights blocker 和 receipt/reconcile 语义。`unknown`、`partial` 和 `cancel_unknown` 必须禁用自动 retry 与 replacement writer。

## 6. 测试实际组装路径

测试至少覆盖三层：

1. host service 测试覆盖 context binding、redaction、snapshot 与 event cursor gap reload、duplicate event、entity version 回退、action idempotency 和幂等 dispose。本地 event contract/cursor 证据见 [event-cursor.spec.ts](../../packages/bundle/ordo-agent-ops/tests/event-cursor.spec.ts)；它不替代 owner event source。
2. client 测试覆盖 state reduction、stale/unknown 渲染、键盘焦点、reduced motion 和 ToolView 输出。
3. profile/Web 测试通过真实 Loader 加载 bundle，验证安装、移除、HMR/unload、浏览器无 token 以及 tenant switch 清理 cache。

Ordo owner fixture 的消费方 conformance 入口位于消费它们的包内：duplicate、version/ref 漂移、reconcile 重读、迟到结果、断线不合成 terminal、non-readable 直传见 [controller.client.spec.ts](../../packages/client/ui-ordo-agent-ops/tests/controller.client.spec.ts)；stale context、不安全 ref、未知字段与 owner 异常见 [gateway.spec.ts](../../packages/host/ordo-agent-ops/tests/gateway.spec.ts)。fixture 必须保持 safe projection：需要 raw prompt、provider payload、credential 或 host path 的用例应退回 owner 合同，而不是在本地复现。

先运行与改动最接近的命令：

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run doc-sync
openspec validate ordo-dsh-plugin-visualization-v1 --strict
git diff --check
```

集成证据写入 `temp/integration-test-runs/<run-id>/`，并脱敏 secret、raw prompt、provider payload、private tool arguments、absolute path 和完整思维链。

## 7. 记录合同

配置和生命周期语义更新包 README，开发路径更新本文，字段、动作、owner 或失败行为变化更新本地 OpenSpec。架构或安全边界变化时添加或更新 DSH Agent Note。仅属于 DSH 的实现工作不得再新增根仓库 OpenSpec 任务。

## 8. 外部 owner handoff 账本

下面的账本是 DSH consumer contract。它记录 Ordo、Workbench、Harness Plugins
或 Control Plane owner 必须发布的字段和版本摘要；它不实现这些 owner，也不把
缺少字段转换成本地默认值。

### Ordo read 与 action service

| 面 | 必需安全字段 | 版本 / 失败规则 |
| --- | --- | --- |
| Snapshot read | `schema_version`、`snapshot_ref`、`snapshot_version`、`generated_at`、`fresh_until`、`context.tenant_ref`、`context.workspace_ref`、`context.principal_ref`、`context.context_revision`、`context.installation_ref`、`membership_revision`、`delegation_ref`、`policy_revision`、`plugin_release_digest`、`ordo_contract_digest`、`stream_ref`、`cursor`、安全的 run/task/runtime/lease/approval/verification/evidence 摘要、`allowed_actions` | `ordo.agent_ops.snapshot.v1alpha1`；`ready` 和 `stale` facts 必须与冻结 context 精确一致。字段缺失、不安全、未知或漂移时，以 `needs_contract` 或 `contract_mismatch` fail closed。 |
| Event stream | `schema_version`、`event_ref`、`stream_ref`、单调 `sequence`、`cursor`、`occurred_at`、`observed_at`、`entity_ref`、`entity_version`、`event_type`、有界 `safe_delta_or_summary`、脱敏 `evidence_refs` | `ordo.agent_ops.event.v1alpha1`；duplicate 幂等忽略；gap、cursor 过期、digest 变化、tenant/config 变化或 runtime generation 变化会停止 delta 应用并要求重读 snapshot。 |
| Action descriptor | `action_type`、`decision_ref`、`target_ref`、`target_version`、精确的 principal/tenant/workspace/context/installation 绑定、需要时的 `runtime_generation`、`plugin_release_digest`、`ordo_contract_digest`、policy/approval/expiry、幂等 key、`preview_digest` | `harness.action.v1alpha1`；只能 dispatch server-authored descriptor。DSH 不发送任意 command、argv、env、URL、host path、bearer 或未注册 action type。 |
| Receipt | `receipt_ref`、owner state、有界 `safe_summary`、`evidence_refs`、freshness 以及 reconcile/unknown 语义 | `harness.receipt.v1alpha1`；terminal UI state 必须由 owner receipt 或 authoritative snapshot 确认。`unknown`、`partial`、`cancel_unknown` 禁止 retry、replacement writer 和 lease release。 |

规范要求见[Ordo Agent Operations spec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/specs/ordo-agent-operations-plugin/spec.md)。
如果 owner 不能提供字段或版本 digest，adapter 返回合同失败并等待 owner reconcile；
不会在本地推导 qualification、capacity、terminal state 或 permission。

### Workbench handoff 与语义 parity

DSH 面板只能向 Workbench 传递 opaque resource refs、owner versions、freshness、
reason codes、evidence refs 和安全摘要。`Open in Studio` 只是 navigation hint，
不是 authorization grant。Workbench 必须重新鉴权 principal、tenant、workspace、
installation 和 target resource，然后才能渲染或 dispatch。两端必须消费相同的
`status`、`reason`、`freshness`、`permission`、`approval`、`allowed_actions`、
owner refs 和 receipt state；布局和密度可以不同，动作资格不能不同。

Workbench owner 负责 Studio route、Canvas presentation state 和多租户导航。DSH
adapter 不嵌入私有 React store，不构造 privileged URL，也不把 deep link 当成
BFF/owner authorization 的替代品。详见[可视化 spec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/specs/ordo-visualization-experience/spec.md)。

### Harness Plugins pack handoff

pack owner 必须发布固定 manifest 和 profile composition，包含 package name/version、
`dsh.bundle.patch` 路径、host/client contribution key、DSH host compatibility range、
Ordo contract digest、plugin release digest 和 profile conformance 命令。当前本地
bundle 通过 [`@yeisme/dsh-ordo-agent-ops`](../../packages/bundle/ordo-agent-ops/package.json)
和 [`cordis.patch.yml`](../../packages/bundle/ordo-agent-ops/cordis.patch.yml) 暴露这些
缝；package tests 和 `pnpm run build` 只是本地证据，不是 catalog 或 release authority。

安装只消费固定 release 与 profile composition，随后检查组合树和可移除 patch。pack
不得成为 tenant database、Ordo state store、scheduler、lease authority 或 release
catalog；这些职责仍归 Harness Plugins 与 Control Plane owner。

### Control Plane 输入

Host adapter 只接受 audience 指向 Ordo Agent Ops service 的 tenant-bound access
capability 或 BFF transport，以及精确 runtime binding（`tenant`、`workspace`、runtime
subject 与 generation）、installation config revision、membership revision、policy/
delegation context 和 plugin/contract digest。membership revoke、audience mismatch、
runtime 或 installation drift、stale context 会使旧 cursor 与 action descriptor 失效，
并在新的安全 projection 获得授权前禁用 mutation。

Control Plane owner 负责 tenant database、OAuth issuer、secret store、BFF/access-ticket
签发和 durable revocation。DSH 不接收 credential value、不保存 generic bearer token，
也不从 browser parameter 推导 authorization。详见[host adapter spec](../../openspec/changes/ordo-dsh-plugin-visualization-v1/specs/dsh-ordo-host-adapter/spec.md)。

## 9. Team V1 协作 Hub

计划中的 Team V1 surface 会 additive 扩展现有 Ordo Agent Ops 入口，而不替换 legacy run views。Session Agents 与 Ordo Teams 保持独立；Team workspace 只能通过 Harness Host 消费 Ordo owner 的 safe projection 和 typed actions。

- 阅读 [Team Hub Web 设计](../design/dsh-web-ordo-team-hub-v1.md)，了解 layout、graph、响应式、可访问性与安全边界。
- 按 [Team Hub cookbook](dsh-web-ordo-team-hub.zh.md) 检查 capability probe、降级状态、action receipt 与回滚。
- 在 [owning OpenSpec](../../openspec/changes/dsh-web-ordo-team-hub-v1/) 跟踪实现；这些文档定义 planned contract，不代表当前 runtime 已支持。
