## ADDED Requirements

### Requirement: Director Workspace SHALL 在 `/agent` 内提供媒体优先结构化语义画布

Workbench SHALL 在现有 `/agent` Unified Spatial Creative Runtime 内组合 AI Drama Director Workspace，按 `Show -> Episode -> Scene -> Shot/Asset` 组织可缩放语义关系，以镜头缩略图、序列预览和媒体比较为主要视觉层。画布 MUST NOT 恢复已退役的独立 Show Control Room 路由，MUST NOT 新增独立 top-level 路由，且 MUST NOT 实现第二套完整 NLE timeline。

#### Scenario: 用户新建或继续一部剧

- **WHEN** 用户在没有显式选择 terminal-first 工作方式时新建或重新打开 show
- **THEN** `/agent` SHALL 默认进入 AI Drama Director Workspace 模式
- **AND** SHALL 恢复最近的 show、episode、scene、selection 与未决 decision refs（均为 owner refs）

#### Scenario: 语义画布渲染

- **WHEN** owner 安全投影提供 show/episode/scene/shot 的 `DramaContextRef` 与 `ArtifactRef`
- **THEN** 画布 SHALL 按结构化层级渲染节点与边，镜头缩略图与序列预览为主视觉
- **AND** MUST NOT 从自由节点文本推断缺失的领域关系

### Requirement: 画布本地状态 MUST NOT 成为领域 canonical truth

画布布局、相机位置、选区与展开状态 MAY 在 Workbench 本地保存与恢复；节点 identity、领域关系与接受终态 MUST 只来自 owner 安全投影，并 MUST 携带 owner、version 与 freshness。Workbench MUST NOT 将画布本地状态写回任何领域 owner。

#### Scenario: 用户选择一个场景

- **WHEN** 用户在语义画布选择 scene
- **THEN** Workbench SHALL 同时定位关联 shots、assets、review decisions 与 delivery readiness
- **AND** SHALL 通过 owner refs 获取预览与证据
- **AND** MUST NOT 因 owner projection 缺字段而本地补全领域关系

#### Scenario: owner 版本漂移

- **WHEN** 画布持有的 projection version 与 owner 当前 version 不一致
- **THEN** Workbench SHALL 标记 stale 并 refetch 安全投影
- **AND** MUST NOT 用本地画布状态覆盖 owner 状态或伪造 freshness

### Requirement: Workbench SHALL 作为共享决策箱的视觉批准 consumer

Workbench SHALL 消费 owner-authored decision token 的 typed action 与 receipt，覆盖费用、版权、canonical acceptance、外编实际应用与 final export；Workbench MAY 呈现 visual diff 作为主要批准面。同一 decision identity MUST 只产生一个权威终态；所有 decision mutation MUST 经 `TaskService` 的 permission、cost、expected-version 与 idempotency gate，MUST NOT 在浏览器或 SDK 建立第二套本地审批状态机。

#### Scenario: 用户在 Workbench 接受外编差异组

- **WHEN** 用户对仍有效的 decision token 在 Workbench 执行 accept
- **THEN** owner SHALL 返回可查询 receipt
- **AND** Workbench SHALL 刷新为同一终态
- **AND** MUST NOT 创建第二个本地批准记录

#### Scenario: 决策已由 DSH 完成

- **WHEN** Workbench 提交一个已经终态化的 decision token
- **THEN** owner SHALL 幂等返回原 receipt 或明确返回 stale/already_decided
- **AND** Workbench SHALL refetch，而不是重复 mutation

#### Scenario: 本地选中状态不等于接受

- **WHEN** 用户在画布或 inbox 本地 dismissed 或 selected 一个 decision 但未提交
- **THEN** 该状态 SHALL 只影响本地展示
- **AND** MUST NOT 被记录为 accepted 或被任何 owner receipt 引用

### Requirement: 精确时间线操作 SHALL 进入受控外编 handoff

用户请求 frame-level trim、track editing、transition、effect 或 color 操作时，Workbench SHALL 提供受控外编 handoff 或既有 owner action，导向 Scaena delivery bundle 与 editor round-trip 流程；Workbench MUST NOT 在画布内实现第二套 NLE timeline，MUST NOT 读写编辑器私有工程格式。

#### Scenario: 用户请求精确修剪

- **WHEN** 用户对 shot 请求 frame-level trim
- **THEN** Workbench SHALL 呈现外编 handoff action（打开 Scaena delivery bundle 流程）
- **AND** MUST NOT 在画布内创建 timeline 编辑状态

#### Scenario: Scaena 返回分组差异供审阅

- **WHEN** Scaena 投影返回按 scene/track/change type 分组的 semantic diff 与 quarantine report
- **THEN** Workbench SHALL 以视觉 diff 呈现支持组并标注隔离组
- **AND** 分组 accept/reject SHALL 通过共享决策箱的 decision token 提交

### Requirement: Director Workspace SHALL 提供 UI 与 e2e 证据

Director Workspace 的语义画布渲染、决策箱状态转换与外编 handoff 路径 SHALL 具备可重复 UI/e2e 证据：组件级 golden snapshot、状态转换 golden 与 Playwright e2e；e2e 与 integration 运行 SHALL 按本仓约定写 `temp/integration-test-runs/<run-id>/`，并 MUST NOT 包含 secret、token、raw prompt、provider payload、绝对路径或完整思维链。

#### Scenario: 画布关键状态 golden 通过

- **WHEN** 语义画布的关键渲染状态与选区状态运行组件 golden 测试
- **THEN** 所有 golden SHALL 通过且无未评审的视觉漂移
- **AND** 状态转换逻辑 SHALL 由确定性 `update(state, event)` / `render(state)` 测试覆盖

#### Scenario: e2e 覆盖建剧到外编 handoff

- **WHEN** Playwright e2e 执行从进入 Director Workspace、打开 decision、执行 handoff 到刷新 receipt 的完整路径
- **THEN** 运行 SHALL 在 `temp/integration-test-runs/<run-id>/` 写入脱敏 summary、命令、日志与 artifacts
- **AND** 失败运行 SHALL 保留证据并以原始 exit code 退出
