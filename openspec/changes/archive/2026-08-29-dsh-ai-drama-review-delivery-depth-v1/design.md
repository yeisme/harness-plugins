## Context

Rich Media 已有 native audio/video、owner peaks、chapters、captions、HLS 和 lifecycle，但 WaveSurfer timeline/regions、transcript navigation 与长音频测试仍缺；Selection Annotation 已有 owner batch 合同但未接入 Drama Review；Delivery 只有基础 readiness，没有版本/rights/evidence/receipt history 深度。

## Goals / Non-Goals

**Goals:**

- 增强专业审片而保持重依赖 lazy、owner content 安全和 native fallback。
- 复用 selection owner 做 frame/time/region annotations 与 batch handoff。
- 增加跨集版本比较和 Delivery 深度投影。

**Non-Goals:**

- 不在浏览器全量 decode 长音频、解析任意 transcript 或持久化 media bytes。
- 不创建 annotation/delivery ledger，不自动执行 repair/export。

## Decisions

1. WaveSurfer 通过注入式 lazy loader；只有 owner 提供 bounded peaks 时启用 Timeline/Regions，失败回退 native audio 与等价 time controls。
2. Transcript/caption 由 owner 提供有界 cue projection；Client 不下载或解析任意私有 track URL。
3. Review Inbox 只构造 Selection Anchor 请求并交给 selection owner；batch id、marker、proposal 与 receipt 由现有 owner 维护。
4. Compare 使用 artifact ref + version key，复用 Rich Media compare；不把源 URL 存入 Pane state。
5. Delivery history 是 owner receipt projection，按 version/freshness 展示，不推导 canonical delivery state。

## Risks / Trade-offs

- [WaveSurfer/CSP 不可用] → native fallback 与可见 reason。
- [跨媒体 annotation 坐标差异] → 使用 typed frame/time/region anchor union，拒绝未知坐标。
- [Delivery owner partial] → 分段 freshness，mutation 全禁用并要求 reconcile。

## Migration Plan

全部为 additive renderer/consumer/projection；功能 probe 可独立关闭。回滚后 native player、现有 Review Inbox 和基础 Delivery 保持工作。

## Open Questions

无；DRM、PiP、browser fullscreen 与 client transcript parser 不进入 V1。
