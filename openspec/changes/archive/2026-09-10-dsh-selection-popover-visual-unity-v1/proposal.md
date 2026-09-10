## Why

用户指出整体风格尚未统一，选中后的弹出交互框与主界面明显不一致，并明确以 Codex 为核心体验参照。此次只处理选区浮层视觉统一，不恢复之前停止的创作功能扩展。

## What Changes

统一选区工具条、更多菜单、引用详情与输入弹框的浮层背景、边框、圆角和阴影。主要动作使用中性强调，去除工具条彩色装饰点。保留键盘、拖动、固定、引用和草稿行为。

## Capabilities

### New Capabilities
- `selection-popover-visual-unity`: 选区浮层视觉一致性。

## Impact

ui-interaction-space、ui-selection-annotation 的 scoped CSS，以及既有选区浏览器夹具。无新依赖、无协议变化。Codex 为用户指定的设计参照，未声称精确复刻其私有实现。
