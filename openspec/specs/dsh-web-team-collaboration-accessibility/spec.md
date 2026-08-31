# dsh-web-team-collaboration-accessibility Specification

(merged from archived change 2026-08-31-dsh-web-ordo-team-hub-v1)

### Requirement: Every graph fact SHALL have a semantic alternative
Task、role slot、assignment、handoff、dependency、status、blocker、control 和 allowed action SHALL 可通过 keyboard-readable Task Queue、Inspector 或 semantic relation list访问。Graph canvas MUST 不成为唯一信息源。

#### Scenario: Screen-reader user inspects a task
- **WHEN** 用户从 Task Queue 聚焦 task
- **THEN** accessible name/description SHALL 包含 title、执行/交付状态、assignee、blocker 与 action availability，关联 refs SHALL 可通过标准控件打开

### Requirement: Keyboard navigation SHALL cover the golden journey
用户 SHALL 能仅用 keyboard 打开 Hub、切 Session/Ordo views、选择 Delivery/task/role、打开 Room/Activity、Post/Reply/Promote、打开 Action Palette、Take Control 和处理 confirmation。focus order MUST 稳定，overlay/drawer close 后 MUST 返回触发控件。

#### Scenario: User takes control by keyboard
- **WHEN** Web read-only 且 `Take Control` action available
- **THEN** 用户 SHALL 能聚焦 action、阅读 holder/revision/effect、确认并在 receipt 后获得新 focus/state，无 keyboard trap

### Requirement: Status SHALL not rely on color or animation
所有状态 SHALL 同时使用 visible text、icon/shape、ARIA state 和可读 relation。contrast SHALL 使用现有 DSH visual tokens；simulation、qualification、read-only、blocked 与 stale MUST 有明确 label。

#### Scenario: High-contrast or color-deficient viewing
- **WHEN** color perception 不可靠或系统高对比模式启用
- **THEN** task 状态、edge kind、control holder 与 disabled reason MUST 仍能通过文本/形状/属性识别

### Requirement: Async and degraded states SHALL be explicit
loading、empty、unavailable、forbidden、stale、cursor gap、disconnected、lost control、approval required、unknown liveness 和 contract mismatch SHALL 有独立 typed UI state与 owner recovery action。Client MUST 不将 error 渲染为空列表或 optimistic success。

#### Scenario: Event cursor expires
- **WHEN** Host 返回 `cursor_expired`
- **THEN** Client SHALL 暂停 delta、显示 refreshing 状态、请求新 snapshot，并在成功前禁用 mutation

### Requirement: Browser SHALL not expose unsafe projection data
DOM 与 React state MAY 只暂存当前可见、bounded 且 redacted 的 Room body。devtools labels、URL、localStorage、sessionStorage、logs 和 telemetry MUST 不保存 Room body；screenshots 和 fixtures MUST 使用 synthetic/redacted Room 内容。所有 browser surface MUST 不含 broker credential、cookie/token、raw URL、absolute path、PID、raw prompt、provider payload、private tool arguments、secret、未脱敏 Room 内容或 full reasoning。

#### Scenario: Projection contains a forbidden field
- **WHEN** Host safe-projection validator 发现 `token`、absolute path 或 raw provider payload
- **THEN** Host SHALL 拒绝/strip projection，Client SHALL 显示 typed unsafe-projection state，forbidden value MUST 不进入 browser
