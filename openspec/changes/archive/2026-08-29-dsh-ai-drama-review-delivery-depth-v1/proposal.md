## Why

全剧控制台建立后，审片仍缺少长音频时间轴、owner-provided transcript/caption 导航、帧/时间点/区域批注、跨集版本比较和更完整的 Delivery evidence。需要在不把媒体内容、批注批次或交付状态变成浏览器事实的前提下补齐专业审阅深度。

## What Changes

- 为音频增加 lazy WaveSurfer Timeline/Regions enhancer、owner-provided transcript/caption 导航和长音频 native fallback。
- 将 Review Inbox 与 selection-annotation owner 合同组合，支持 frame/time/region anchors 与批注 batch handoff。
- 增加 image/video/audio 跨 episode/version compare，始终使用独立 artifact/version keys。
- Delivery 增加版本差异、rights/evidence 检查和 owner receipt history projection。
- 补齐 caption、长音频、annotation、compare、delivery unknown/reconcile 和 lifecycle 集成证据。

## Capabilities

### New Capabilities

- `dsh-rich-media-review-timeline`: 可降级音频时间轴、regions、caption/transcript 导航和安全生命周期。
- `dsh-ai-drama-review-annotation`: Review Inbox 与 selection owner 的 frame/time/region annotation 和 batch handoff。
- `dsh-ai-drama-delivery-depth`: 跨集比较、delivery version/rights/evidence 与 receipt history 投影。

### Modified Capabilities

- `dsh-selection-agent-review`: 新增 Drama Review Inbox 作为既有 annotation/batch/agent handoff 的受限 consumer。

## Impact

- 影响 Rich Media、Selection Annotation、AI Drama Director Client/Host 及集成 evidence runner。
- 重型媒体依赖保持 lazy boundary；无 owner peaks/transcript/caption 时诚实回退 native player。
- 不创建 annotation ledger、delivery ledger、浏览器媒体 store 或自动 retry。
