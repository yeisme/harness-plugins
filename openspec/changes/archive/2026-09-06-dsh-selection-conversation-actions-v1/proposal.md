## Why

用户反馈选区工具条及批注浮层与 DSH 宿主视觉脱节，最右侧控件无法完成“单击固定、按住拖动”；现有入口也未形成“选中内容 → 添加到对话／带引用询问 → 继续对话”的连续体验。用户提供的 Codex 截图作为体验参考，不作为其内部实现或本项目验收通过的证据。

本轮仅更新规格、设计说明与待实施任务，完成后等待用户下一步指令。

## What Changes

- 明确“添加到对话”“引用并询问”“更多详情”及次级批注入口的层级、焦点和反馈。
- 通过宿主明确的目标会话引用加入现有草稿，支持显式选择另一会话或新建对话；不自动发送。
- 引用展示来源、摘要、详情、定位与移除；缺少结构化来源时提供明确的纯文本引用选择，不伪造 owner/ref。
- 定义最右侧控件的单击固定／取消固定、指针阈值拖动、取消、视口约束及键盘替代操作。
- 补齐实际宿主主题、相邻插件、输入状态、多 Pane、失效来源与真实指针事件验收。
- 保留既有批注、旧 pin 事件、V1 引用合同及其持久化记录，不将视觉位置固定与旧选区收藏语义混用。

## Capabilities

### New Capabilities

- `dsh-selection-conversation-actions`: 对话优先的选区操作、位置固定与拖动、来源降级、宿主视觉和验收合同。

### Modified Capabilities

无。新增要求通过并行可探测能力与明确的 UI 行为补充现有合同，不删除或重定义已发布字段、动作或事件。

## Impact

规划涉及 ui-interaction-space、ui-selection-annotation、ui-pane-workbench 与既有宿主引用桥接；主题复用 ui-visual-kit、ui-surface 和官方 primitives。此补充依赖 `dsh-web-composer-references-theme-v1` 的引用草稿与发送链路，及 `dsh-unified-multi-pane-workbench` 的明确 session/Pane 引用；不建立另一套会话、编辑器或消息账本。

能力归属为 split-owner：插件拥有选区操作与其展示状态；DSH 宿主拥有会话、草稿、焦点、发送及 overlay 能力；资源 owner 拥有来源授权与版本。现有相关 change 的完成记录保持原样，本补充任务全部等待实施。
