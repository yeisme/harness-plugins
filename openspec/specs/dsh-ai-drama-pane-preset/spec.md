# dsh-ai-drama-pane-preset Specification

## Purpose
Define the compatible current-episode Director preset, the additive single-show control preset, and safe registration/disposal behavior.
## Requirements
### Requirement: Director preset 必须支持当前项目完整流程并保持最小工作集

默认 `director` preset SHALL 最多打开 Context、Review 和 Run 三个 visible panes。Story、Visual 和 Audio SHALL 按需打开；用户 SHALL 能在 Pane 内继续当前项目的故事、视觉、音频、生成、审批和 owner 导出动作。全剧操作由独立 additive `show-control` preset 承载，Workbench 保留为可选的高密度与高级分析宿主。

#### Scenario: 用户从 Creator Home 进入完整做剧

- **WHEN** Creator Home 调用 Director preset
- **THEN** Context、Review 和 Run SHALL 作为最小工作集打开
- **AND** Story、Visual 和 Audio SHALL 保持按需打开

#### Scenario: 用户需要高级空间化分析

- **WHEN** 用户请求复杂跨集布局、大规模空间比较或外部专业工具
- **THEN** Director Pack SHALL 提供可选 Open in Workbench
- **AND** DSH browser cache MUST NOT 成为 Workbench facts

### Requirement: Pane 注册必须可安全卸载

所有 command、view、intent、event listener、subscription 和 preset registration SHALL effect-scoped、HMR-safe 且可 dispose。

#### Scenario: 插件卸载

- **WHEN** 用户卸载 Director Pack 或切换 profile
- **THEN** 插件 SHALL 移除自身注册和 subscription
- **AND** SHALL NOT 终止 owner run 或删除 canonical state

### Requirement: Director Pack SHALL provide an additive show-control preset
Pack SHALL 保留 `director` preset，并新增 `show-control` preset；Tier 0 默认有序打开 Show Board、Review Inbox、Run、Delivery，Asset Wall 按需打开。

#### Scenario: Apply show-control at Tier 0
- **WHEN** 用户从 Creator Home 或 `/drama show` 应用 preset
- **THEN** 唯一 region SHALL 打开不超过四个默认 tab，active 为 Show Board，MUST NOT 伪造 split geometry

#### Scenario: Existing director preset is applied
- **WHEN** 旧 consumer 调用原 `director` preset
- **THEN** Context、Review、Run 的原顺序与 secondary Pane 行为 MUST 保持不变
