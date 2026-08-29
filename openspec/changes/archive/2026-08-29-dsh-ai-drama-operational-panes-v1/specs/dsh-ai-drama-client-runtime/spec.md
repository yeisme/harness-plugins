## ADDED Requirements

### Requirement: Registered Drama views SHALL consume the shared Creator runtime when available
既有六个 Drama view kind、Director preset 和 command ids SHALL 保持不变；当 `CreatorStudioRuntimeV1` 可用时，client MUST 使用它驱动 operational content，并精确订阅/dispose。

#### Scenario: Shared runtime hot-swaps
- **WHEN** Creator runtime generation 被替换
- **THEN** Drama client SHALL 撤销旧 subscription、清理过期 UI state，并只绑定新 runtime 一次

#### Scenario: Existing consumer opens an old view kind
- **WHEN** consumer 使用 `drama.story`、`drama.visual`、`drama.audio`、`drama.run` 或 `drama.review`
- **THEN** 同一 kind SHALL 打开增强后的 Pane，resourceKey、singleton 和 preset 兼容语义 MUST 不变
