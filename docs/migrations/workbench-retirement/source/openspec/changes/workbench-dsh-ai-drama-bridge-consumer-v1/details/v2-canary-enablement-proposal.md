# DSH ↔ Workbench AI Drama Bridge V2 Canary Enablement 提案（任务 3.3）

## 1. 提案内容

在双侧以同一 fixtureVersion（`2026-08-29.1`，34 用例）conformance 全绿
（DSH 侧 plugin-complete 证据；Workbench 侧 evidence run
`temp/integration-test-runs/20260829145013-ed2190bc/` passed/redaction 0，
SDK 14/14 + task-sdk 全量 452/0，v1alpha1 零语义变更）的基础上，提请
release gate 批准 **V2 消费 canary 开启**：

- **范围**：单个 canary workspace（DSH 侧 allowlisted）内启用
  `workbench.harness.dsh_bridge.v2` 消费；其余 workspace 保持 alpha/legacy
  路径。
- **观察窗**：canary 期内监控 bridge 投影 freshness、fixture digest 漂移
  fail-closed 次数、V2 消费错误率与回退率。
- **晋级**：观察窗无 P0/P1 且 digest/契约稳定后按 release gate 流程逐
  workspace 扩量；任何漂移保持 fail-closed（不降级为本地状态）。

## 2. 回滚（已实现，不需新代码）

rollback = **关闭 V2 消费并回到 alpha/legacy 路径，不重写 owner 状态**：
capability flag 关闭后 bridge 投影入口消失，DSS/DSH 侧 owner canonical
状态与 v1alpha1 兼容面（保留至 DSH 侧 removal change）不受影响。

## 3. 请求签核

| 角色 | 批准对象 |
| --- | --- |
| product | canary 范围与观察窗 |
| security | fixture digest pin、fail-closed 语义、无 token/raw payload 面 |
| DSH 仓 owner | DSH 侧 canary allowlist 与 plugin 状态 |
| Workbench 仓 owner | V2 消费默认值与回滚演练 |

本提案为任务 3.3 的 deliverable；**勾选以四方签核为准**（外部门）。
