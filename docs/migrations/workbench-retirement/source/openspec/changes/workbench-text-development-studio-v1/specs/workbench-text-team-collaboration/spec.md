## ADDED Requirements

### Requirement: Team configuration SHALL use templates plus bounded override

Workbench SHALL 提供 `solo-assist`、`novel-sprint`、`screenplay-pass` 和 `self-media-pack` 模板，并允许只修改 Ordo schema 声明的 role slots、mode/model profile refs、permission profile、Context、预算、依赖和输出物。任意 runtime id、executable、prompt body 或 overlapping writer input MUST be rejected。

#### Scenario: 用户定制 Novel Sprint
- **WHEN** 用户调整 Reviewer model profile 和预算但保持 schema valid
- **THEN** Workbench SHALL 请求 Ordo preview 新 profile/plan revision
- **AND** MUST NOT 在浏览器本地宣布该配置可执行。

### Requirement: Main Agent SHALL propose one approvable Team Plan

启动前 Workbench SHALL 呈现 owner-authored Team Plan，包括角色、DAG、Context scope、模型/profile、预算、风险、输出物、writer target 和预计验证。用户一次批准 SHALL 只授权该 exact revision/digest。

#### Scenario: Team Plan 在批准前变化
- **WHEN** Ordo 返回新的 plan revision 或 source/context drift
- **THEN** 旧 approval SHALL 失效并要求重新审阅
- **AND** Workbench MUST NOT 将旧批准应用到新计划。

### Requirement: UI SHALL expose at most one writer per target

Team Plan 和 run projection SHALL 明确显示唯一 writer lease；其他角色 SHALL 标为 read-only 或 candidate producer。发现重叠 writer 时 Start MUST be disabled，并使用 Ordo reason/recovery。

#### Scenario: 两个角色申请当前章节写权限
- **WHEN** simulation 返回 writer conflict
- **THEN** Workbench SHALL 高亮冲突 target/roles并要求修改计划
- **AND** SHALL NOT 通过隐藏其中一个角色来启动。

### Requirement: Simulation SHALL not impersonate a real run

Simulation SHALL 使用确定性 Ordo compiler/fixtures，状态、事件和 receipt MUST 标为 `simulated`，不得显示真实 model usage、provider success 或 accepted delivery。

#### Scenario: Simulation 全部通过
- **WHEN** role、DAG、budget 和 writer checks 通过
- **THEN** UI SHALL 显示 plan structurally runnable
- **AND** SHALL 继续区分 runtime/credential readiness，不能标记 real execution ready。

### Requirement: Real Team canary SHALL be explicitly gated

Real canary SHALL 需要显式用户动作、Ordo experimental-real capability、Pi/OMP qualification、真实 user-level credential 和 current approval。默认 SHALL 限制为主 Agent加最多两个 Team 角色、一个 writer、无递归 team。

#### Scenario: Credential missing
- **WHEN** 用户请求 real canary 但 credential resolver 未 ready
- **THEN** Workbench SHALL 显示 blocked 和安全配置动作
- **AND** MUST NOT 回退 simulation/fixture 后标为 real。

### Requirement: Team unknown SHALL be reconcile-only

Team start/cancel/lease 状态为 unknown 时，Workbench SHALL 保留 last-confirmed plan/run facts，只暴露原 operation status/reconcile。MUST NOT 自动创建新 Delivery、复制 writer 或重复 start。

#### Scenario: Start acceptance unknown
- **WHEN** transport 无法确认 Ordo 是否接受 run start
- **THEN** UI SHALL 显示 unknown state、original operation ref 和 Reconcile
- **AND** Start 按钮 SHALL 保持禁用直到 owner 收敛。

### Requirement: Team Plan visualization SHALL be read-only and bounded

Workbench SHALL 使用现有 read-only workflow/subgraph pattern呈现 Ordo roles、DAG、dependencies 和唯一 writer；图只负责浏览、聚焦与选择。Browser MUST NOT 通过拖边、自由连线或节点编辑改变 Team Plan，所有 override SHALL 进入 Ordo schema-bounded form并生成新 plan revision。

#### Scenario: 用户在 Team DAG 中选择 writer task
- **WHEN** 用户点击一个 writer node
- **THEN** Context SHALL 显示 target、lease、inputs、outputs、budget、risk 与 acceptance
- **AND** 拖动节点 MAY 只改变本地 viewport，MUST NOT 改变 dependencies 或 owner plan digest。
