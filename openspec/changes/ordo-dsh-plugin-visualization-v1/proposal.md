## Why

Ordo 已经拥有多 runtime 调度、DAG、session、writer/worktree lease、approval、verification 和 evidence，但这些事实主要通过 CLI/TUI 消费；DSH Web 则拥有成熟的对话式 Harness 与 Cordis 插件体系，却没有 Ordo-backed 的团队运行观察与企业多租户产品界面。需要一个宿主中立的 Agent Ops 插件合同，把 Ordo 能力安全投影到 DSH 和 Workbench，同时避免在前端、控制面或插件仓库中创建第二 scheduler。

当前 `ordo harness capacity inspect` 仍是只读、内存中的 fail-closed 投影，不会观察或启动真实 OS 进程，也不创建持久 reservation。因此本设计必须把“现在可交付的观察/审批/reconcile”与“后续持久 launch/control”明确分期。

## What Changes

- 将 owner-fit 定为 `split-owner`：Ordo 保持 canonical Agent orchestration owner；DSH 保持单租户 Harness runtime 与 Cordis 生命周期 owner；Workbench 保持多租户产品体验 owner；未来 `agent/harness-plugins` 只拥有 adapter、manifest、打包与 conformance。
- 定义版本化 `ordo.agent_ops` 插件投影，覆盖 run、task DAG、attempt/session、runtime route、capacity、writer lease/worktree/fence、approval/attention、verification/evidence、closeout 和安全 action descriptor。
- 定义 snapshot + event cursor + reconcile 消费模型；event gap、tenant switch、membership/config/runtime generation 漂移时 fail closed 并重读 authoritative snapshot。
- 为 DSH 设计预构建 Cordis host plugin、Web client module 和 profile bundle：在 DSH 原生侧栏/面板提供轻量值班台，通过 ToolView 显示单次工具动作，通过深链进入 Workbench 完整 Studio；不修改 DSH core。
- 为 Workbench 设计完整 Agent Ops Studio：DAG/任务表、运行时间线、worker/session inspector、lease/worktree map、approval inbox、verification/evidence 和 reconcile drawer。
- 首个 delivery slice 交付只读 snapshot、实时事件、approval inbox、owner-authored reconcile；launch、re-dispatch、cancel、扩容和自动 takeover 必须等待 Ordo durable reservation、canonical repository authority 与 fencing 合同。
- 所有动作复用 `enterprise-harness-platform-v1` 的 `harness.action.v1alpha1`、receipt、approval、idempotency 和 unknown/reconcile 语义，不允许浏览器或插件提交 arbitrary command、argv、env、URL、host path 或 generic bearer。
- 本 change 是 DeepSeek Harness 子项目的实现规格：交付 DSH host plugin、Web client module、profile bundle、ToolView 和测试 handoff；Ordo、Workbench、Harness Plugins 的 canonical 实现仍进入各自 owner OpenSpec。

## Admission Decision

结论：`split-owner`。

| 能力 | Canonical owner | 消费方 | 禁止越界 |
| --- | --- | --- | --- |
| Run/DAG/task/session/lease/approval/verification/evidence | `agent/ordo` | DSH、Workbench、Harness Control Plane | 客户端和 adapter 不创建平行状态机 |
| DSH runtime、Cordis plugin 生命周期、对话/session log | `client/deepseek-harness` | DSH 用户 | 不把多个 tenant 混入一个 profile/process |
| 插件 manifest、host mapping、打包、conformance | 候选 `agent/harness-plugins` | DSH、Pi、Workbench、headless | 不持久化 tenant 或 Ordo canonical facts |
| Tenant/workspace 安装、授权、runtime binding | 候选 `backend-server/harness-control-plane` | Workbench、DSH bridge | 不成为 scheduler 或 secret store |
| 完整多租户 Agent Ops 体验 | `client/yeisme-workbench` | 企业操作员、开发负责人 | 不保存 canonical Agent state |

## Required Capability Ledger

