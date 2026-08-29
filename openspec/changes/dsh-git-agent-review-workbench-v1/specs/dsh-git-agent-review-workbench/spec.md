## ADDED Requirements

### Requirement: Git Review Workbench 必须保持 split-owner 边界
系统 MUST 由 Git owner 持有 repository/worktree status、diff、history 与副作用，由 Ordo 持有 task、Agent、lease、reviewed、feedback、verification、override evidence 与 Pause/Resume；Harness Plugins MUST 只组合 typed safe projection、opaque ref、presentation state 和 owner receipt。

#### Scenario: Git Pane 遇到活动 lease
- **WHEN** 用户请求移除带有 Ordo active lease 的 worktree
- **THEN** Git Pane 阻止 remove、显示 Ordo deep link，且不得释放或修改 lease

### Requirement: 新合同必须 additive 并保留 V1 fallback
系统 MUST 保留 `GitTypedActionsCapabilityV1`、`GitDiffWindowCapabilityV1` 和现有 Changes V1 consumer 语义；新 status/diff/mutation/history/compare/review/stash/tag 能力 MUST 通过新增可选 capability 接入。

#### Scenario: 旧 Git host 加载新 Pane
- **WHEN** host 只提供现有 status、diff 和 typed actions V1
- **THEN** Pane 默认显示现有 Changes 工作流，所有新视图显示 capability unavailable，旧动作仍按原合同工作

### Requirement: Git Pane 必须按 capability 提供单入口多视图
系统 SHALL 在同一个 Git Pane 提供审查队列、更改、历史、分支、Worktree、Remote、Stash 与 Tag 视图；检测到可用 Review Queue 时 SHALL 默认进入审查队列，否则 MUST 默认进入更改。

#### Scenario: Review Queue 不可用
- **WHEN** `GitReviewEvidenceCapabilityV1` 缺失或 stale
- **THEN** Pane 不创建第二个 Git 入口，并回退 Changes 或显示明确 unavailable reason

### Requirement: Status 与 History 必须窗口化
Git owner MUST 通过 snapshot + subscribe + cursor 发布 bounded status/history window，并提供 repositoryRef、worktreeRef、revision、freshness、分组计数、loaded/total、opaque refs 与 next cursor；浏览器 MUST NOT 把完整 10,000 文件或 1,000,000 commits 快照放入 React state。

#### Scenario: Status cursor gap
- **WHEN** 客户端收到非连续 sequence 或 expired cursor
- **THEN** 客户端保留最后安全窗口、标记 stale、禁用 mutation，并在 owner snapshot reconcile 后原位恢复 selection 与 scroll

### Requirement: Diff 必须支持 revision 绑定窗口和风险元数据
`GitDiffWindowCapabilityV2` MUST 支持 unified 与 side-by-side window、hunk opaque refs、loaded/total、base/target/current revision、generated、binary、secret-risk 和 owner allowed actions，同时保留 V1 diff window。

#### Scenario: Revision drift
- **WHEN** diff target revision 与当前 worktree revision 不一致
- **THEN** 所有 reviewed 证据和 target mutation 失效，UI 显示 drift 并要求 reconcile

#### Scenario: 疑似 credential
- **WHEN** owner 将 diff 标记为 secret-risk
- **THEN** UI 显示文本风险警告，并阻止未经明确确认的 share/export；diff 原文不得进入日志或持久化

### Requirement: Reviewed 与 feedback 必须形成 Ordo 审查闭环
Ordo MUST 以 worktreeRef、fileRef、hunkRef 和 revision 绑定 reviewed evidence；文件 reviewed 状态 MUST 由当前 revision 的全部 hunks 聚合。评论 MUST 形成 revision 绑定的 change request，并在解决前阻塞 Agent worktree commit。

#### Scenario: Agent 修复反馈
- **WHEN** Agent 根据 change request 修改同一文件并产生新 revision
- **THEN** 旧 reviewed 状态失效，feedback 保留 lineage，用户必须审查新 hunks 后才能满足 readiness

### Requirement: Agent worktree commit 必须经过 readiness 与可审计覆盖
Agent worktree 只有在无冲突、revision 稳定、全部 hunks reviewed、verification passed、feedback resolved 且 Ordo online 时 SHALL ready；用户 MAY 提交非空理由形成 override evidence，但 Git owner 仍 MUST 执行 commit preflight。

#### Scenario: Ordo offline
- **WHEN** Agent worktree 的 Git owner online 但 Ordo offline
- **THEN** 用户仍可查看 status 与 diff，但 reviewed、feedback、Pause/Resume、Commit 和 Discard 治理动作均禁用

#### Scenario: 普通 worktree
- **WHEN** worktree 未关联 Ordo Agent
- **THEN** Commit 使用标准 Git preflight，不要求 reviewed 或 verification evidence

