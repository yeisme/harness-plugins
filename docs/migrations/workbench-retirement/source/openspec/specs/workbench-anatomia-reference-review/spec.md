# workbench-anatomia-reference-review Specification

## Purpose
TBD - created by archiving change workbench-anatomia-reference-review-v1. Update Purpose after archive.
## Requirements
### Requirement: Workbench SHALL 只消费 Anatomia typed projections

参考组件、gap、risk、时间码与动作入口 SHALL 来自 schema 校验通过的 typed projections。Workbench MUST NOT 读取 Anatomia/Scaena/Inferrum 数据库或私有文件，MUST NOT 建立第二份参考组件真源。session 内 memoization 允许；durable 缓存禁止。

#### Scenario: schema-invalid projection

- **WHEN** 投影校验失败
- **THEN** 该视图 SHALL 渲染 typed error state
- **AND** MUST NOT 部分渲染未校验条目

### Requirement: 覆盖层 SHALL 与当前源坐标一致

覆盖层位置与时间码 SHALL 相对当前播放源解析。源切换、版本不匹配或投影 stale 时 SHALL 重新解析或显式降级，MUST NOT 跨源外推坐标。缺证据区域 SHALL 显式标注 gap。

#### Scenario: 源切换

- **WHEN** 用户切换播放源而投影仍绑定旧源
- **THEN** 覆盖层 SHALL 降级为不匹配状态并提示恢复动作
- **AND** MUST NOT 用旧坐标在新源上渲染

### Requirement: 审阅动作 SHALL 走 owner-approved action surface

审阅/修正动作 SHALL 通过既有 typed action surface（action identity、expected version、side-effect class、receipt/reconcile）提交给 Anatomia owner operation。动作结果 SHALL 只形成 owner 侧 pending review；Workbench MUST NOT 替 owner 签收或写 canonical state。

#### Scenario: 提交审阅

- **WHEN** 用户在覆盖层提交审阅动作
- **THEN** Workbench SHALL 提交 typed action 并渲染 receipt
- **AND** Anatomia canonical state MUST NOT 被客户端直接变更

### Requirement: 可访问性与诚实状态 SHALL 达标

覆盖层与 risk queue SHALL 键盘可达；不确定状态（stale/degraded/unknown/gap）MUST NOT 只靠颜色表达，SHALL 携带文本/图标冗余编码。owner 不可用时 SHALL 渲染不可用状态与恢复动作，不渲染猜测数据。

#### Scenario: degraded 状态

- **WHEN** Anatomia 投影 degraded
- **THEN** 相关组件 SHALL 显示 degraded 徽标与文本说明
- **AND** 其余不受影响的组件 SHALL 正常渲染

