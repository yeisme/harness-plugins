## ADDED Requirements

### Requirement: 完成态 fallback 提供 Conversation recap 与三项建议

当当前 Session 不在 running、没有 pending interaction、存在已完成 turn，且 Plan/client source 没有更具体建议时，Web dock SHALL 从该 turn 的 finalized assistant text 生成有界 Conversation recap，并 SHALL 展示恰好三项通用建议。recap SHALL NOT 包含 raw reasoning、tool payload 或 provider payload。

#### Scenario: 普通 Agent 轮次完成且没有具体 source
- **WHEN** 最近 turn 已完成、Session idle 且合并后的 Plan/client suggestions 为空
- **THEN** dock SHALL 显示 Conversation recap 和三项 fallback chips
- **AND** 点击或批量应用 SHALL 只更新 Composer draft，不自动发送

#### Scenario: 存在 owner 具体建议
- **WHEN** Plan projection 或 client source 提供至少一项建议
- **THEN** dock SHALL 优先显示这些具体建议
- **AND** SHALL NOT 混入通用 completion fallback

### Requirement: 多选建议支持可退出的键盘轮转

多选模式 SHALL 支持 Tab/Shift+Tab 与 ArrowLeft/ArrowRight 在可用 chips 间取模轮转；Escape SHALL 清空 selection 并退出多选。单选模式 SHALL 保持浏览器原生 Tab 导航。

#### Scenario: 多选键盘轮转
- **WHEN** 多选已启用且焦点位于任一 suggestion chip
- **THEN** Tab/ArrowRight SHALL 聚焦下一项，Shift+Tab/ArrowLeft SHALL 聚焦上一项，并在首尾取模

#### Scenario: Escape 退出多选
- **WHEN** 多选模式中用户按 Escape
- **THEN** dock SHALL 清空已选建议、退出多选并保留当前 Composer draft