### Requirement: Mutation V2 必须预检、幂等且可 reconcile
`GitMutationActionsCapabilityV2` MUST 支持 file/hunk/batch stage、unstage、discard backup/execute/undo、commit preflight/execute、idempotency 与 receipt query。Commit MUST NOT 自动暂存；timeout/unknown MUST NOT 自动 retry 或标为成功。

#### Scenario: Stage All
- **WHEN** 用户对当前 worktree 请求 Stage All
- **THEN** owner 返回目标数量和 preview digest，execute 只作用该 repositoryRef + worktreeRef

#### Scenario: Discard Undo
- **WHEN** 用户确认 discard
- **THEN** owner 先生成 backup receipt，再执行 discard，并提供最多 24 小时或至显式清理的 Undo receipt

### Requirement: Commit preflight 必须显式确认真实范围
Commit preflight MUST 展示 staged 范围、branch、author、signing、hooks、verification、preview digest、risk 与 allowed action；Agent message 建议 MAY 编辑，但用户 MUST 显式确认，且快捷键只确认当前有效 preflight。

#### Scenario: staged revision 改变
- **WHEN** preflight 后 staged revision 或 digest 改变
- **THEN** 原 preflight 失效，Commit 禁用并要求重新预检

### Requirement: Review Queue 必须按风险优先且保留 owner lineage
Review Queue MUST 聚合多 repository/worktree，并按 conflict、revision drift、verification failed、unresolved feedback、approval pending、last activity 排序；每行 SHALL 显示 task、Agent、branch、lease、risk、review progress 和 activity time。

#### Scenario: 两个 worktree 风险不同
- **WHEN** 一个 worktree 有 conflict，另一个只有较早的待审批
- **THEN** conflict 项排在待审批项之前，且 selection 使用各自 opaque repository/worktree refs

### Requirement: Worktree 与 Agent 生命周期必须分离
创建 worktree 和启动 Agent MUST 是两个独立 receipt；进入审查 MUST NOT 自动 Pause，Pause/Resume 只能由 Ordo action 明确执行。

#### Scenario: 创建后不启动 Agent
- **WHEN** worktree create receipt 成功但用户未请求 launch Agent
- **THEN** worktree 保持普通 Git worktree，不生成虚构 Agent 或 lease 状态

### Requirement: History、Compare、Branch、Remote、Stash 与 Tag 必须安全渐进
History MUST 默认当前分支并使用虚拟 Graph 表格与 Inspector；Compare Session 只能持久化 opaque refs、query、layout 和 revision。脏树 branch switch MUST 预检并建议新 worktree；Pull 无配置时 MUST 为 ff-only；Force Push MUST 默认不可用。Stash Pop/Drop 与 Tag delete/push MUST 统一预检，Tag 默认 annotated，signing 跟随 owner config。

#### Scenario: 脏树切分支
- **WHEN** 当前 worktree 有未提交更改且用户请求 switch branch
- **THEN** owner preflight 显示风险并默认建议创建新 worktree，而不是直接丢弃或自动 stash

### Requirement: UI 必须使用语义 token、响应式密度与等价状态表达
桌面 Git 行高 MUST 为 28px，coarse pointer 目标 MUST 至少 44px；颜色 MUST 来自 visual-kit semantic tokens，并与 M/A/D/R/!、文本或图标共同表达。`<560px` 导航 MUST 收敛为可搜索 View Selector，Dark、Light、High Contrast 与 reduced motion 均 MUST 可用。

#### Scenario: 高对比度键盘审查
- **WHEN** 用户在 High Contrast、keyboard-only 模式下审查文件
- **THEN** selected、reviewed、feedback、disabled 和 focus 状态无需依赖颜色即可辨识，F7/Shift+F7 可导航已加载差异

### Requirement: 快捷键冲突必须 fail-closed
Git command binding MUST 通过 registry 检测冲突；冲突 binding MUST 禁用并提示重映射。默认 SHALL 包括 Ctrl/Cmd+Shift+G、F7/Shift+F7 与 Ctrl/Cmd+Enter。

#### Scenario: 打开 Git 快捷键冲突
- **WHEN** registry 已占用 Ctrl/Cmd+Shift+G
- **THEN** Git command 不覆盖原 binding，UI 显示冲突原因和 remap action

### Requirement: 性能与测试必须提供脱敏证据
系统 MUST 覆盖 10,000 changed files、1,000,000 commits 与 2,000 queue/worktree 项的 owner window/浏览器 virtualization；冷首屏 SHALL 不超过 2s、暖首屏不超过 1s、输入/选择反馈不超过 100ms、滚动不得出现超过 50ms 的长任务。integration/component/system/e2e run MUST 写入 `temp/integration-test-runs/<run-id>/` 并脱敏。

#### Scenario: 集成闭环证据
- **WHEN** disposable Git repository 与受控 Ordo projection 完成 Agent 修改到 commit 的流程
- **THEN** evidence 目录包含 summary、command、stdout、stderr、env、artifacts，且不含 diff 原文、credential、raw prompt、provider payload、绝对路径或完整思维链
