## ADDED Requirements

### Requirement: DSH integration SHALL use official Cordis and client seams
Ordo DSH adapter SHALL 以预构建 Cordis host plugin、`dsh.client` Web module、profile/bundle patch 和必要 ToolView/command/tool contribution 交付。安装、卸载和 rollback MUST NOT 修改 DSH core source 或依赖私有 React store。

#### Scenario: Enterprise profile installs Ordo Agent Ops
- **WHEN** 固定版本的 Agent Ops bundle 被加入一个 DSH profile
- **THEN** `dsh --profile <profile> --dump-config` SHALL 显示 host/client contribution
- **AND** 移除 bundle SHALL 卸载 service、event subscription 和 UI，而无需修改 DSH core

### Requirement: One DSH runtime SHALL bind one tenant workspace and runtime subject
一个 DSH home/profile/process/runtime generation SHALL 默认只绑定一个 tenant、一个 Harness workspace 和一个 runtime subject。Adapter MUST NOT 在一个共享 DSH process 中根据 browser 参数切换多个 tenant 或复用前一 tenant 的 session、workdir、profile、credential 或 cache。

#### Scenario: User switches tenant from Workbench
- **WHEN** 用户选择另一个 tenant 并请求打开 DSH
- **THEN** 平台 SHALL 连接或启动目标 tenant 隔离的 DSH runtime instance
- **AND** SHALL NOT 把旧 tenant 的 profile/session/event cursor 复用到新 runtime

### Requirement: DSH Host SHALL capture server-injected expected context once
Host SHALL 在 `OrdoAgentOpsGateway` 构造时读取 `ordoAgentOpsExpectedContext`，并对 tenantRef、workspaceRef、principalRef、contextRevision 和 installationRef 执行 strict schema validation、detached clone 与 freeze。该绑定在当前进程生命周期内固定；后续 Context key replacement 不得改变它。expected context 缺失或非法时，Host SHALL 返回不含 run 或 capacity 的 `needs_contract`；owner snapshot context 缺失、非法、漂移或与其不完全一致时，Host SHALL 返回不含 run 或 capacity 的 `contract_mismatch`。`ready`/`stale` 之外的 owner state 携带 run 或 capacity 也 SHALL 被拒绝。

#### Scenario: Context key is replaced after gateway construction
- **WHEN** gateway 已捕获有效 expected context，随后 Context key 被替换为另一个 tenant、workspace、principal、revision 或 installation
- **THEN** gateway SHALL 继续仅按构造时固定的 expected context 校验 owner snapshot
- **AND** SHALL NOT 从 AccessTicketBinding、browser 参数或缓存重建 expected context

### Requirement: DSH host plugin SHALL own transport and subscription lifecycle
Browser client module SHALL 只消费 host plugin 提供的 typed safe projection。Host plugin SHALL 管理 tenant-bound access、snapshot/event cursor、backoff、dispose、runtime switch 和 bounded cache；浏览器 MUST NOT 直接持有 Ordo base URL、generic bearer、credential value 或 arbitrary fetch capability。

#### Scenario: Agent Ops bundle is hot reloaded
- **WHEN** DSH client or host plugin reloads/unmounts
- **THEN** adapter SHALL idempotently cancel subscriptions、pending requests、timers 和 stale callbacks
- **AND** replacement generation SHALL 从 authoritative snapshot 建立新 cursor

### Requirement: DSH SHALL provide a compact duty-panel experience
DSH Agent Ops surface SHALL 优先显示当前 run、attention/approval count、关键 task、writer lease/worktree、runtime qualification/capacity、最近 verification/evidence 和安全 deep link。它 SHALL NOT 复制 Workbench 的完整多 run admin、复杂 DAG 编辑或 tenant plugin management。

#### Scenario: User opens Agent Ops beside a conversation
- **WHEN** 当前 workspace 存在 active run
- **THEN** DSH SHALL 在不离开对话的情况下显示 compact run summary、freshness 和 attention
- **AND** 复杂图、多个 run 或完整 evidence SHALL 通过重新鉴权的 Workbench deep link 打开

### Requirement: DSH ToolView SHALL render individual Ordo tool actions
单次 inspect、approval、reconcile 或 evidence fetch 的工具调用 SHALL 使用现有 ToolView/`tool.call.toolview` presentation seam，并显示输入的安全摘要、owner status、receipt/evidence ref 和 unknown/reconcile 状态。ToolView MUST NOT 显示 secret、raw prompt、private arguments 或 arbitrary stdout。

#### Scenario: Reconcile tool returns still unknown
- **WHEN** Ordo reconcile 不能证明 attempt 已停止或 terminal
- **THEN** ToolView SHALL 显示 `still_unknown`、保留的 lease/capacity 与下一安全动作
- **AND** SHALL NOT 提供一键重复 dispatch

### Requirement: DSH and Workbench SHALL preserve semantic parity
同一 plugin release 和 Ordo resource 在 DSH 与 Workbench 中 SHALL 使用相同 status、reason code、freshness、permission、approval、action descriptor、receipt state 和 owner refs。布局差异 MUST NOT 改变动作资格或结果语义。

#### Scenario: Approval is visible in both clients
- **WHEN** DSH 和 Workbench 读取同一 approval projection
- **THEN** 两端 SHALL 显示相同 target、effect、owner、expiry、state 和 decision requirements
- **AND** 任一端完成 decision 后 SHALL reconcile 到同一个 owner receipt

### Requirement: DSH SHALL fail closed on context or contract drift
Membership revision、context revision、installation config、plugin digest、Ordo contract digest 或 runtime generation 漂移 SHALL 使旧 snapshot cursor、action descriptor、approval preview 和 pending dialog 失效。DSH SHALL 进入 stale/contract_mismatch 并重新获取安全 projection。

#### Scenario: Plugin release changes during an open approval dialog
- **WHEN** approval dialog 打开后 plugin release digest 变化
- **THEN** DSH SHALL 禁用原 decision controls 并关闭或标记 dialog stale
- **AND** SHALL 要求用户从新 release 和 snapshot 重新 review
