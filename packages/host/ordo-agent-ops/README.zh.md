# @yeisme/dsh-host-ordo-agent-ops

[English](README.md) | 中文

Ordo Agent Ops 投影的只读 Host Remote。该服务只暴露 `ordoAgentOps/snapshot`，不创建 scheduler、run ledger、lease ledger，也不合成 terminal 状态。

服务端会在 gateway 构造前向同一个 Host Context 注入 `ordoAgentOpsExpectedContext`，其中包含 tenant、workspace、principal、context revision 和 installation refs。gateway 只在构造时校验、脱离复制并冻结该值，在当前进程生命周期内不再读取替换后的 Context key。只有 owner snapshot 携带相同的完整 context 时才可暴露 ready 或 stale facts；expected context 缺失或非法时返回 `needs_contract`，owner context 缺失、漂移或非法时返回 `contract_mismatch`。所有降级投影都不包含 run 或 capacity facts。

未来的 Ordo owner adapter 可以向同一个 Host Context 提供 `ordoAgentOpsOwner`。在 owner source 尚未挂载时，Remote 返回带有 `owner_read_contract_unavailable` 的 `needs_contract`；这是 focused/local、owner-gated 证据，不表示 Ordo provider、deployment 或 production 已连接。AccessTicketBinding 到 expected context 的组合仍由 Control Plane owner-gated handoff 负责；本包不从 ticket 或 browser input 推导 context，也不实现 OAuth、cloud agent、sandbox 或 durable revocation。

## 模型体验

无。本包不注册提示词、工具或模型可见输出。

#### KV Cache 影响

无；本包不组装模型输入。

## 已知限制与暂缓工作

- 本包不连接 Ordo，不观察 OS 进程，不预留容量，也不启动 runtime。
- 事件 cursor、reconcile 动作、AccessTicketBinding 组合、租户授权和持久 reservation 仍由 Ordo 与 Harness Control Plane handoff 负责。
- fallback projection 刻意不包含 run、lease、worktree、capacity 或 evidence 事实。
