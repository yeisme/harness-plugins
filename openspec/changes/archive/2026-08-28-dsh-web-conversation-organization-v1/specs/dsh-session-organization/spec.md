## ADDED Requirements

### Requirement: Additive organization contract
系统 SHALL 新增 `sessionOrganization` v1 合同，并保持 `sessionTags.list/set`、旧 sidecar 和包导出可继续使用。

#### Scenario: Old tags client remains compatible
- **WHEN** 旧客户端只调用 `sessionTags.list/set`
- **THEN** Host SHALL 保持既有请求、响应、CAS 和标签材料语义

### Requirement: Function and tag catalogs
系统 SHALL 提供全局基础功能类型、Workspace 扩展类型及扁平标签目录，并支持颜色、排序、停用、重命名、合并和删除。

#### Scenario: Workspace extension does not mutate global catalog
- **WHEN** 用户在一个 Workspace 新增功能类型
- **THEN** 该类型 SHALL 仅出现在对应 Workspace 且不改变全局基础类型

### Requirement: Versioned assignment and manual locks
系统 SHALL 以行级版本管理 Session assignment，并阻止自动分类或自动规则覆盖人工锁定字段。

#### Scenario: Automatic classification meets a manual function
- **WHEN** Session 的功能类型已由用户设置并锁定
- **THEN** 自动分类 SHALL 保留人工值并返回 skipped receipt

### Requirement: Bounded automatic classification
系统 SHALL 在标题生成后最多自动分类一次，只读取安全标题和用户消息；confidence 不低于 `0.8` 才能自动写入，新建标签不超过 3 个。

#### Scenario: Low confidence result requires review
- **WHEN** classifier 返回 confidence 低于 `0.8`
- **THEN** assignment SHALL 进入 `needs_review` 且不得自动改变功能或标签

### Requirement: Ordered automation rules
系统 SHALL 按显式顺序执行规则，允许自动分类和标签动作，但归档只生成待确认计划，永久删除不得成为规则 action。

#### Scenario: Two rules assign different functions
- **WHEN** 两条规则同时匹配且都设置功能类型
- **THEN** 排序更靠前的规则 SHALL 获得该字段且结果 SHALL 在预览中说明来源

### Requirement: Receipt-gated batch lifecycle
系统 SHALL 使用 `plan → execute → undo`、`decisionRef`、per-item receipt 和版本检查执行批量操作。

#### Scenario: Target changed after preview
- **WHEN** 用户执行批次前某个目标版本已变化
- **THEN** 该项目 SHALL 返回 stale receipt 且不得覆盖新值

#### Scenario: Undo conflicts with a later write
- **WHEN** 批次写后用户又修改了目标
- **THEN** undo SHALL 保留当前值并返回 conflict receipt

### Requirement: Redacted durable evidence
组织 sidecar SHALL 只保存分类结果、版本、状态、目录、规则和批次 receipt，不得保存 raw prompt、完整对话、推理或 provider payload。

#### Scenario: Classification completes
- **WHEN** classifier 返回合法结构化结果
- **THEN** 持久化记录 SHALL 只包含结果字段、model ref、confidence 和时间元数据
