# dsh-ai-drama-review-annotation Specification

## Purpose
Define version-fenced frame/time/region annotations and selection-owner batch handoff from the Drama Review Inbox.

## Requirements

### Requirement: Review Inbox SHALL hand typed anchors to the selection owner
Review Inbox SHALL 支持 frame、time 和 region anchor，并通过 selection owner API 创建/提交 annotation batch；Drama Client MUST NOT 持有 batch ledger。

#### Scenario: User annotates a video frame
- **WHEN** 用户在 artifact version 的某 frame 添加批注
- **THEN** Client SHALL 提交含 artifact ref/version/frame anchor 和 bounded note 的请求，selection owner SHALL 返回 batch/anchor projection

### Requirement: Annotation handoff SHALL be version-fenced and receipt-gated
annotation batch 到 repair/agent 的 handoff MUST 携带 owner batch ref、artifact versions 和 idempotency key，并展示 owner proposal/receipt。

#### Scenario: Artifact changes before handoff
- **WHEN** 任一 anchor 的 artifact version 已变化
- **THEN** handoff SHALL 返回 reconcile_required，MUST NOT 自动迁移 anchor 或提交旧批次
