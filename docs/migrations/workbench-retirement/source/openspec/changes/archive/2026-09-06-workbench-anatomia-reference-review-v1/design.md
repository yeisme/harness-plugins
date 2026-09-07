# workbench-anatomia-reference-review-v1 Design

## Context

根仓 anatomia-production-reference-reuse-program-v1 冻结的分工：Workbench 拥有"播放器、覆盖层、risk queue、动作入口"——只消费 typed projections/actions，无新客户端真源。Anatomia 拥有观察、审阅、参考组件与修正；Scaena 拥有生产审阅与采用。Workbench 的 spatial-replica owner panels/actions 管线（typed action identity、receipt、fail-closed）是现成的执行模式。

## Goals / Non-Goals

**Goals:**

- 用户能在播放器中定位参考组件（三类），查看 gap/risk/时间码，执行 Anatomia 审阅动作。
- 坐标变换一致：覆盖层与当前源的时间轴/二维站位一致。
- 可访问性与诚实状态：键盘可达；不确定状态不只靠颜色；stale/degraded 明确呈现。

**Non-Goals:**

- 不实现代码（本 change 只冻结规格）。
- 不读 Anatomia/Scaena/Inferrum 数据库或私有文件。
- 不替 owner 签收（审阅结果只形成 owner 侧 pending review）。
- 不建第二份参考组件真源或客户端缓存 registry。

## Decisions

### D1: 复用 owner-actions 管线

审阅动作走既有 typed action surface（action identity、expected version、side-effect class、receipt/reconcile），目标是 Anatomia 局部审阅/修正 operation。覆盖层渲染走 panels 投影管线。

### D2: 坐标变换锚定当前源

覆盖层位置与时间码 MUST 相对当前播放源解析；源切换/版本不匹配时重新解析或降级，不跨源外推动画坐标。二维站位/运动证据按 Anatomia 投影的时间 range 对齐，缺证据区域显式 gap 标注。

### D3: 诚实降级

owner 不可用、投影 stale、坐标不匹配时：渲染明确的状态（不可用/过期/不匹配）与恢复动作，不渲染部分猜测数据，不静默隐藏条目。

### D4: 无客户端真源

组件列表/状态每次从投影读取；session 内 memoization 允许，durable 缓存不允许（同 discovery 消费纪律）。

## Rollout / Migration Plan

1. Phase 1（实现 change）：projection client + 播放器定位 + 覆盖层（只读）。
2. Phase 2：审阅动作接线（owner-approved action surface）+ risk queue 视图。
3. 回滚：feature flag off；无数据迁移。

## Risks / Trade-offs

- Anatomia 投影 schema 尚未实现，规格以根设计为合同源，落地时在本 change 内对齐字段。
- 播放器时间轴精度与 Anatomia range 粒度差异需要在实现 change 中定义容差，不在此预猜。

## Open Questions

无阻塞项。
