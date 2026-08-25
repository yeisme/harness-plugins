# dsh-composition-projection Capability

DSH 组合事实投影：无会话、无模型运行地投影一个 preset 的 composition facts、digests、health 与 drift，并通过机器命令暴露给 Ordo。

## ADDED Requirements

### Requirement: Projection SHALL run without an agent, session, or turn
`AgentCompositionPreview.project(id)` SHALL 复用 `ctx.agentPresets.standingKeyFor(id)` 与 registries 在 standing scope 下投影组合事实，且 SHALL NOT 创建 agent、session、模型 turn、订阅或 durable 写。dispose 后 SHALL NOT 残留本服务注册。

#### Scenario: Project a preset with no session open
- **WHEN** 主机无任何会话，调用 `project(id)`
- **THEN** 投影 SHALL 返回该 preset 的 tools、prompt sections、projection units 与 permission knobs
- **AND** 不产生模型 token 成本或任何外部副作用

### Requirement: Projection SHALL carry digests, never raw content
投影 SHALL 为每个 tool 输出 `name`、`schema_digest`、`source_plugin`、`source_layer`，为每个 prompt section 输出 `id`、`section_digest`、`source_plugin`。MUST NOT 输出 raw prompt 文本、完整 tool schema 正文、private tool arguments、absolute host path、PID 或 credential。`capability_digest` SHALL 由 composition 段的 canonical 序列化计算。

#### Scenario: Prompt section contains non-displayable text
- **WHEN** section 文本不可安全展示
- **THEN** 投影 SHALL 只包含 section id 与 digest
- **AND** 任何原文路径 SHALL 被 redaction 拒绝

### Requirement: Health SHALL report three independent layers
投影 SHALL 报告 `shape_ok`、`mount_ok`（附失败 reason）与 `provable_mount_ref`。broken preset SHALL 返回 typed `composition_invalid` + reason 而非空组合；`shape_ok` MUST NOT 冒充 `mount_ok`。

#### Scenario: A row resolves but publishes into the root realm
- **WHEN** standing mount 因 root-realm service 被拒
- **THEN** 投影 SHALL 返回 `composition_invalid` 与对应 reason
- **AND** `mount_ok` SHALL 为 false

### Requirement: Drift SHALL be reported, never corrected
`copy()` SHALL 写入 additive lineage（`dsh.preset_lineage.v0`：source_id、source_digest、copied_at）。投影 SHALL 比较当前 source 的 `capability_digest` 与 lineage 记录并输出 `drift.state ∈ none|unknown|diverged`。任何路径 MUST NOT 自动覆盖用户 copy。

#### Scenario: Copied preset diverged from its source
- **WHEN** copy 的当前 digest 与 lineage 记录的 source_digest 不同
- **THEN** 投影 SHALL 报告 `drift.state=diverged`
- **AND** 用户 copy 保持原样

### Requirement: Machine commands SHALL expose stable envelopes
`dsh composition preview --preset <id> --json` SHALL 输出单个 `dsh.composition.preview.v0` envelope；`dsh composition smoke --preset <id> --json` SHALL 在真实进程 boot、mount、投影、dispose 后输出 redacted `dsh.composition.smoke.v0` 摘要，且 MUST NOT 发起模型请求。smoke 的 exit 0 SHALL 仅表示 mount/投影/清理通过，不表示任何资质。

#### Scenario: Smoke a preset with a broken row
- **WHEN** preset 存在不可用 row
- **THEN** smoke SHALL 非零退出并输出 typed reason
- **AND** SHALL NOT 输出该 row 的失败细节之外的私有内容

### Requirement: Consumption by Ordo SHALL be through the reviewed adapter
Ordo SHALL 只能通过受审本地 CLI adapter（argv 数组、env allowlist、timeout、stdout/stderr budget）消费上述命令并对 envelope 做 schema 校验。DSH SHALL NOT 提供任意 shell、URL 或进程控制面。

#### Scenario: Ordo requests a preview
- **WHEN** Ordo adapter 以固定 argv 调用 `dsh composition preview --preset <id> --json`
- **THEN** DSH 输出可 schema 校验的 envelope
- **AND** DSH 不接受任意 executable/env 注入
