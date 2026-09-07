## MODIFIED Requirements

### Requirement: Tools 工作台首屏层级
系统 SHALL 在现有 conversation.view 的 mcp-inspector entry 内提供会话工具 Tab，默认展示本会话活动。目录作为次级页签，调用或目录详情仅在选中时出现。固定旁栏 SHALL 复用该会话内容与展示状态，不创建并列主壳或 dashboard card mosaic。旧 V1 宽屏常驻目录/活动 58/42 布局和常驻详情页签不再适用于 V2 会话视图；全局管理使用独立目录入口。

#### Scenario: 宽容器会话排错
- **WHEN** 用户打开会话工具 Tab 并选择失败调用
- **THEN** UI SHALL 保留活动列表并在容器允许时并排显示有界详情；目录不常驻占据首屏

#### Scenario: 宽容器正常目录
- **WHEN** Tools 容器宽度充足且目录与活动均有数据
- **THEN** 会话工具 Tab 默认展示本会话活动；完整目录通过次级页签可达，不再以 V1 58/42 常驻双栏占据首屏

#### Scenario: 中窄容器
- **WHEN** Tools 容器小于并排显示列表与详情所需宽度
- **THEN** UI SHALL 保持调用列表可访问，详情支持返回和 Escape，恢复所选行焦点，目录/活动/详情在页签内切换且同一时刻只保留一个主内容滚动区

#### Scenario: 中窄或矮容器
- **WHEN** Tools 容器不足以并排显示列表和详情
- **THEN** UI SHALL 保持调用列表可访问，详情支持返回和 Escape，恢复所选行焦点，不把输入区或统计卡拉伸为大块空白