| 用户要求 / 能力 | 状态 | Canonical owner | 可见宿主 | 交付切片 | 验收证据 |
| --- | --- | --- | --- | --- | --- |
| Ordo DAG、task、session、run 可视化 | required | Ordo | DSH / Workbench | deliver-now | 同一 snapshot 在双端语义一致 |
| Agent team 与 runtime 路由查看 | required | Ordo | DSH / Workbench | deliver-now | runtime/model/effort/qualification/profile digest 可追溯 |
| writer lease、worktree、fence 查看 | required | Ordo | DSH / Workbench | deliver-now | retained/unknown lease 不被误显示为已释放 |
| 审批与 attention inbox | required | Ordo + approval owner | DSH / Workbench | deliver-now | exact scope/effect/expiry/owner 可见，decision 生成一个 owner receipt |
| Verification、evidence、closeout | required | Ordo | DSH / Workbench | deliver-now | terminal 状态链接 redacted evidence refs |
| Snapshot、事件、cursor 与断线恢复 | required | Ordo read contract | DSH / Workbench | deliver-now | duplicate 忽略、gap 重读、tenant switch 清空 |
| Safe reconcile | required | Ordo | DSH / Workbench | deliver-now | unknown/timeout 不自动重派，reconcile 后读取 authoritative 状态 |
| DSH 原生轻量 Agent Ops 插件 | required | Harness Plugins + DSH seams | DSH Web | deliver-now | bundle 安装/卸载不修改 DSH core |
| Workbench 完整 Agent Ops Studio | required | Workbench | Workbench | deliver-now | DAG、表格、时间线、lease、审批、证据组合工作流 |
| 多租户上下文与授权 | required | Identity + Harness Control Plane | Workbench / isolated DSH | dependency | 跨 tenant deny、context revision 漂移 fail closed |
| 最多 20 主进程容量展示 | required | Ordo capacity projection | Workbench / DSH | deliver-now/read-only | 明确标识 projected/qualified/reserved，不冒充真实 launch capacity |
| 持久 process reservation 与真实 launch | required/retained | Ordo + runtime owner | Workbench / headless | retain-next | crash/replay、reservation/lease/fence 一致，无重复 writer |
| Cancel、re-dispatch、takeover | required/retained | Ordo | Workbench；DSH gated | retain-next | unknown/cancel_unknown 必须 reconcile，禁止自动重复 execute |
| 插件签名、catalog、版本和 conformance | required/retained | Harness Plugins + Control Plane | 管理界面 | retain-next | digest/signature/SBOM/host compatibility fail closed |
| 漫剧、Eikona、Scaena 等 Ordo 背景任务联动 | required/retained | 对应 domain owner + Ordo | Workbench / DSH | retain-next | 领域 receipt 与 Ordo task lineage 互相引用，不复制领域状态 |

## Narrow First Delivery Slice

1. `ordo.agent_ops.snapshot.v1alpha1` 安全只读投影。
2. `ordo.agent_ops.event.v1alpha1` 单调 cursor 事件流和 snapshot reload。
3. DSH 侧栏值班台：当前 run、attention、task 摘要、lease、capacity、evidence、Open Studio。
4. Workbench 完整 Studio：DAG + table、timeline、inspector、approval、evidence、reconcile。
5. 只开放 server-authored `reconcile.request`；approval decision 仅在 Ordo owner contract 冻结后开放。
6. 不在本切片启动、重派或自动接管 Agent。

## Non-Goals

- 不在 DSH、Workbench、Harness Control Plane 或插件仓库中实现第二 scheduler、第二 lease ledger 或第二 task state machine。
- 不 fork DSH core，不依赖长期私有 patch；只使用 Cordis plugin、`dsh.client`、bundle/profile、slot、ToolView 和稳定 API seam。
- 不让一个 DSH process/profile/home 同时服务多个 tenant 或多个不相容 runtime subject。
- 不把 raw prompt、完整 transcript、provider payload、private tool arguments、absolute host path、PID、credential 或完整思维链投影到浏览器。
- 不把 timeout、HTTP 202、event disconnect、client crash 或 cancel request 映射为成功/已停止。
- 不在首版实现任意 shell、任意 URL proxy、自动扩容、自动 takeover、公共 marketplace 或生产部署。

## Capabilities

### New Capabilities

- `ordo-agent-operations-plugin`: Ordo Agent Ops snapshot、event、action、receipt、reconcile 与 canonical ownership 合同。
- `dsh-ordo-host-adapter`: Ordo 能力通过 DSH Cordis host plugin、Web client module、profile bundle 和 ToolView 接入的宿主合同。
- `ordo-visualization-experience`: DSH 轻量值班台与 Workbench 完整 Agent Ops Studio 的信息架构、状态、可访问性和一致性合同。

### Modified Capabilities

无。本 change 聚焦已有 `enterprise-harness-platform-v1` 的 Ordo/DSH 部分，不修改根稳定 spec；DSH 实现采用 additive plugin/client contract。

## Impact

- 根设计依赖：`../../../../openspec/changes/enterprise-harness-platform-v1/` 的 host adapter、Studio、action/receipt 与供应链边界。
- Ordo handoff：`agent/ordo/openspec/changes/ordo-agent-operations-projection-v1/`。
- DSH plugin 实现 owner：当前 change，路径为 `agent/harness-plugins/openspec/changes/ordo-dsh-plugin-visualization-v1/`；`client/deepseek-harness` 仅保留最小 upstream-aligned fork 补丁，不创建本地 OpenSpec task。
- Workbench handoff：`client/yeisme-workbench/openspec/changes/workbench-ordo-agent-ops-v1/`。
- Harness Plugins handoff：远程仓库与 submodule 获得明确授权后，建立 `agent/harness-plugins/openspec/changes/ordo-agent-ops-pack-v1/`。
- Control Plane handoff：`backend-server/harness-control-plane/openspec/changes/ordo-agent-ops-installation-v1/`，仅在该独立仓库获授权后创建。
- 当前 change 不修改 Ordo/Workbench canonical code，不创建远程仓库，不 commit/push/publish/deploy；DSH 代码实现与测试属于本子项目后续任务。
