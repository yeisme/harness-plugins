# dsh-rich-media-review-timeline Specification

## Purpose
Define lazy rich-media review timelines, owner-provided cue navigation, native fallback, and exact enhancer lifecycle.

## Requirements

### Requirement: Audio review timeline SHALL be lazy and safely degradable
音频 renderer SHALL 以 native audio 为 baseline；只有 owner 提供 bounded peaks 时才可 lazy 启用 WaveSurfer Timeline/Regions，核心 bundle MUST 不静态依赖 WaveSurfer。

#### Scenario: Long audio has no precomputed peaks
- **WHEN** owner 未提供 peaks 或 enhancer 加载失败
- **THEN** renderer SHALL 保留 native player 与等价 time controls，MUST NOT 在浏览器全量 decode

### Requirement: Transcript and caption navigation SHALL use owner cues
Transcript/caption navigation MUST 只消费 owner-authored bounded cues，包含 cue id、label/text summary、start/end time 和 version；不得从任意 URL 或正文推导。

#### Scenario: User activates a transcript cue
- **WHEN** cue version 匹配当前 artifact version
- **THEN** player SHALL 跳转到 bounded time，焦点与当前 cue 状态 SHALL 可访问

### Requirement: Timeline lifecycle SHALL release every enhancer resource
inactive、cross-root move、close、version switch、provider dispose 和 HMR MUST pause/destroy enhancer、listener、object URL 和 access handle。

#### Scenario: Audio view moves between regions
- **WHEN** Pane lifecycle suspend old host 后 activate new host
- **THEN** 任一时刻 SHALL 只有一个 live playback/enhancer instance
