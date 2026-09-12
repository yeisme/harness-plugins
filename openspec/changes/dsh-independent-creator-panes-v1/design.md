## Context

已批准计划按独立页面、图像闭环、制作闭环、统一回归推进。复用已有领域 OpenSpec；本变更补充 DSH 本地 CLI 和独立生命周期部分。

## Decisions

保持一个安装包和公共连接。每个领域有独立控制器、错误、候选和草稿；snapshotOwner 只调用对应 adapter。绑定发生变化时保留原内容并阻止继续操作，用户明确重绑定。Gateway 在上下文缺失时仍可返回可恢复的 unavailable 响应。

本地模式通过 execFile 的固定参数数组调用 CLI，读取用户级配置；上下文来自本地 OS 用户与实际工作目录，仅用于本机调用。显式注入的服务上下文优先。本地模式不虚构远程认证，不把工作目录、凭据或命令输出直接传给浏览器。

稳定合同增量增加，旧 snapshot、kind、command 不删除。未知操作只查询原 idempotency key。资产引用固定 run、artifact 和内容摘要，选择与关闭不执行生成或采用。

## UI Contract

- Surface classification: adopted
- Surface kind: workspace
- First / second / third visual priority: 当前图像或镜头；参数与属性；候选或镜头顺序。
- Existing components reused: Surface、SurfaceContextBar、SurfaceSection、官方 Button/Input、CreatorActionComposer、媒体读取与草稿服务。
- Cards that earn existence: 领域工作区、参数栏和候选栏，不增加全领域导航卡。
- Primary scroll owner: Pane 内容；图像放大时仅图像窗口滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| Eikona | 加载状态 | 无资产说明 | 本领域恢复入口 | 当前图像与候选 | 保留原内容 | 原操作未确认时禁用执行 |
| Scaena | 打开中 | 选择镜头提示 | 查询失败保留输入 | canonical 表与制作包 | 保留旧候选 | 草稿未保存时禁止切换 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 树、预览、属性纵向排列；图像独立缩放 | 单列工作区，工具换行 | 主预览配侧栏，底部候选/顺序 |

### Accessibility

- Keyboard path: Tab 到查询、资产、缩放和显式操作；原生按钮支持 Enter/Space。
- Focus owner/return: Pane 与操作 composer；不在轮询中抢焦点。
- Visible labels and accessible names: 输入有 label，图像工具有名称，选择用 aria-pressed。
- Reduced motion and coarse pointer: 无自动动画；触屏使用原生滚动，鼠标可平移。

### Visual Exceptions

图像窗口只为测量后的缩放尺寸使用动态 style；文件 image-viewport.tsx。回退为 fit 显示。验证适应、原尺寸、缩放、360/960px。

## Risks and Open Work

本地 CLI 必须包含新增读取/对账合同；旧版本应诚实 unavailable。Eikona 资产使用项目分页和绑定游标，列表变化不沿用旧位置。Scaena 仅连接真实 canonical 合同，不使用旧 fixtureShotBoard/fixture render。全业务闭环、双项目正式宿主、真实 provider 和视觉认可独立验收，未通过的任务保持开放。
