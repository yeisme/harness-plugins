# spatial-replica-synchronized-review Specification

## Purpose
TBD - created by archiving change workbench-spatial-replica-review-v1. Update Purpose after archive.
## Requirements
### Requirement: Episode 与 shot navigation 必须保持 owner identity

Replica workspace SHALL 使用 owner-safe project/episode/scene/shot refs 进行导航，并展示每个选中对象的 owner、version 和 currentness。Workbench MUST NOT 通过标题、数组位置或本地重排生成新的 canonical hierarchy。

#### Scenario: 用户切换到另一个 shot

- **WHEN** 用户从 episode 导航选择一个已授权 shot
- **THEN** Workbench SHALL 以 exact shot ref 加载新的 projection、media、stage 和 timeline
- **AND** SHALL 清除不适用于新 shot 的 selection、draft 与 renderer resources

#### Scenario: Shot 已在 owner 侧删除或重映射

- **WHEN** deep link 中的 shot ref 不再 current
- **THEN** Workbench SHALL 显示 stale/not_found 与 owner recovery action
- **AND** SHALL NOT 自动选择同名 shot

### Requirement: Source、overlay、3D 与 timeline 必须共享 exact PTS 语义

Workbench SHALL 使用 Anatomia 提供的 PTS/timebase/frame map 同步 source video、evidence overlays、Scaena camera/actor pose 和 timeline cursor。VFR、cut、gap、duplicate frame 或 discontinuity MUST NOT 使用 `time * fps` 推算；浏览器应使用 `requestVideoFrameCallback` 或等价媒体帧确认机制更新 confirmed cursor。

#### Scenario: VFR source 正常播放

- **WHEN** video callback 确认当前 source presentation timestamp
- **THEN** overlay、3D pose 和 timeline SHALL 解析到同一 PTS interval
- **AND** confirmed drift SHALL 不超过一个 source frame

#### Scenario: PTS map 存在 gap

- **WHEN** 当前播放位置无法映射到可验证的 evidence/stage sample
- **THEN** Workbench SHALL 保留 source playback 并显示 `sync_degraded`
- **AND** SHALL 隐藏或冻结不可验证的 overlay/3D sample，不得插值成 evidence claim

### Requirement: Evidence layer 必须显示来源、时间与坐标元数据

Grayscale、depth、mask、optical flow、skeleton、camera 和 quality layer SHALL 各自声明 source artifact ref、Snapshot/bundle lineage、PTS coverage、coordinate frame、unit/scale、quality/currentness 和 limitations。Preview rendition MUST 与 numeric artifact 明确区分。

#### Scenario: 用户打开 depth overlay

- **WHEN** depth layer 具有授权 preview 与 numeric metadata
- **THEN** player SHALL 显示 preview
- **AND** Inspector SHALL 显示 depth type、单位/尺度层级、坐标系、lineage、quality 和 limitations

#### Scenario: Layer metadata 不完整

- **WHEN** mask 或 depth preview 可加载但 coordinate/unit/provenance 缺失
- **THEN** Workbench SHALL 将其标为 display-only/claim-limited
- **AND** SHALL 禁止从该 preview 推导 metric 或 production-ready claim

### Requirement: 3D viewport 必须只渲染 Scaena 安全 stage projection

Viewport SHALL 通过 lazy-loaded narrow adapter 渲染 owner-authorized camera、proxy geometry、actor placeholders、skeleton/rig pose、ground/contact、occlusion 和 completion candidate summary。Renderer MUST NOT 解释私有 Scaena files，Three 类型 MUST NOT 进入 wire contract，且每个 selectable object SHALL 保留 owner ref/provenance。

#### Scenario: ReplicaStage primitive graph 可用

- **WHEN** Scaena 返回 browser-budgeted safe stage projection
- **THEN** viewport SHALL 按 owner coordinate/scale metadata 渲染 camera、scene proxies 与 actor poses
- **AND** object selection SHALL 映射回 exact owner ref

#### Scenario: Stage 超过 browser budget

- **WHEN** owner 声明的 primitive、texture、joint 或 artifact budget 超过 client capability
- **THEN** Workbench SHALL 显示 `view_too_large` 和结构化 summary/deep link
- **AND** SHALL NOT 静默丢弃几何后继续声称场景一致

