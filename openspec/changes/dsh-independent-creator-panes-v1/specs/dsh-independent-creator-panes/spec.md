## ADDED Requirements

### Requirement: 独立领域 Pane
系统 SHALL 使用保留的 creator.visual 和 creator.production kind 分别渲染独立领域工作区，不包含重复的全领域导航。

#### Scenario: 并列打开图像和制作
- **WHEN** 用户分别打开两个入口
- **THEN** 两个 Pane 使用独立控制器和领域查询，一个 owner 故障不阻止另一个读取

### Requirement: 本地 CLI 与原操作恢复
系统 SHALL 使用用户级配置和固定参数数组调用本地 CLI，并将 canonical 业务状态留在 owner。

#### Scenario: 操作响应丢失
- **WHEN** 原操作结果未知
- **THEN** 只用原操作标识查询结果，不自动再次生成、采用或导出

### Requirement: 绑定隔离
系统 SHALL 验证当前绑定，且保留旧内容与未保存输入。

#### Scenario: 绑定在读取期间变化
- **WHEN** 迟到响应属于旧绑定
- **THEN** 不将响应显示成新项目内容，并要求明确重绑定后继续操作
