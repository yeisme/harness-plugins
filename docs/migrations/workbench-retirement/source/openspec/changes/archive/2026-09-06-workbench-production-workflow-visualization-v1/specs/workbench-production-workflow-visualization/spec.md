## ADDED Requirements

### Requirement: WB-PWV-CONTRACT 制作流水线投影 SHALL 是封闭安全合同

`workbench.production_pipeline.v1` SHALL 由服务端按 (tenant, workspace, project) + domain 合成，输出 canonical 阶段轨（text 6 / drama 8）、每阶段 closed 状态、有界 facts 与有界运行摘要；整体经 closed codec 自检，任何字段漂移 fail-closed，不输出部分投影。浏览器与 SDK 不解析未知字段，不复制 owner 状态机。

#### Scenario: 结构化阶段事实直达浏览器
- **WHEN** 客户端以合法 scope + domain 查询 production pipeline
- **THEN** BFF 返回单一 JSON 投影，阶段/状态/facts/runs 为 typed 字段而非 ref+summary 间接层

#### Scenario: 合同漂移拒绝
- **WHEN** 投影含未知枚举、缺失 canonical 阶段、超额 facts/runs 或非 opaque ref
- **THEN** codec 整体拒绝，客户端收到 contract_mismatch，不渲染部分结果

### Requirement: WB-PWV-TEXT 文本制作流水线 SHALL 由 Auctra 事实确定性折叠

text domain SHALL 从 Auctra WorkingCopy status 与 checkpoint typed 投影确定性折叠 `draft/candidate/review/accept/checkpoint/deliver` 六阶段：conflict/recovery → blocked；open → active；已观察为空 → pending；无从观察或合同未发布 → unknown。不得从本地文本、时间或运行存在推断阶段进度。

#### Scenario: 工作副本冲突阻断
- **WHEN** 任一 workingCopyRef 状态为 conflict 或 recovery_required
- **THEN** draft 阶段 state=blocked 并携带 working_copies_conflicted fact

#### Scenario: 候选合同未签约
- **WHEN** owner candidate list 合同未发布
- **THEN** candidate/review/accept 阶段如实 unknown，不显示 pending 或完成

#### Scenario: connector 未配置
- **WHEN** Auctra connector 未绑定
- **THEN** 全阶段 unknown 且 readiness=needs_contract，响应不伪造空进度

### Requirement: WB-PWV-DRAMA 漫剧流水线 SHALL 复用 Show canonical 阶段真值

drama domain SHALL 复用 `showcontrol` canonical 8 阶段轨与 owner readiness 折叠，不创建第二套阶段状态或进度推断；owner stage projection 未签约前阶段保持 unknown。

#### Scenario: 阶段真值单一
- **WHEN** drama 查询命中
- **THEN** 阶段集合、顺序与状态语义与 show.workspace_projection 一致，owner 段计数进入 facts

#### Scenario: owner 投影不可用
- **WHEN** show owner readiness source 未绑定或读取失败
- **THEN** 阶段轨如实降级（unknown + needs_contract/offline），不回退到本地推断

### Requirement: WB-PWV-RUNS 运行泳道 SHALL 经授权且不臆造归属

运行摘要 SHALL 以 Project Automation binding 的 project scope 枚举，逐 binding 走 facade 授权读；摘要仅含 safe refs、run state 与 observedAt，有界 ≤8。run 与阶段的归属在合同存在前不得臆造；automation 不可用不拖垮阶段轨。

#### Scenario: 项目运行可见
- **WHEN** 项目存在 enabled automation bindings 且有运行记录
- **THEN** 泳道按 observedAt 降序展示有界运行卡片，可 deep link 到 Workflow 控制面

#### Scenario: 授权失败如实降级
- **WHEN** 某 binding 授权失败或 workflow runtime 状态不可读
- **THEN** 跳过该 binding 并在 summary 注明，runsReadiness 如实 available（部分成功）或 needs_contract

#### Scenario: automation 未接入
- **WHEN** automation facade 未绑定
- **THEN** runs 为空且 runsReadiness=needs_contract，阶段轨不受影响

### Requirement: WB-PWV-UI 可视化面 SHALL 统一并 fail-closed

`ProductionWorkflowPanel` SHALL 以阶段轨 + 运行泳道呈现投影：状态以文本 chip 表达（不只靠颜色）、refs 用 mono、needs_contract/offline 如实显示诊断而不渲染伪造内容；挂载于 Creative Production Lens（drama）与 registered Pane `production.pipeline.v1`（全项目），不新增独立路由。

#### Scenario: 漫剧入口
- **WHEN** 用户在 /agent Creative Production Lens 打开有 show scope 的项目
- **THEN** Show Home 之后呈现制作工作流面板，阶段与运行来自服务端投影

#### Scenario: 文本入口
- **WHEN** 用户从 pane dock 打开 production.pipeline.v1（text 项目）
- **THEN** 同一面板呈现 text 六阶段与运行泳道，unknown 阶段如实标注

#### Scenario: 失败与回滚
- **WHEN** 查询失败或合同未签约
- **THEN** 面板显示 needs_contract/offline 诊断态；卸载挂载即回滚，不影响任何 owner 或 workflow 状态
