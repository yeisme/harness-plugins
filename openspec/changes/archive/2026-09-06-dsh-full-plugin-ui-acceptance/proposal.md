## Why

全插件启用时，Creator Studio 曾因浏览器产物遗留 runtime 外部依赖而阻断启动。现有 bundle 检查未执行真实 factory；插件启动顺序也会使 Creator Studio 永久停留在 unavailable。共享视觉层存在字号继承、输入框样式和尺寸变量缺失，选区批注缺少真实浏览器覆盖。

## What Changes

- 对真实 Creator Studio 客户端产物执行 ModuleLoader factory 回归验证。
- Creator Studio 监听 Pane 服务到达与撤销，保持启动顺序无关和异步挂载生命周期安全。
- 统一共享字号、字体继承、输入框及触控/间距 token，收敛选区批注的结构与控件。
- 增加真实批注组件中英文、三种宽度、焦点与关闭测试，保留人工审查后的视觉基线。
- 增加全量检查和真实 Web 验收命令，保存脱敏证据，区分启动通过、可见入口和功能未验证。
- 自定义 profile 缺少官方 Web app 时准备检查明确失败。

## Capabilities

### New Capabilities
- `dsh-full-plugin-ui-acceptance`: 全量插件本地启动、UI 与分层验收证据。

### Modified Capabilities

无删除、重命名或协议字段变更；补齐已有视觉规范，不引入新的业务 owner。

## Impact

Owner 为 harness-plugins（fit）。影响共享视觉组件、Creator Studio 生命周期、本地开发脚本与测试；不修改官方 DSH、远端基础设施或领域数据。
