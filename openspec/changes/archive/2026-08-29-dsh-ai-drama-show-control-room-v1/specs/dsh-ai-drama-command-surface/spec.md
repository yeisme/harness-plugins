## ADDED Requirements

### Requirement: Drama command surface SHALL add full-show navigation commands
命令面 SHALL additive 注册 `/drama show`、`/drama inbox`、`/drama assets` 和 `/drama delivery`，旧命令的 id、selector 和 mutation 语义 MUST 不变。

#### Scenario: User executes drama show
- **WHEN** Show Control capability available 且用户执行 `/drama show`
- **THEN** Client SHALL 应用 show-control preset 并聚焦 Show Board

#### Scenario: Show Control remote is missing
- **WHEN** 用户发现新增命令但 remote 未安装
- **THEN** 命令 SHALL disabled 并显示 needs_contract reason，旧 `/drama open` SHALL 继续可用
