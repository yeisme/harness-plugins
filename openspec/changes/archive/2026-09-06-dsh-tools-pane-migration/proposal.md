## Why

工具会话 tab 与未完成的设置插件页增加入口负担。用户要求移除两者，使用已有 Pane 管理工具目录、启停与调用观测，并已确认插件页指设置窗口中的插件分区。

## What Changes

- 工具迁入 `mcp-inspector` 单例 Pane，复用 `+`、`/mcp` 和布局生命周期。
- 当前会话订阅、目录读取与释放留在 Pane 内，窄容器分段切换，宽容器可双列。
- 官方设置插件页移除浏览器注册，通过 staging 和 upstream patch 交付；兼容已安装包，保留 host 与 CLI 插件能力。

## Capabilities

### New Capabilities

- `dsh-tools-pane-navigation`: 工具 Pane 的入口、会话隔离、目录降级与设置插件页退役。

### Modified Capabilities

无。旧公开导出与协议保持兼容，UI tab 按用户明确要求移除。

## Impact

涉及 ui-mcp-inspector 与 command-experience-core；官方 UI 改动归 upstream-prs/remove-plugins-settings。无新后端、手动工具调用、持久化 schema、费用或生产配置变更。
