## ADDED Requirements

### Requirement: `/ordo run launch` durable handoff 命令

共享命令目录 SHALL 保留 `/ordo` 为 canonical owner namespace，并提供 `run launch` 子动作。该动作只有在 owner capability 声明 versioned preview/apply、decision ref、revision fence 与 receipt 时可用；缺失时 SHALL visible disabled 并带稳定 reason，MUST 不回退到 `ordo run start`、human command parsing 或直接 shell execution。

#### Scenario: 合格 capability 可用

- **WHEN** Ordo capability projection 宣告兼容的 `run launch` preview/apply
- **THEN** Web/TUI command entry SHALL 使用同一 owner/action kind，并进入各自宿主的 preview-confirm-receipt 流程

#### Scenario: 仅存在 `ordo run start`

- **WHEN** 环境支持既有 `run start` 但没有 `run launch`
- **THEN** `/ordo run launch` SHALL 保持 disabled，reason SHALL 说明 foreground handoff capability 缺失
