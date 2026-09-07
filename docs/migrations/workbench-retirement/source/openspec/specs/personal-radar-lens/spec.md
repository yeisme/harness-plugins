# personal-radar-lens Specification

## Purpose
TBD - created by archiving change personal-radar-lens-v1. Update Purpose after archive.
## Requirements
### Requirement: Workbench MUST 通过固定 server-side adapter 访问 Radar
WorkbenchTaskService 的 Radar adapter MUST 使用服务端配置的固定 binary 与固定 argv `mcp --transport stdio --lane <reader|curator|operator>` 启动 Radar MCP。浏览器 MUST NOT 传 binary、argv、cwd、env、绝对路径或任意 MCP method；任何此类请求 MUST fail closed 且不启动子进程。

#### Scenario: 浏览器请求合法 typed operation
- **WHEN** 请求只携带 typed operation 参数（ref、filter、idempotency key）
- **THEN** adapter 校验 lane、operation allowlist、scope 与 capability 后调用 Radar MCP

#### Scenario: 浏览器尝试注入 argv
- **WHEN** 请求包含 binary、argv、cwd、env 或未注册 MCP method
- **THEN** adapter 拒绝且不启动子进程，返回 stable reason code

### Requirement: Consumer 动作必须是 lane、operation allowlist、capability 的交集
有效动作 MUST 同时满足 Radar lane、Workbench operation allowlist 与当前 capability。operator 会话 MUST 只暴露 `edition_build`；collect、score、cluster_build、daily_run MUST NOT 出现在浏览器可见动作中。

#### Scenario: operator 会话存在但 collect 未批准
- **WHEN** adapter 使用 operator lane 处理 Refresh Edition
- **THEN** 浏览器只能调用 `edition_build`，调用 collect/daily_run 按未知 operation 拒绝

#### Scenario: curator capability 降级
- **WHEN** Radar feedback backing unavailable
- **THEN** Save/Dismiss 从 allowed actions 消失并显示 owner blocker，客户端不写本地替代状态

### Requirement: For You 首屏 MUST 直接回答机会、适配原因与证据可靠性
For You 视图 MUST 显示 latest Edition、active profile revision、freshness、机会卡与 source status；每张机会卡最多 3 个主 reason 和 1 个主要风险，禁止长问卷、黑盒综合分和不可验证文案。

#### Scenario: 尚未配置 Profile
- **WHEN** Radar 返回 `profile_required`
- **THEN** Lens 显示三步 CLI setup（命名、核心题材/受众、blocked topics），不创建隐式默认 Profile

#### Scenario: 无或空 Edition
- **WHEN** Radar 返回 empty/degraded Edition
- **THEN** 显示真实原因与安全 next action（如 `radar edition build` 提示），不补低质量机会

### Requirement: Opportunity Detail MUST 分开展示三类分数与解释
Detail MUST 分开展示 market score、personal fit、evidence confidence、稳定 reason codes、主要风险、source/evidence refs 与 known limitations。Workbench MUST NOT 生成替代 owner 的黑盒综合分。

#### Scenario: 高热度低适配
- **WHEN** projection 返回高 market score、低 personal fit
- **THEN** Detail 保留两者差异并解释 Profile mismatch

#### Scenario: 证据降级
- **WHEN** evidence confidence 低或 source degraded
- **THEN** 显示明确限制、freshness 与补证据动作，proposal action 按 owner policy 禁用或二次确认

### Requirement: 反馈与 Edition build MUST 经 typed operation 且 receipt 为唯一成功真源
Save/Dismiss/Not relevant/Too risky/Already seen/opportunity review MUST 经 Workbench typed client → server-side curator action；`Refresh Edition` SHALL 只调用 allowlisted `edition_build` 并显示确认提示（active profile revision、source freshness）。

#### Scenario: 保存机会
- **WHEN** 用户点击 Save
- **THEN** Workbench 提交带 idempotency key 的 typed operation，仅在收到 Radar feedback receipt 后显示成功

#### Scenario: 保存响应丢失
- **WHEN** 请求可能成功但 Workbench 未收到响应
- **THEN** 状态为 unknown，按原 idempotency key 查 receipt，不提交第二条反馈

### Requirement: My Projects MUST 读取 proposal/handoff owner 真实回执
My Projects SHALL 展示 Workbench proposal control plane 或下游 domain owner 的 safe summary；Radar `used` feedback MUST NOT 被解释为项目已创建、完成或投放成功。

#### Scenario: 只有 used 反馈没有下游回执
- **WHEN** Radar 仅存在 `used` feedback
- **THEN** UI 标记 “reported as used” 而不是伪造项目状态

### Requirement: Taste & Feedback MUST 保持 Profile 只读
Taste & Feedback 只显示 Profile 安全摘要、revision、近期反馈与排序变化解释；编辑入口只能渲染 CLI suggestion，MUST NOT 直接 mutation Profile。

#### Scenario: 用户想修改题材偏好
- **WHEN** 用户在 Taste & Feedback 点击编辑
- **THEN** UI 展示 `radar profile set ...` suggestion 与 revision 说明，不调用任何 mutation

### Requirement: Handoff 必须使用安全 typed refs
Workbench 生成与消费 `PersonalRadarOpportunityHandoffV1`，只携带 edition/opportunity/profile revision refs、reason/evidence refs、target owner、user intent、idempotency key；完整领域 payload MUST 由目标入口重新向 owner 读取。

#### Scenario: DSH 打开 Workbench Detail
- **WHEN** deep-link 携带 opportunity/profile revision refs
- **THEN** Workbench 校验 digest/freshness 后重新读取 projection，不信任 URL 自报分数或正文

#### Scenario: Handoff 引用 stale Profile
- **WHEN** profile revision 不再是 active revision
- **THEN** 显示历史上下文，让用户选择按旧版审查或回到最新 Edition

### Requirement: Lens MUST 覆盖关键状态且不只靠颜色
Workbench 与 Radar 联动状态（ready、empty、degraded、stale、offline、permission_denied、contract_mismatch、action_pending、reconcile_required）MUST 以文本+图标表达并各给安全 next action。客户端缓存 MUST NOT 冒充 live 成功。

#### Scenario: 离线读取最近 Edition
- **WHEN** Radar offline 但存在最近安全缓存
- **THEN** 只读显示 observed_at/freshness，明确标记离线并禁用 mutation

#### Scenario: Profile 切换
- **WHEN** active profile revision 变化
- **THEN** 清理旧 profile-scoped selection/cache，重新读取 projection，不混合两个 Profile 的数据

### Requirement: Lens MUST 可访问且响应式
Lens SHALL 提供键盘等价、可见焦点、screen-reader label 与成功后焦点恢复；移动端支持阅读、反馈与 proposal review，复杂 compare 提示 desktop required。

#### Scenario: 仅键盘保存机会
- **WHEN** 用户通过键盘进入机会卡与 Save
- **THEN** 焦点顺序稳定、状态被朗读、成功后焦点回到原机会上下文

#### Scenario: 窄屏查看详情
- **WHEN** viewport <768px
- **THEN** Detail 使用单一 sheet/stack，无水平不可达操作；Compare 显示 desktop required

