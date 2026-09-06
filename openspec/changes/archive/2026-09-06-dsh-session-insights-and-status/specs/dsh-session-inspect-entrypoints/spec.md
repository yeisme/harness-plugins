## ADDED Requirements

### Requirement: 按发起会话解析 status 命令

系统 SHALL 为 /status 和 /status tokens 提供显式 inspect resolver，并冻结发起命令的 sessionRef；MUST NOT 使用最近活动会话替代。

#### Scenario: 输入 status

- **WHEN** 用户在会话 A 输入 /status，随后焦点切到 B
- **THEN** 结果仍关联 A，不返回 no inspect resolver for status，不向模型发送。

#### Scenario: 无会话或未知子命令

- **WHEN** 命令缺少 sessionRef 或子命令不是受支持语法
- **THEN** 返回可理解的选择会话提示或语法说明，不创建运行。

### Requirement: 保留既有状态表面降级及命令生命周期

/status SHALL 使用既有状态 owner 与 Popover → Pane → 安全文本降级链，并产生既有 command lifecycle 事件；结果 MUST NOT 进入模型历史。

#### Scenario: 只有其他会话的 Header

- **WHEN** A 的 Header 不可用但 B 的 Header 可用
- **THEN** 打开绑定 A 的状态 Pane；不得借用 B 的 Popover。

#### Scenario: 没有视觉 seam

- **WHEN** Header 和 Pane 都不可用
- **THEN** 返回 A 的有界安全文本及原因，不能声称打开成功。

### Requirement: 用量详情与轨迹导航

/status tokens SHALL 打开绑定原 session 的 workspace.token-usage；同 session 复用现有实例，请求行 SHALL 通过 owner ref 定位同 session Pane 内的轨迹。

#### Scenario: 详情重复打开

- **WHEN** A 已有统计 Pane，用户再次执行 /status tokens
- **THEN** 聚焦 A 的已有实例，不创建重复统计或运行。

#### Scenario: 定位不可用

- **WHEN** 请求存在但官方定位能力不可用
- **THEN** 保留统计视图并显示原因，不跳到其他会话或制造轨迹。
