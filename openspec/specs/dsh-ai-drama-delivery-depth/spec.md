# dsh-ai-drama-delivery-depth Specification

## Purpose
Define owner-projected delivery differences, rights/evidence readiness, cross-episode comparison, and receipt-only action history.

## Requirements

### Requirement: Delivery pane SHALL expose version, rights, evidence and receipt projections
Delivery SHALL 展示 owner-provided deliverable version、readiness、rights summary、evidence refs、blockers 和 bounded receipt history；Client MUST NOT 推导 canonical delivery state。

#### Scenario: One deliverable has a rights blocker
- **WHEN** owner projection 标记 rights 未满足
- **THEN** Delivery SHALL 显示 blocker 与 owner remediation action，submit SHALL disabled

### Requirement: Cross-episode compare SHALL preserve artifact/version identity
image、video 和 audio compare MUST 使用独立 episode/artifact/version keys，并通过 owner-authorized access 解析每一侧。

#### Scenario: Compare versions from two episodes
- **WHEN** 用户选择两个兼容 artifact refs
- **THEN** compare view SHALL 显示 episode/version labels，任一 side stale 时 SHALL 禁用 mutation 但保留只读差异

### Requirement: Delivery action history SHALL reflect owner receipts only
prepare/submit/export 的历史 SHALL 来自 owner receipts，unknown/partial/reconcile 状态 MUST 原样可见且不得自动重试。

#### Scenario: Delivery submit settlement is unknown
- **WHEN** owner 未确认 settlement
- **THEN** history SHALL 记录 unknown receipt projection，submit SHALL 禁用直到 fresh snapshot reconcile
