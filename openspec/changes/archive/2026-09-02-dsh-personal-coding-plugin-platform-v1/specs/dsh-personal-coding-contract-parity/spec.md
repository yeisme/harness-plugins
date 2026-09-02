## ADDED Requirements

### Requirement: Web/TUI 共享语义 fixture

仓库 SHALL 为个人编码基础包提供共享 fixture，固定 canonical command/view/action id、contract version、owner、effect、risk、capability state、disabled reason code、sample preview 和 receipt；Web/TUI adapter MUST 通过同一 fixture。

#### Scenario: TUI 与 Web owner 漂移

- **WHEN** 两个 adapter 对同一 action 输出不同 owner 或 effect
- **THEN** parity test SHALL 红灯并指出 id 与字段差异

### Requirement: Renderer 差异不构成合同漂移

Web 与 TUI MAY 使用不同布局、键位、可访问性和视觉实现；parity SHALL 比较语义与状态，不比较 DOM、React tree、terminal frame 或像素。

#### Scenario: Web 尚无视觉面板

- **WHEN** Web 只实现 contract probe/fixture，而 TUI 已渲染 view
- **THEN** parity SHALL 在 schema/owner/effect/reason 一致时通过，并如实把 Web presentation 标为 unavailable/retained-next

### Requirement: 命令目录同源

`/diff`、`/review`、`/resume`、`/session`、`/plugins` 与 `/ordo run launch` 的 canonical name、aliases、owner、action kind 和 availability reason SHALL 来自共享 command directory 或其 versioned projection。

#### Scenario: Ordo 缺席

- **WHEN** Web/TUI 均探测不到合格 Ordo `run launch`
- **THEN** 两个表面 SHALL 保留同一 canonical command 并输出同一 unavailable reason code
