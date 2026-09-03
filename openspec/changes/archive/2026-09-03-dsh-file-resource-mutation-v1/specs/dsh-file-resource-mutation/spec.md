## ADDED Requirements

### Requirement: Fixed resource mutation actions
系统 SHALL 通过独立 `FileResourceMutationCapabilityV1` 支持 create file、create directory、rename、move、copy、trash、restore 和 import commit。

#### Scenario: Unsupported action
- **WHEN** 客户端提交合同外动作或 Hosted owner 未启用 mutation
- **THEN** owner 返回 typed disabled/rejected，且不执行文件系统写入

### Requirement: Preflight execute reconcile undo lifecycle
每个 mutation MUST 遵循 `preflight → execute → reconcile → undo`，且 execute MUST 消费有效 proposal，而不是客户端自报路径或风险。

#### Scenario: Valid execution
- **WHEN** proposal 未过期、preview digest 匹配、lease/generation/revision 均未漂移且冲突决策完整
- **THEN** owner 在串行临界区执行动作并返回逐项目 receipt 与新 revision

#### Scenario: Unknown result
- **WHEN** 客户端无法确定 execute 是否完成
- **THEN** 相同 idempotency key 进入 reconcile，系统不得盲目重复 mutation

#### Scenario: Undo
- **WHEN** receipt 声明可撤销且 undo token 未过期
- **THEN** owner 验证当前 fence 后执行逆操作并返回 `rolled_back` 或明确 degraded 状态

### Requirement: Owner lease and CAS fencing
intent MUST 绑定 workspaceRef、principalRef、generation、leaseRef、expectedRevision、opaque refs 和 idempotencyKey；任一漂移 MUST 零写入拒绝。

#### Scenario: Revision drift
- **WHEN** preflight 后 workspace revision 变化
- **THEN** execute 返回 `revision_drift`，保留 proposal 和用户选择，目标内容不改变

#### Scenario: Lease lost or owner switched
- **WHEN** candidate/current workspace owner 切换或 lease 失效
- **THEN** pending 请求被取消，execute 返回 `lease_lost`，旧引用进入 stale

#### Scenario: Duplicate idempotency key
- **WHEN** 相同 key 和相同 digest 再次提交
- **THEN** owner 返回既有 receipt 或 reconcile 结果，不重复写入

### Requirement: Explicit conflicts and dangerous confirmation
同名冲突 MUST 要求 cancel、keep-both 或 replace；replace 与永久删除 MUST 使用独立危险确认。

#### Scenario: Conflict without choice
- **WHEN** 目标已存在且 intent 未提供冲突选择
- **THEN** preflight 返回 conflict，execute 不可用

#### Scenario: Replace confirmation
- **WHEN** 用户选择 replace
- **THEN** owner 只有在 Modal 提交匹配的目标短语和未漂移 proposal 后才执行替换

#### Scenario: Keep both
- **WHEN** 用户选择 keep-both
- **THEN** owner 返回确定的新目标摘要与 digest，且不得静默覆盖原目标

### Requirement: Proposal-first Explorer interactions
Explorer SHALL 将菜单、内部拖放、外部拖放与 Import 转换为 proposal，不得由 pointer event 直接写文件。

#### Scenario: Internal drag
- **WHEN** 用户把已选资源拖到目录
- **THEN** UI 生成 move/copy proposal 并在 Pane 内审阅，primary preview 与 checked set 保持独立

#### Scenario: External drop
- **WHEN** 用户拖入本地文件或点击 Import
- **THEN** UI 创建 upload session 和 import proposal；未确认前 workspace 不出现目标文件

### Requirement: Owner-managed trash and restore
trash MUST 由 owner 在 workspace 外管理，默认保留七天并可配置，且跨浏览器重启可 restore。

#### Scenario: Trash and restore
- **WHEN** 用户 trash 资源后重启浏览器并在保留期内 restore
- **THEN** owner 根据 receipt 恢复资源或返回显式冲突，仓库内不创建 `.trash`

#### Scenario: Permanent delete unavailable
- **WHEN** owner 未声明 permanent delete capability
- **THEN** UI 不显示永久删除动作

### Requirement: Redirect reconciliation
rename/move receipt SHALL 返回 owner-authored oldRef-to-newRef redirect。

#### Scenario: Successful redirect
- **WHEN** rename 或 move 成功
- **THEN** Explorer 原子迁移树、打开 Tab、活动引用和未发送固定引用；已发送引用保持冻结

### Requirement: Receipt classification
receipt MUST 区分 success、rejected、revision_drift、lease_lost、unknown、reconcile_required、rolled_back 和 degraded。

#### Scenario: Partial rollback failure
- **WHEN** 多项动作失败且至少一个逆操作失败
- **THEN** receipt 标记 degraded、列出逐项状态并保留可恢复证据
