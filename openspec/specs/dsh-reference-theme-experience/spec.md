# dsh-reference-theme-experience Specification

## Purpose
TBD - created by archiving change dsh-web-composer-references-theme-v1. Update Purpose after archive.
## Requirements
### Requirement: Unified reference action hierarchy
选区工具条 SHALL 以引用到对话为主要动作，保留评论、复制与批量收集，通过更多菜单容纳次级动作，并提供具体错误原因和恢复入口。

#### Scenario: Compact selection toolbar
- **WHEN** 工具条位于 360px 容器
- **THEN** 主动作与更多入口保持可见且可用键盘访问，无横向裁切，错误不只显示孤立 Error

### Requirement: Host-owned light dark and system theme
宿主及自有插件 SHALL 共享宿主亮暗/系统偏好与统一语义 token，插件仅以 scoped fallback 补全缺失 token。

#### Scenario: Theme changes with adjacent plugins
- **WHEN** 用户切换主题或系统偏好变化
- **THEN** 输入框、引用标签、菜单、预览及相邻自有插件一致更新，不创建另一套主题存储

### Requirement: Interaction and real-host acceptance
本次交付 SHALL 覆盖 IME、键盘、撤销重做、焦点回归、reduced motion、亮暗和 360/560/960px 视觉验证，并区分插件验证与实际宿主验收。

#### Scenario: Structured reference round trip
- **WHEN** 在实际 DSH Web 中选择文件/选区并随主对话消息发送
- **THEN** 接收端得到可解析引用，历史可预览冻结来源，提交期间新增草稿仍保留，验收写入脱敏证据

