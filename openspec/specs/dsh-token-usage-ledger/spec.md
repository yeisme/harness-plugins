# dsh-token-usage-ledger Specification

## Purpose
TBD - created by archiving change dsh-token-usage-panel-v1. Update Purpose after archive.
## Requirements
### Requirement: Host 是跨会话 token 账本的唯一 writer
系统 SHALL 在 Host 插件内维护进程级用量账本。账本 MUST 只折叠 DSH 已发布的会话 `projectionValues.tokenUsage` disjoint buckets（`uncachedInputTokens`、`outputTokens`、`cacheReadTokens`、`cacheWriteTokens`）。Host MUST NOT 重放 session log、MUST NOT 自建 tokenizer、MUST NOT 把 `reasoningTokens` 再加进总量。Client MUST NOT 写入账本。

#### Scenario: 会话报告新的 tokenUsage
- **WHEN** 某会话的 `tokenUsage` 四桶之和相对 Host 上次观察值增加
- **THEN** Host SHALL 把增量累加到该会话、对应提供方、当日 UTC 窗口、当周 UTC 窗口与进程总量

#### Scenario: 同一 turn/step 被官方投影替换
- **WHEN** 官方 `tokenUsage` 对同一会话给出替换后的 totals（非双计）
- **THEN** Host SHALL 按与上次快照的差分解增量，MUST NOT 把替换样本再加一遍

### Requirement: 有界安全用量投影
`tokenUsage.snapshot()` 成功时 SHALL 返回 `token.usage.snapshot.v1alpha1`，包含当前会话（若有）、today/week/process 窗口、有界 `bySession`（默认最多 20）与 `byProvider`。`sessionRef` 与 `label` MUST 满足 safe ref/label 规则。列表被截断时投影 MUST 带 `truncated: true`。投影 MUST NOT 包含 API key、路径、URL、raw prompt 或 provider payload。

#### Scenario: 超过 20 个有用量会话
- **WHEN** 进程内有用量会话数大于 20
- **THEN** `bySession` SHALL 最多 20 条且 `truncated` 为 true，Client MUST NOT 把列表渲染成完整账本

#### Scenario: 会话离开列表
- **WHEN** 某会话不再出现在 `sessions.list`
- **THEN** 已计入窗口的用量 SHALL 保留，Host MUST NOT 从 today/week/process 中扣减

### Requirement: 进程账本语义对用户可见
系统 SHALL 把账本范围表述为自当前 Host 进程启动以来。Host 重启后第一次观察到的会话 `tokenUsage` totals SHALL 作为初始增量计入，MUST NOT 在 Client 再估算一份历史。缺失 `tokenUsage` 的会话 MUST 跳过，MUST NOT 记 0。

#### Scenario: Host 重启后首次快照
- **WHEN** Host 进程启动且某会话已有非零 `tokenUsage`
- **THEN** 该 totals SHALL 计入进程账本一次，面板文案 SHALL 标明 since process start

#### Scenario: 会话没有 tokenUsage 投影
- **WHEN** 会话摘要缺少 `projectionValues.tokenUsage`
- **THEN** Host SHALL 跳过该会话，MUST NOT 为其写入全 0 桶

