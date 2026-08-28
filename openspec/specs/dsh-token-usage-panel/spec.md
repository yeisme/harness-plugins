# dsh-token-usage-panel Specification

## Purpose
TBD - created by archiving change dsh-token-usage-panel-v1. Update Purpose after archive.
## Requirements
### Requirement: Tokens 入口始终可见且不装死
系统 SHALL 在官方 web ui 会话头 `conversation.session.header.actions` 注册一条 id 为 `token-usage-open` 的 “Tokens” 入口。Host Remote `tokenUsage` 不可用时，入口 MUST 保持可见、MUST 为 disabled，且 MUST 用可读原因说明 Host 不可用；MUST NOT 隐藏按钮，MUST NOT 在无 Remote 时打开空面板。

#### Scenario: Host Remote 就绪且 Pane Workbench V2 就绪
- **WHEN** `tokenUsage` Remote 可调用，且 `paneWorkbench` 与 `shell.workspace.right` 协议齐全
- **THEN** 点击 Tokens SHALL 打开右侧栏 navigator 视图 `workspace.token-usage`

#### Scenario: Host Remote 就绪但 Pane 协议缺失
- **WHEN** `tokenUsage` Remote 可调用，但缺少 `paneWorkbench` 或 `shell.workspace.right`
- **THEN** 点击 Tokens SHALL 打开 `shell.overlay` 弹窗，且 MUST NOT 伪造右侧栏几何

#### Scenario: Host Remote 缺失
- **WHEN** 插件 probe 不到 `tokenUsage` Remote
- **THEN** Tokens 按钮 SHALL disabled，title 或等价可访问描述包含不可用原因，点击 MUST NOT 打开面板

### Requirement: 右侧栏与弹窗共用同一只读面板
系统 SHALL 用同一视图模型渲染用量与余额；右侧栏与 overlay 弹窗 MUST 展示相同的会话/今日/本周/提供方拆分与 DeepSeek 余额块。弹窗 MUST 使用 `role="dialog"`，关闭后 overlay seat MUST 零渲染。插件卸载 SHALL 移除入口、Pane view、overlay seat 与 locale。

#### Scenario: 打开 overlay 后关闭
- **WHEN** 用户在 Pane 缺失环境打开 Tokens 弹窗并关闭
- **THEN** `shell.overlay` 条目 SHALL 不再输出可见节点

#### Scenario: 卸载插件
- **WHEN** bundle 被移除或插件上下文销毁
- **THEN** header 入口、Pane view、overlay seat 与 locale 字典 SHALL 恢复到注册前状态

### Requirement: 面板只读与安全投影
浏览器面板 MUST 只消费 Host 提供的 `token.usage.snapshot.v1alpha1` 与 `token.balance.snapshot.v1alpha1`。面板 MUST NOT 发起对 DeepSeek 或其他提供方的网络请求，MUST NOT 持有 API key、cookie、raw URL、绝对路径或未脱敏 provider payload。凭证形态字段即使出现在投影里也 MUST 拒绝渲染。

#### Scenario: 投影含非法键
- **WHEN** 用量或余额投影携带 `apiKey`、`bearer`、`authorization` 或 URL 形态字段
- **THEN** 面板 MUST 丢弃这些字段，DOM 与日志 MUST NOT 出现其值

#### Scenario: 会话用量投影缺失
- **WHEN** 当前会话没有 `tokenUsage` 计量
- **THEN** 会话块 SHALL 显示明确的不可用文案，MUST NOT 用 0 冒充已计量

### Requirement: DeepSeek 余额块的诚实降级
当余额投影 `status` 为 `unsupported`、`unavailable` 或 `error` 时，系统 SHALL 显示 `safeMessage` 与 `reasonCode` 对应的可读原因，MUST NOT 显示伪造金额。`unsupported` 时 Refresh MUST 禁用；`ready` 或 `stale` 时 Refresh SHALL 只触发 Host `refreshBalance` action。

#### Scenario: 当前提供方不是 DeepSeek 官方路由
- **WHEN** 余额投影 `status` 为 `unsupported` 且 `reasonCode` 为 `provider_not_deepseek`
- **THEN** 余额块 SHALL 说明仅 DeepSeek 官方路由支持余额，Refresh SHALL disabled，MUST NOT 显示金额

#### Scenario: 余额查询失败但曾有成功投影
- **WHEN** 刷新失败且 Host 仍返回上一份带金额的 `stale` 投影
- **THEN** 面板 SHALL 继续显示该金额并标记 stale，MUST NOT 清空为 0

