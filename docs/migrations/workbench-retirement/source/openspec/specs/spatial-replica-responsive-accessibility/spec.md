# spatial-replica-responsive-accessibility Specification

## Purpose
TBD - created by archiving change workbench-spatial-replica-review-v1. Update Purpose after archive.
## Requirements
### Requirement: 空间复刻 UI 必须先形成可验证 UI Spec

实现前 SHALL 在项目长期文档中冻结 information architecture、grayscale wireframes、component tree、control inventory、state matrix、responsive substitution、design tokens、accessibility contract、screenshot matrix 和 performance budget。UI MUST 复用 Workbench 既有 operations-console 视觉语言，禁止无信息价值的 hero、装饰性大卡片、过度圆角、渐变堆叠和伪仪表盘。

#### Scenario: 开始实现 Replica Pane

- **WHEN** implementation task 准备创建新 Pane/component
- **THEN** reviewer SHALL 能从 UI Spec 定位对应 region、control、state、breakpoint 与 acceptance evidence
- **AND** 未在 Spec 中定义的重大交互 SHALL 先回写设计而不是临场形成第二套模式

### Requirement: Responsive layout 必须使用能力替代而非等比缩小

Workbench SHALL 按明确 breakpoint 提供空间复刻审阅：`>=1800px` 可同时显示 source/3D/timeline 与辅助 Pane；`1440–1799px` 使用主 Pane 内 Source/3D tabs 并最多一个辅助 Pane；`1024–1439px` 使用 labelled Sheet 与 Source/3D/Timeline/Inspector tabs；`<1024px` 不挂载完整 3D editor，改用 player、event/object list、selection summary、review/reconcile 和 owner deep link。

#### Scenario: 1920px 宽桌面

- **WHEN** viewport 宽度至少 1800px 且 capability 可用
- **THEN** main Replica Pane SHALL 可同时展示 source、3D 和 timeline
- **AND** conversation/composer SHALL 保持可访问

#### Scenario: 390px 手机

- **WHEN** viewport 宽度小于 1024px
- **THEN** Workbench SHALL 不初始化完整 Three viewport/editor
- **AND** SHALL 提供 current frame、object/event list、Inspector summary、review/approval/reconcile 与 approved deep link

### Requirement: WebGL 内容必须具备 DOM accessibility mirror

每个可选择 camera、actor、joint、proxy、contact、occlusion 与 candidate SHALL 在 DOM 中具有稳定 label、role/state、owner/provenance summary 和 selection action。Canvas MUST 具有可描述的 accessible name，且不得是获取 stage 信息的唯一途径。

#### Scenario: Screen reader 浏览 scene objects

- **WHEN** user 进入 Replica viewport region
- **THEN** screen reader SHALL 能访问按语义分组的 object list 与 current selection details
- **AND** 选择 DOM item SHALL 与 canvas/timeline/Inspector selection 同步

#### Scenario: Canvas object 暂不可见

- **WHEN** object 被遮挡、在视锥外或 renderer unavailable
- **THEN** DOM mirror SHALL 仍表达其 owner state 与可用动作
- **AND** SHALL 标记 visual availability，而不是从 accessibility tree 静默消失

### Requirement: 所有关键操作必须具备 keyboard 与可预测 focus 行为

Episode/shot navigation、play/pause、frame step、seek event、overlay toggle、Source/3D switch、object search/select、Inspector open、draft edit、submit/confirm/cancel、review/freeze、reconcile 和 Pane close/open SHALL 可用 keyboard 完成。Dialog/Sheet MUST 定义 focus trap、Escape、initial focus 和 close return；desktop complementary Pane MUST NOT trap focus。

#### Scenario: Keyboard-only 完成 review

- **WHEN** user 不使用 pointer 从 shot navigation 进入 selected object 并打开 review dialog
- **THEN** 所有步骤 SHALL 有可见 focus 与明确 label
- **AND** dialog 关闭后 focus SHALL 返回触发控件或等价稳定位置

#### Scenario: Pane 被 owner revoke event 关闭

- **WHEN** active control 所在 Pane 因 permission revoke 被卸载
- **THEN** focus SHALL 移回 Agent shell 的安全 heading、conversation 或 Pane launcher
- **AND** SHALL 宣告 Pane unavailable 状态

### Requirement: UI 必须支持 200% zoom、reduced motion 与触控替代

在 200% browser zoom 下页面 MUST 保持可用且无整页水平溢出；reduced-motion 时 SHALL 关闭非必要 camera easing、crossfade 和 animated scrub；drag/orbit/resize MUST 有 toolbar、menu、numeric input 或 keyboard 等价路径；touch target SHALL 满足项目既有最小尺寸标准。

