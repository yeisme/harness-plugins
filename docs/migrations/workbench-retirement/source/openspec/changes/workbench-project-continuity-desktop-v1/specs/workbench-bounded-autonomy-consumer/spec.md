## ADDED Requirements

### Requirement: 独立 action grant 控件与服务端事实

Workbench MUST 只在 server `boundedActionGrantV1` 和对应 owner 合同可用时展示可执行批授权控件；范围、操作效果、预算、期限、状态与撤销来自服务端。旧 chat/access grant 不等于 mutation approval。

#### Scenario: 用户尝试用客户端状态启用
- **WHEN** URL、localStorage 或 build config 声称有批授权能力但 server 未提供
- **THEN** 不启用能力或授予权限，显示真实缺口，普通 Chat readiness 不变

#### Scenario: 用户批准范围
- **WHEN** 用户明确批准 server-authored action grant proposal
- **THEN** 通过 ProposalAuthority/TaskService 获得批准 receipt，UI 只展示投影，不伪造 grant 或自动提交其他 proposal

### Requirement: 每次执行重验与单一链路

每个自主动作 MUST 保留 owner-authored proposal，并由权威服务原子验证批准范围、identity、policy、resource/manifest revision、预算、次数、幂等和必要 writer lease 后进入原 Task/owner 链。

#### Scenario: 并发预算与重复点击
- **WHEN** 两个请求竞争剩余额度或用户重复提交同一动作
- **THEN** 不超额准入、不重复执行，Task 与 owner receipt 可关联到原 proposal/grant

#### Scenario: 无 effects 合同或出现发布
- **WHEN** Agent 请求未分类 terminal/MCP 操作、外部写、不可丢弃数据删除或 Canon 接受
- **THEN** 使用原 owner 的明确决定条件，不能因处于项目工作区而批量放行

### Requirement: 撤销、取消和未知状态

撤销/过期 MUST 阻止新 admission；原 accepted 动作只能由 owner 确认取消/完成，unknown 必须对账。新 UI 能力关闭不得移除原查询与恢复入口。

#### Scenario: 撤销与 dispatch 竞争
- **WHEN** grant 撤销与新动作 dispatch 同时发生
- **THEN** 使用权威准入顺序确定是否已 accepted；撤销后的新准入拒绝，已 accepted 的按 owner cancel/reconcile

#### Scenario: 服务重启或回滚
- **WHEN** 有 unknown attempt 时服务重启或新 capability 关闭
- **THEN** 恢复原查询/对账，预算保留到 owner 核验，不重放工具或自动重新授权
