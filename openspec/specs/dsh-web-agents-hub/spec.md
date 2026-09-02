# dsh-web-agents-hub Specification

(merged from archived change 2026-08-31-dsh-web-ordo-team-hub-v1)

## Purpose

定义 DSH Web 统一 Agents Hub 的入口、Session Agents 与 Ordo Teams owner 分离、Delivery 选择、legacy fallback 及控制状态展示合同。

## Requirements

### Requirement: DSH Web SHALL expose one Agents Hub
现有 Agents icon/entry SHALL 打开统一 Agents Hub，并提供 `Session Agents` 与 `Ordo Teams` 两个明确视图。Hub SHALL 使用 reviewed pane/client seams，不得创建独立 Web app、iframe bridge 或 DSH core fork。

#### Scenario: User opens Agents from the header
- **WHEN** Agents entry 所需 pane host 可用且用户激活入口
- **THEN** DSH SHALL 打开或聚焦 Agents Hub，恢复进程内 view、Delivery selection 与 layout state

### Requirement: Session Agents and Ordo Teams SHALL retain separate owners
Session Agents SHALL 只展示当前 DSH session descendants 与 host-authored actions；Ordo Teams SHALL 只展示 Ordo Delivery/Team projection。Hub MAY deep-link between views，但 MUST 不合并 identity、status、task 或 lifecycle。

#### Scenario: User opens a session from an Ordo role binding
- **WHEN** Ordo projection 提供安全 session opaque ref 且 host 支持对应 view
- **THEN** Hub MAY 打开 Session Agents/session view，Ordo task/Delivery state MUST 不改变

### Requirement: Ordo Teams SHALL resolve Delivery selection safely
Ordo Teams view SHALL 按 explicit deep-link ref、process-local selection、host-provided Delivery candidates 顺序解析目标。多候选 SHALL 显示 picker；missing/forbidden/stale ref SHALL 显示 typed state，不得自动创建或 rebind Delivery。

#### Scenario: Deep-link targets a stale Delivery
- **WHEN** Hub 收到的 Delivery ref 与当前 context revision 不匹配
- **THEN** Host SHALL 拒绝 projection/action，client SHALL 清除 stale selection 并显示 list/refresh action

### Requirement: Legacy entries SHALL remain compatible
既有 Subagent Monitor、Ordo Agent Ops Pane 和其它 Agents entry effects SHALL 保持可用。Ordo Team V1 capability 缺席时，Hub MAY 打开旧 Ordo Ops fallback，但 MUST 标记其能力范围并不得伪造 Room/control/actions。

#### Scenario: Team V1 is not registered
- **WHEN** Host capability matrix 不包含 `team_collaboration.v1`
- **THEN** Hub SHALL 显示 typed unavailable/fallback action，旧 Ordo Ops Pane SHALL 继续按原合同工作

### Requirement: Hub SHALL reveal owner, freshness and control state
Ordo Teams header SHALL 显示 Delivery/source、projection freshness、surface control holder、本端 read/write state、maturity 与 simulation/qualification badges。Session Agents SHALL 使用 DSH owner/freshness，不复用 Ordo control 语义。

#### Scenario: TUI holds control
- **WHEN** Ordo snapshot 显示 active holder 为 TUI
- **THEN** Web SHALL 保持完整可读并显示 `Read only · TUI has control` 与 server-authored `Take Control` action