#### Scenario: 200% zoom 桌面审阅

- **WHEN** user 在支持 viewport 上放大到 200%
- **THEN** controls SHALL reflow 为 tabs/Sheet/stacked regions
- **AND** source、timeline list、Inspector 与 confirmation actions SHALL 保持可达

#### Scenario: prefers-reduced-motion 开启

- **WHEN** OS/browser 请求 reduced motion
- **THEN** viewport transition、Pane animation 与 timeline auto-scroll SHALL 使用即时或最小运动
- **AND** 状态变化 SHALL 通过文本/ARIA 表达，不依赖动画

### Requirement: 所有状态必须在 UI 与测试矩阵中显式覆盖

Replica Pane、Inspector、Auctra、Scaena 和 receipts SHALL 覆盖 `loading`、`empty`、`partial`、`stale`、`error`、`revoked`、`permission_required`、`offline`、`needs_contract`、`duplicate_action`、`unknown_accept`、`limit_reached`、`navigation_away`、`sync_degraded`、`view_too_large` 和 WebGL unavailable。每个 state MUST 说明用户仍可做什么、禁止什么和如何恢复。

#### Scenario: Partial workspace 与 unknown action 同时出现

- **WHEN** Auctra offline 且 Scaena action 为 unknown accept
- **THEN** UI SHALL 分别显示 segment availability 与 action reconcile 状态
- **AND** SHALL 保留可验证 evidence review，不得用单一 generic error 覆盖全部上下文

### Requirement: 固定 viewport 的视觉与交互证据必须可重复

Implementation SHALL 为至少 1920×1080、1440×900、1280×800、768×1024 和 390×844 建立 deterministic fixture screenshot/Playwright matrix，并覆盖 default、partial/stale、selected object、dirty draft、confirmation、unknown accept、WebGL failure 和 narrow-screen substitute。Evidence MUST 记录命令、viewport、fixture/contract version 与 artifact path。

#### Scenario: UI change 进入最终验证

- **WHEN** spatial replica change 准备提交
- **THEN** validation SHALL 生成固定 viewport screenshots 和 critical Playwright flow evidence
- **AND** reviewer SHALL 能将每张图映射回 UI Spec state，而不是依赖手工截图说明

### Requirement: Renderer 性能与资源生命周期必须有本地 gate

P1 fixture SHALL 限定为单 shot、1–2 actors、browser-budgeted proxies/camera 和至多 10 个 overlay/track groups。验证 MUST 记录 first 3D frame、selection latency、confirmed sync drift、main-thread long tasks、frame-time p50/p95、heap/bundle delta 和 disposal result；Pane close、shot switch、capability off、WebGL loss 后 MUST 释放 renderer、buffers、textures、media callbacks、observers 和 subscriptions。

#### Scenario: 连续切换 shot 并关闭 Pane

- **WHEN** test fixture 多次加载不同 shot 后关闭 Replica Pane
- **THEN** resource instrumentation SHALL 证明旧 renderer/material/texture/callback/subscription 不再 active
- **AND** heap/resource count SHALL 不呈无界增长

#### Scenario: 同步超过一帧

- **WHEN** confirmed overlay/3D/timeline drift 超过一个 source frame
- **THEN** validation SHALL fail 或 UI SHALL 进入 `sync_degraded`
- **AND** SHALL NOT 记录为 synchronized success

### Requirement: 新依赖与 bundle 必须受控

P1 3D implementation SHALL 优先使用 lazy-loaded `three` core behind `ReplicaViewportAdapter`，不得在无独立设计依据时引入 React Three Fiber、Drei、第二 scene-state framework 或 Three wire types。Bundle evidence MUST 显示 spatial chunk delta 且 capability off 时不得加载 3D chunk。

#### Scenario: 普通 Agent session 未开启 replica capability

- **WHEN** user 打开 `/agent` 但 server 未发布 spatial replica viewport capability
- **THEN** browser SHALL NOT 下载或初始化 Three viewport chunk
- **AND** existing Agent shell performance SHALL 不受 renderer startup 影响

### Requirement: UI 文案必须可国际化且机器值保持稳定

所有人类可见 label、state explanation、recovery、confirmation 和 accessibility text SHALL 经现有 i18n system 提供中文与英文。Contract fields、enum、Pane type、action id、owner id、error code 和 telemetry keys MUST 保持稳定 English machine values，不得把 display text 当作逻辑判断。

#### Scenario: 切换英文界面

- **WHEN** user 将 Workbench locale 切为 English
- **THEN** Replica Pane、Inspector、owner Pane 与 dialogs SHALL 使用英文可见文案
- **AND** owner refs、enum、action payload 与 receipt parsing SHALL 保持不变

