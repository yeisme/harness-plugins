# pane-protocol

## ADDED Requirements

### Requirement: 可选 slash 短名
`PaneCommandDescriptor` SHALL 允许可选 `slash` 对象：`name` 匹配 `^[a-z][a-z0-9-]{1,31}$`，`aliases` 最多 4 个同类名字，`hint` 最长 80，`category` 为 discovery/session/model/work/lifecycle/pane 之一。缺省 `slash` 的旧描述符 MUST 仍然合法。非法短名 MUST 校验失败。

#### Scenario: 旧命令无 slash
- **WHEN** 描述符只有 id 与 label
- **THEN** schema SHALL 接受

#### Scenario: 非法短名
- **WHEN** `slash.name` 为 `Open Note`
- **THEN** schema SHALL 拒绝
