## Why

现有 `DSH-better-sidebar` 证明了“右侧栏 + 底部面板 + Tab 拖拽分栏”在 DSH Web 中有明确需求，但其焦点驱动的打开目标、移动端迁移、重型视图生命周期和拖拽可访问性会在复杂布局下产生归属混乱、状态丢失或性能风险。Yeisme 需要一套不导入、不链接、不复制该项目源码的独立 Pane Workbench，先冻结核心 pane 交互和扩展合同，再逐步接入文件、终端、Git、任务等视图。

## What Changes

- 新增容器无关的 Pane Workbench 交互合同：受控 split tree、pane group、tab、right/bottom region、激活/焦点/打开目标分离、拖拽/键盘/菜单等价操作、尺寸约束和布局恢复。
- 新增语义化打开路由：Navigator、Content、Utility、Inspector 等 pane role 决定新视图归属；显式目标优先，禁止仅凭“最后点击 pane”决定文件预览或新终端位置。
- 新增 preview/pinned/dirty tab 生命周期：单击资源复用 preview，双击、编辑或显式 Pin 转为常驻；Explorer 等 singleton 视图可锁定 pane，避免被普通预览抢占。
- 新增有界布局：split 深度不超过 2、桌面最多 4 个可见 pane，并按视图最小尺寸拒绝不可用拆分；拒绝拆分时回退为合格 group 的 tab，而不是生成极窄 pane。
- 新增 source-independent DSH 插件接入：核心 client package、`ctx.paneWorkbench` 注册服务和可安装 bundle 只依赖 DSH 官方发布 surface 与 React，不依赖 `dsh-better-sidebar` 包、源码、CSS、状态格式或私有 DOM。
- V1 通过官方 `shell.overlay` 提供可收起的 right/bottom workbench 容器；真正挤压主会话区的 dock/push 模式保留为后续 DSH 官方 additive layout slot，不通过 DOM 选择器、全局 margin 或 core patch 模拟。
- 文件管理、编辑器、终端、Git、浏览器、Subagent 等完整功能保留为后续独立 view provider；本 change 只交付 pane engine、注册合同、示例视图与组装验证。

## Admission Decision

结论：`split-owner`。

| 能力 | Canonical owner | 本 change 的职责 | 状态 |
| --- | --- | --- | --- |
| DSH root layout、slot、session 与主题 | `client/deepseek-harness` | 只消费官方 client seam | retained |
| Pane layout、tab/group/drag/resize 与本地安全持久化 | `agent/harness-plugins` | 新增独立插件和 reducer | deliver-now |
| 文件、终端、Git、任务等领域状态 | 对应 DSH host capability/provider | 仅通过 view descriptor 消费 typed projection | staged |
| 主会话区 push/dock 几何 | DSH `ui-layout` owner | 等待 additive layout contract | retained-next |

## Required Capability Ledger

| 用户要求 | 处理 | 验收证据 |
| --- | --- | --- |
| 参考常见插件复制完整工作台体验 | 保留交互目标，独立重写，不复制实现 | 依赖/源码扫描和 bundle 组装测试 |
| 不进行源码依赖 | 强制只依赖 DSH 官方发布 API；禁止 import/vendor/patch 参考项目 | package dependency 与 repository grep gate |
| 改进交互逻辑 | 用 pane role、open routing、preview/pin、bounded split、responsive projection 替代纯焦点路由与状态迁移 | reducer、组件、键盘和浏览器场景测试 |
| 先设计核心 pane 交互 | 本 change 首先冻结 pane engine 与扩展合同 | OpenSpec design/spec 通过 strict validation |
| 右侧栏 + 底部面板、跨面板移动 | V1 overlay 容器交付；push 模式保留给官方 additive slot | real profile Web 组装测试 |

## Capabilities

### New Capabilities

- `pane-workbench-interaction`: Pane tree、group/tab、语义打开路由、preview/pin、拖拽、键盘、resize、responsive projection、生命周期、恢复和错误隔离。
- `dsh-pane-workbench-extension`: source-independent DSH client service、view registry、官方 slot 组装、bundle 安装卸载和依赖边界。

### Modified Capabilities

无。

## Impact

- 新增候选包：`packages/client/ui-pane-workbench/` 与 `packages/bundle/pane-workbench/`。
- 后续 view provider 可在 `packages/client/ui-pane-*` 和匹配的 host package 中独立交付，不进入 pane engine。
- V1 不修改 `client/deepseek-harness`、不改变 Ordo canonical state，也不新增第三方 dock/layout 运行时依赖。
- 测试复用 Vitest、Testing Library 和现有 Web/profile 组装方式；关键拖拽、键盘、窄屏和 HMR 路径增加 Playwright 证据。
