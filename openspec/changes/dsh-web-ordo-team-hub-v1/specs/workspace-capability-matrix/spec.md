## ADDED Requirements

### Requirement: Capability matrix SHALL declare Ordo Team V1 parity
workspace capability matrix SHALL 声明 `team_collaboration.v1` 及其 snapshot、events、actions、Room、Activity、surface control、graph/list 与 maturity capabilities。Web SHALL 仅在 Host 和 Ordo owner versions compatible 时宣称 available。

#### Scenario: Host supports read but not actions
- **WHEN** snapshot/events compatible但 action bridge 未注册
- **THEN** matrix SHALL 标记 read available、mutation unavailable，并提供真实 upgrade/fallback reason

### Requirement: Matrix SHALL distinguish Ordo Team and Session Agent coverage
Ordo Team V1 parity SHALL 与 Session Agents host-dependent capabilities 分开记录。一个 capability family available MUST 不推导另一个 family available。

#### Scenario: Ordo Team is fully available but Session action is missing
- **WHEN** Host 支持 Team V1 全部 actions但没有某 Session Agent action
- **THEN** matrix SHALL 只禁用 Session action，Ordo Team parity badge MAY 保持完整

### Requirement: Matrix SHALL reveal prototype and qualification maturity
matrix SHALL 区分 `experimental_fixture`、`fake_runtime`、`qualified_live` 与 `unavailable` 或等价稳定 states，并 SHALL 分开报告 requested/effective writer capability。fake 8-writer MUST 不显示为 live qualified。

#### Scenario: Eight-writer fixture is selected
- **WHEN** Delivery projection 标记 `simulation=true`、requested writers=8
- **THEN** UI SHALL 显示 fake/internal maturity，matrix MUST 不把 live writer capability提升为 8

