## Why

现有右侧 overlay 遮挡主对话，内部标签栏与竖栏重复；真实鼠标拖出标签后几何没有变化。完整工作台需要宿主统一布局，并把官方会话作为可独立绑定的 Pane。

## What Changes

- 宿主管理停靠树、悬浮组、焦点、尺寸、拖拽事务和按项目保存的布局。
- 侧栏会话可拖入工作区；单击遵循预览标签规则；同一会话只保留一个 Pane。
- 多会话与跨项目会话并排，沿用官方会话绑定、输入状态和历史读取。
- 插件兼容入口转交宿主；统一视图目录替代重复导航，完整模式不挂载 overlay。
- 隔离源码与 profile 联合验证后交付本机可回退入口；不发布或推送。

## Capabilities

### New Capabilities
- `dsh-unified-multi-pane-workbench`: 宿主统一多 Pane 布局、官方会话独立绑定、插件适配与本机联合验收。

### Modified Capabilities

无。现有接口增量兼容，旧布局记录保留。

## Impact

Owner 分类为 split-owner：DSH ui-layout / renderer / session-controller 拥有布局和会话呈现生命周期；harness-plugins 拥有插件视图注册兼容、补丁交付与验收证据。业务会话、运行、消息账本与插件领域数据继续由原 owner 管理。
