# dsh-ai-drama-exception-director Specification

(merged from archived change 2026-08-30-dsh-ai-drama-exception-director-v1)

## Purpose

定义 DSH AI Drama 的异常优先导演投影、共享 decision token、Workbench/外编 typed handoff 与旧 operational panes 兼容边界，确保插件只组合 owner 事实和动作，不复制领域状态或批准真相。

## Requirements

### Requirement: DSH `/drama` SHALL 默认呈现异常优先导演投影

默认 `director` preset SHALL 只保留 Context、Review、Run，默认投影 SHALL 呈现当前 context、primary blocker、影响范围、owner reason、一个 owner-approved next action 与必要的 Review/Run/Delivery 深链。默认投影 MUST NOT 要求用户先浏览完整全剧控制台，MUST NOT 复制 Workbench 语义画布/scene graph、Scaena `EditRevision`/delivery bundle 或 Ordo run/task/lease/approval ledger。

#### Scenario: 用户在 DSH 打开 `/drama` 且存在阻塞

- **WHEN** 用户打开 `/drama` 且当前 context 存在阻塞或待决定项
- **THEN** DSH SHALL 优先展示该阻塞、影响范围、owner reason 和一个允许动作
- **AND** MUST NOT 要求用户先浏览完整全剧控制台

#### Scenario: 存在多个阻塞

- **WHEN** 当前 context 存在多个待决定项
- **THEN** 默认投影 SHALL 只呈现排序后的首个阻塞与一个 next action
- **AND** SHALL 提供其余项计数与进入 Workbench 的深链

#### Scenario: owner 不可用或状态未知

- **WHEN** owner projection 不可用、unknown、partial 或 stale
- **THEN** DSH SHALL 显示 typed 状态并禁用 mutation
- **AND** MUST NOT 自动 retry、替换 writer 或从展示状态推断 owner 终态

### Requirement: DSH SHALL 消费与 Workbench 相同的共享 decision token

费用、版权、canonical acceptance、外编实际应用与 final export SHALL 使用与 Workbench 相同的 owner-authored decision token、typed action 与 receipt；DSH MAY 以文本化摘要处理相同 token，提交 MUST 经 server-minted 的 exact target/effect/owner/expiry preview 与 CAS。同一 decision identity MUST 只产生一个权威终态；DSH MUST NOT 建立本地审批状态机或第二个批准记录。

#### Scenario: 用户在 DSH 接受外编差异组

- **WHEN** 用户在 DSH 对一个仍有效的 decision token 执行 accept
- **THEN** owner SHALL 返回可查询 receipt
- **AND** DSH SHALL 刷新为同一终态
- **AND** MUST NOT 再创建第二个本地批准记录

#### Scenario: 决策已由 Workbench 完成

- **WHEN** DSH 提交一个已经终态化的 decision token
- **THEN** owner SHALL 幂等返回原 receipt 或明确返回 stale/already_decided
- **AND** DSH SHALL refetch，而不是重复 mutation

#### Scenario: digest 或 context revision 漂移

- **WHEN** 提交时 digest/context revision 与 owner 当前状态漂移
- **THEN** action SHALL 返回 stale 并禁用 mutation
- **AND** MUST NOT 自动近似转换或 last-write-wins

### Requirement: DSH SHALL 通过 Bridge V2 语义转交 Workbench 与外编流程

DSH 触发 Open in Workbench 或外编 handoff 时 SHALL 只传递版本化 `DramaContextRef`、`ArtifactRef`、`ActionIntent`、`ReceiptRef` 与 launch ref；MUST NOT 扩展 raw path、token、credential、editor payload 或领域对象。进入目标端后 SHALL 由目标端重新鉴权并向 owner refetch 安全投影，DSH 缓存 MUST NOT 被当作 canonical state。

#### Scenario: 用户从 DSH 打开 Workbench

- **WHEN** 用户在 DSH 选择 show/episode context 并触发 Open in Workbench
- **THEN** DSH SHALL 只传递版本化 context refs、presentation intent 和允许的 launch ref
- **AND** Workbench SHALL 重新鉴权并向 owner refetch 安全投影
- **AND** MUST NOT 把 DSH 缓存当作 canonical state

#### Scenario: 浏览器或命令行拼接 raw 输入

- **WHEN** handoff 请求携带 raw route/URL/绝对路径而非交换得到的 typed refs
- **THEN** DSH SHALL 拒绝该输入并返回 typed reason code
- **AND** MUST NOT 打开目标端或产生 owner mutation

### Requirement: 旧全剧 operational panes SHALL 在兼容窗口内保留

既有 DSH 全剧 operational panes SHALL 在不少于两个连续插件发布窗口内作为 legacy/advanced 兼容视图保留：继续读取相同 owner projection，显示 deprecation 文案与 Workbench handoff，并记录使用率。兼容视图 MUST NOT 被静默删除、改义或用于覆盖 owner receipt；其退役 MUST 由后续独立 removal change 处理（consumer evidence、deprecation window 与 rollback）。

#### Scenario: 旧全剧 Pane 仍被使用

- **WHEN** 已有 profile 在兼容窗口内直接打开 DSH full-show operational pane
- **THEN** pane SHALL 继续读取相同 owner projection 并显示 deprecation/Workbench handoff
- **AND** SHALL NOT 被静默删除、改义或用于覆盖 owner receipt

#### Scenario: 兼容窗口内回滚默认叙事

- **WHEN** exception-first 默认投影需要回滚
- **THEN** 系统 SHALL 恢复旧导航优先级
- **AND** MUST NOT 迁移、删除或回写任何 owner state
