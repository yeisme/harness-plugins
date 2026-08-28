## ADDED Requirements

### Requirement: Workspace and function hierarchy
Web SHALL 在支持的原生 grouping seam 中按 Workspace 父组和功能类型子组显示会话，并在 seam 缺失时诚实回退 Workspace 视图。

#### Scenario: Hierarchy capability is unavailable
- **WHEN** 当前 DSH build 不支持父组字段
- **THEN** Client SHALL 保留原生 Workspace 分组并显示管理页入口，不得替换 sidebar 或 DOM patch

### Requirement: Quick organization controls
侧栏 SHALL 提供功能类型、标签、状态和关键词筛选，以及单会话功能/标签编辑入口。

#### Scenario: User edits a session function
- **WHEN** 用户在快捷编辑器选择新功能类型并保存
- **THEN** Client SHALL 提交 CAS assignment、锁定功能字段并在 receipt 后刷新分组

### Requirement: Dedicated conversation manager
Web SHALL 提供独立管理页，支持组合筛选、多选、全选当前结果、批量分类/标签、规则、待确认归档、回收站和操作历史。

#### Scenario: Select all filtered sessions
- **WHEN** 用户选择“全部当前结果”并打开批次预览
- **THEN** 页面 SHALL 展示固定目标数量、动作摘要、不可用项和 decisionRef 状态

### Requirement: Full visible conversation search
管理页 SHALL 通过 DSH history owner 搜索标题、组织元数据及用户/助手可见文本，并排除隐藏提示、推理、原始工具输出和 provider payload。

#### Scenario: Search result contains a message anchor
- **WHEN** history owner 返回可见 assistant 文本命中和 anchor
- **THEN** Web SHALL 打开 canonical Session 并定位该 anchor

### Requirement: Temporary administrator purge gate
批量永久删除 SHALL 仅在 15 分钟临时管理员解锁期间可见，并要求包含目标数量的确认短语和 owner terminal receipts。

#### Scenario: Admin unlock expires
- **WHEN** 解锁超时或页面 reload
- **THEN** purge 控件 SHALL 隐藏且未提交计划 SHALL 不再可执行

### Requirement: Accessible management interactions
管理页 SHALL 支持键盘操作、可访问名称、焦点恢复，以及 loading、empty、error、partial、disabled 和 dense-data 状态。

#### Scenario: Batch dialog closes with Escape
- **WHEN** 非执行中的批次对话框获得焦点且用户按 Escape
- **THEN** 对话框 SHALL 关闭并把焦点还原到触发控件
