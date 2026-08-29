## ADDED Requirements

### Requirement: Show Control SHALL register four bounded Pane views
Client SHALL 注册 `drama.show-board`、`drama.review-inbox`、`drama.asset-wall` 和 `drama.delivery`，注册/dispose MUST 幂等且不得创建第二 Pane shell。

#### Scenario: Show Control capability is ready
- **WHEN** Pane Workbench、Drama context 与 Show Control remote 均可用
- **THEN** 四个 Pane SHALL 出现在 Quick Pick/command registry，并可独立打开

### Requirement: Show Board SHALL support episode navigation without owning context
Show Board SHALL 展示 episode stage/status/progress/attention/delivery readiness；查看详情不改变 owner context，设置 current episode MUST 走 owner action descriptor。

#### Scenario: User selects a different episode
- **WHEN** 用户仅选择一行查看详情
- **THEN** Client SHALL 更新本地 inspector，不修改 current DramaContext

### Requirement: Review Inbox and Asset Wall SHALL use bounded paging and selection
Review Inbox 与 Asset Wall MUST 使用 opaque cursor paging；selection 仅覆盖已加载实体且最多 100 个。

#### Scenario: Filter or snapshot generation changes
- **WHEN** 用户修改筛选或 authoritative snapshot generation 改变
- **THEN** selection SHALL 清空，旧 cursor 和 action preview SHALL 失效

### Requirement: Show Control panes SHALL be responsive and accessible
四个 Pane MUST 支持 desktop、768px 和 390px；表格在窄 Pane SHALL 转为可键盘操作的 list/detail，所有 action、filter、pagination 和 selection MUST 有可访问名称与 disabled reason。

#### Scenario: Review Inbox at 390px
- **WHEN** Pane 宽度为 390px
- **THEN** review rows SHALL 纵向展示，批量栏保持可达且无横向溢出