### Requirement: Timeline 必须虚拟化并保留 track provenance

Timeline SHALL 支持 camera、actor、joint、keyframe、contact、occlusion、audio、quality 和 receipt tracks，按 PTS range 虚拟化可见事件。每个 event MUST 携带 source owner/ref/version 和可访问的文本标签；scrub、step-frame、jump-event 和 selection MUST 有 keyboard 等价路径。

#### Scenario: 长 shot 包含大量 joint samples

- **WHEN** timeline 加载超过当前 viewport 的大量 samples
- **THEN** client SHALL 只实例化可见窗口及 bounded overscan
- **AND** SHALL 保持 exact PTS seek 与 event provenance

#### Scenario: 键盘跳转 contact event

- **WHEN** keyboard user 在 event list 选择 contact 事件并执行跳转
- **THEN** player、3D pose、timeline cursor 和 Inspector SHALL 定位到同一 PTS
- **AND** focus SHALL 移至可预期的事件或 Inspector 标题

### Requirement: Inspector 必须区分四层真相与 claim ladder

Inspector SHALL 分别展示 `Evidence`、`Candidate`、`Production Override`、`Frozen`，并显示 unknown、selected completion、capture profile、scale tier、quality/currentness、allowed claim 和 limitation。候选被选中 MUST NOT 删除或改写 unknown evidence；Frozen 只表示 owner receipt 确认的冻结版本。

#### Scenario: 用户选择 completion candidate

- **WHEN** Scaena owner receipt 确认某 completion candidate 成为 selected production override
- **THEN** Inspector SHALL 在 Production Override 层显示它及其 provenance
- **AND** Evidence 层的 unknown/occluded 区域 SHALL 保持可见

#### Scenario: Metric claim 不被支持

- **WHEN** capture profile 只允许 relative scale 或 approximate placement
- **THEN** Inspector SHALL 禁止显示“一比一 metric replica”结论
- **AND** SHALL 展示允许 claim 与升级所需 evidence

### Requirement: Spatial inquiry 必须返回证据化答案

Workbench SHALL 将空间问答提交给 Anatomia typed inquiry capability。答案 MUST 包含 answer summary、Snapshot/bundle lineage、PTS/time range、coordinate/unit、confidence、limitations 和 evidence refs；Workbench MUST NOT 存储 raw reasoning、raw prompt 或 Provider payload，也不得让回答直接修改 canonical evidence/stage。

#### Scenario: 用户询问人物与桌面的距离

- **WHEN** Anatomia 返回具有 scale tier、坐标系和 evidence refs 的 inquiry result
- **THEN** Workbench SHALL 展示数值或区间、单位、时间范围、confidence 和 limitations
- **AND** SHALL 提供打开对应 evidence/selection 的动作

#### Scenario: Evidence 不支持答案

- **WHEN** inquiry result 为 unknown 或 claim scope 不允许 metric distance
- **THEN** Workbench SHALL 明确显示 unknown/insufficient evidence
- **AND** SHALL NOT 用 completion candidate 或视觉预览补成事实答案

### Requirement: Browser state 只能是可丢弃 presentation 与未提交 draft

Browser MAY 保存当前 PTS、overlay visibility、3D camera、selection、expanded groups、Pane layout 和当前 session 内的 typed edit draft。它 MUST NOT 把这些状态当作 owner confirmation；shot switch、logout、scope revoke 或 capability off 时 SHALL 清理不适用 state 和 resources。

#### Scenario: 用户旋转 3D camera

- **WHEN** 用户只改变 viewport orbit/zoom
- **THEN** 变化 SHALL 保持为 local presentation state
- **AND** SHALL NOT 生成 Scaena mutation 或 owner receipt

### Requirement: WebGL 不可用时必须保留完整审阅替代路径

WebGL initialization failure、context loss 或 reduced client capability SHALL 使 3D viewport truthful unavailable，但 source player、timeline event list、DOM object tree、Inspector、review/approval/reconcile 和 owner deep links MUST 继续可用。

#### Scenario: WebGL context 创建失败

- **WHEN** viewport adapter 无法创建 WebGL context
- **THEN** Workbench SHALL 显示原因与可恢复操作
- **AND** SHALL 提供可键盘操作的 object list、current pose summary 和时间跳转，不得显示空白 canvas

