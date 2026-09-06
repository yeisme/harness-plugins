# dsh-personal-coding-contract-parity Specification

## Purpose
定义个人编码 Web entry points 对 command、projection、typed action、health 与 receipt 的一致语义。
## Requirements
### Requirement: Web entry points 共享语义 fixture

仓库 SHALL 为个人编码基础包提供共享 fixture，固定 canonical command/view/action id、contract version、owner、effect、risk、capability state、disabled reason code、sample preview 和 receipt；Web adapter MUST 通过同一 fixture。

#### Scenario: Web adapter 与 SDK owner 漂移

- **WHEN** Web adapter 与 SDK fixture 对同一 action 输出不同 owner 或 effect
- **THEN** parity test SHALL 红灯并指出 id 与字段差异

### Requirement: Renderer 差异不构成合同漂移

不同 Web entry point MAY 使用不同布局、可访问性和视觉实现；parity SHALL 比较语义与状态，不比较 DOM、React tree 或像素。

#### Scenario: Web 尚无视觉面板

- **WHEN** Web 只实现 contract probe/fixture，尚未渲染 view
- **THEN** parity SHALL 在 schema/owner/effect/reason 一致时通过，并如实把 presentation 标为 unavailable/retained-next

### Requirement: 命令目录同源

`/diff`、`/review`、`/resume`、`/session`、`/plugins` 与 `/ordo run launch` 的 canonical name、aliases、owner、action kind 和 availability reason SHALL 来自共享 command directory 或其 versioned projection。

#### Scenario: Ordo 缺席

- **WHEN** Web 探测不到合格 Ordo `run launch`
- **THEN** Web SHALL 保留 canonical command 并输出稳定 unavailable reason code
