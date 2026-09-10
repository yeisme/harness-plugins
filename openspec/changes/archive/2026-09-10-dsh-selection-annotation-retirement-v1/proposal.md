## Why

用户明确要求砍掉截图中的选区工具条/批注插件，停止视觉迭代。

## What Changes

从本机web、ui-acceptance配置移除dsh-selection-annotation依赖及bundle注册；旧bundle入口保持空操作，避免残留配置重新挂载。交互空间不再自动挂载选区singleton。保留已有草稿、引用、历史源码及共享交互空间Pane。

## Capabilities

### New Capabilities
- `selection-annotation-retirement`: 选区插件退役与无副作用兼容入口。

## Impact

选区工具条、批注弹框不再由默认插件加载。历史事件/导出保留兼容，不做数据迁移；不修改其他owner执行能力。
