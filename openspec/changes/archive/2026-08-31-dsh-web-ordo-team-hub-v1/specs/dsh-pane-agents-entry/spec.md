## ADDED Requirements

### Requirement: Agents entry SHALL target the unified Hub when available
现有 icon-only Agents controls SHALL 在 unified Hub view 已注册时打开/聚焦 Hub，并由 process-local preference 决定默认 Session Agents 或 Ordo Teams view。accessible name 与 Tooltip MUST 继续明确，按钮主内容 MUST 保持 icon-only。

#### Scenario: Unified Hub is registered
- **WHEN** header/right rail Agents control 被激活
- **THEN** host SHALL 打开 unified Hub；若当前已有 active Delivery selection，Ordo Teams MAY 成为默认 view

### Requirement: Missing Hub seam SHALL degrade honestly
如果 pane host、unified Hub 或 Ordo Team capability 缺失，entry SHALL 禁用或打开仍可用的 Session Agents/legacy pane，并 SHALL 给出明确原因；MUST 不出现 no-op dead button。

#### Scenario: Pane host lacks unified Hub
- **WHEN** `ctx.paneWorkbench` 可用但 unified Hub view 未注册
- **THEN** existing Session Agents/legacy view MAY 保持入口，Ordo Teams V1 MUST 标为 unavailable，点击不得 silently return

