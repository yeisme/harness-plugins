# 设计

workspace_mode=current-checkout。owned_paths：staging ui-layout 的 keyboard、Workbench、测试、README 与 locale，交付于 pane-editor-shortcuts 补丁；其他脏改动不纳入。

## 能力账本
| 能力 | 结果 |
|---|---|
| 编辑器按键风格 | Ctrl/Cmd+B、反斜杠、数字聚焦；Alt 修饰扩展循环和布局 |
| tmux 类似体验 | 保留任意多组分屏、独立上下文、首尾循环和全树布局 |
| 普通文本输入 | 删除前缀状态、超时和帮助；o/空格不触发布局动作 |
| macOS | 使用物理 code 匹配 Option 字符；不声称完成真机验证 |

## UI Contract
Surface classification: excluded（宿主 shell）。复用现有布局菜单和 picker；移除前缀浮层，不增加视觉层次。Empty 时无操作，已存在内容只移动，终端/modal/IME 保留输入。Primary scroll owner 为各 Pane。

## 兼容和验证
用户明确纠正旧前缀设计，因此 Ctrl+B 恢复直接切换侧栏。现有会话、布局和草稿数据不迁移。沿用宿主 Vitest、现有浏览器测试及六件套证据。验证 Meta/Control、数字聚焦、多组循环、普通输入、类型检查、构建与完整补丁重建。
