## Why

DSH Director Pack 已能签发 `drama.workbench-handoff.v1`，Workbench 也已有 `workbench.harness.dsh_bridge.v1alpha1`，但两套合同在字段、nonce 约束、目标入口和激活语义上不兼容；结果是 DSH 只能提示“去 Workbench 继续”，不能可靠地把创作上下文带入当前 `/agent` Spatial Creative Runtime。现在需要先冻结一条可演进、可回滚、跨仓可验证的 DSH → Workbench 做剧桥接合同，再继续扩展创作体验。

## What Changes

- 新增方向明确的 `dsh.workbench_ai_drama_bridge.v2` provider 合同，用安全 opaque ref、资源版本、展示意图、过期时间、32 位小写十六进制 nonce 和完整性摘要表达 DSH → Workbench handoff。
- 新增 host-authorized launch descriptor：DSH Client 只消费 host 批准的目标应用与参数，不拼接任意 URL；Workbench 在 `/agent` 入口重新解析、鉴权并 refetch owner 数据。
- 将 `open_show`、`open_episode`、`open_artifact`、`open_review`、`open_evidence` 映射到 Workbench Creative Production、Review、Evidence lens，目标不再是已退役的 Show Control Room。
- 保留 `drama.workbench-handoff.v1` 与 `workbench.harness.dsh_bridge.v1alpha1` 的兼容适配和可观测降级，至少覆盖两个连续 DSH 插件发布窗口；删除旧合同必须由后续独立变更完成。
- 明确 replay、过期、权限拒绝、版本冲突、stale/unknown 和合同不匹配的终态与 reconcile 行为，禁止浏览器自动重试或替换 owner/writer。
- 建立 DSH provider 与 Workbench consumer 的共享 conformance fixtures、跨仓证据清单和发布门，避免双方分别通过单仓测试但端到端不可用。
- 不新增 scheduler、task ledger、approval ledger、browser domain store、iframe bridge 或第二套 terminal state。

## Capabilities

### New Capabilities

- `dsh-workbench-ai-drama-bridge`: DSH → Workbench 做剧桥接 V2 的版本化合同、host 授权启动、空间 lens 映射、双栈迁移、失败语义与跨仓验收。

### Modified Capabilities

无。现有 `workbench-scenario-handoff` 继续描述兼容期内的 V1 行为；V2 以新 capability 和新 contract identity 增量引入，待实现、消费端落地并完成发布窗口后再单独同步或退役旧能力。

## Impact

- DSH provider：`packages/host/dsh-ai-drama-director` 的合同、校验、签发、能力探测和证据事件。
- DSH consumer UI：`packages/client/dsh-ai-drama-director` 的 handoff 激活、lens 意图展示、禁用原因和失败恢复。
- 安装面：`packages/bundle/dsh-ai-drama-director-pack` 的 capability declaration、兼容策略和文档。
- 稳定合同：新增 `dsh.workbench_ai_drama_bridge.v2`；旧合同不删除、不重定义。
- 外部消费者：Workbench `/agent` Spatial Creative Runtime 需要实现匹配的 server-side ingress、授权 refetch 和 conformance tests；该工作作为显式跨仓依赖，不由本仓库接管 Workbench owner state。
- 文档与发布：新增 CEO/产品/架构方案、迁移矩阵、回滚说明和跨仓验收清单。
