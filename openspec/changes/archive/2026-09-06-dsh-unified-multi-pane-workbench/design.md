## Context

用户已确认完整多 Pane 方案。基线为 DSH dsh-v0.1.2-rc.1，源码提交 a66e4702047846cdaa10c66c9d3df3951f5ea70d。旧 pane-workspace-layout 补丁面向较早宿主，只提供右侧／底部区域，需按当前源码增量迁移。

## Goals / Non-Goals

目标包含侧栏拖出、标签排序、跨组移动、四向分屏、尺寸调整、悬浮／停靠、最大化、预览／固定、多会话隔离、跨项目混排、按项目布局及命名预设。恢复不触发业务动作，关闭不删除会话或取消运行。

用户补充约束：轨迹与所属 session 对话位于同一个 Pane，使用官方会话内部视图切换；不创建独立全局轨迹 Pane。移动、恢复和跨项目混排时轨迹 session 引用不变，A 的视图选择不能切换 B。

不支持浏览器外独立窗口、跨设备同步、复制业务账本、付费生成、外部业务写入或远程发布。

## Decisions

- 宿主 ui-layout 是唯一可提交布局的 owner。纯状态转换复用一个几何投影供绘制、命中和最小尺寸检查。拖拽以原布局快照开始，只在有效释放时提交；取消和并发结构变化丢弃预览。
- Pane 内容在同一个稳定兄弟列表内挂载，只修改位置与可见性，避免 React 跨组重新挂载编辑器。浮层仅在浏览器工作区内。
- SessionProvider 增加可选显式 sessionId，原调用继续跟随当前选择。session-controller 增加可选 present 生命周期，读取真实历史而不改变选择或发送消息。
- 兼容控制器从宿主快照生成只读旧形状，旧 openView／移动意图转交宿主，完整模式关闭插件布局持久化与 overlay。
- 布局采用带版本的独立浏览器存储键，引用字段白名单，保留旧记录；存储异常提示且保留内存布局。
- 使用已有 Vitest 和 Playwright；增加状态转换、会话绑定及真实输入动作测试，不建立并行测试框架。

## Risks / Trade-offs

- 全局会话选择仍有旧消费者 → 显式绑定覆盖输入和 renderer，并通过跨会话草稿／目标断言验证。
- 插件关闭保护与异步保存 → 保留 owner 的 deny／confirm／dirty 规则，不能用关闭视图代替保存。
- HMR 与拖拽并发 → 注册撤销保留占位引用，旧快照事务不得覆盖新结构。
- 小视口 → 遵守最小分屏尺寸，浮窗位置钳制，保留拓扑；不足时反馈原因。

## Migration Plan

在隔离 staging checkout 构建宿主，并使用隔离 DSH_HOME 的官方 web profile 安装本地插件。真实动作链全部验收后通过 upstream-prs 补丁包维护，可复现构建本机联合入口。原安装目录不变，原 dsh 命令可回退；旧宿主 overlay 仅属于兼容模式，不计完成。

## UI Contract

- Surface classification: embed（宿主 chrome）；插件内容沿用既有 adopted Surface。
- Surface kind: workspace。
- First / second / third visual priority: 当前内容；组标签及会话原项目；添加面板和布局操作。
- Existing components reused: 官方 conversation slot、SessionProvider、输入状态服务、DSH CSS token；插件现有 Surface 与视图工厂。
- Cards that earn existence: 仅独立可移动的 Pane 组和临时视图目录，无额外装饰卡片。
- Primary scroll owner: 各 Pane 内容拥有滚动；标签栏独立横向滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 对话 | 官方加载态 | 官方新会话 | 官方错误及重试 | 真实历史与输入 | 沿用连接状态 | 保留输入阻塞原因 |
| 插件 | provider 加载态 | 原 Surface 空态 | 保留缺失占位 | 原 provider 内容 | 原 owner 状态 | 原 owner 原因 |
| 布局 | 恢复验证 | 打开会话／添加面板／恢复默认 | 存储失败提示 | 提交后保存 | 旧记录保持可选 | 禁止落点及原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 侧栏可收起，标签可滚动，禁止过窄分屏 | 按实际组尺寸判定分屏 | 默认首次工具 60／40 分屏 |

### Accessibility

- Keyboard path: 标签 roving focus、方向键排序、Enter 保留、Delete 关闭；分隔线方向键调整。
- Focus owner/return: 当前 Pane 与所属标签；目录关闭回触发点；Escape 取消拖动。
- Visible labels and accessible names: 语义图标配标题和可访问名称，跨项目始终显示原项目。
- Reduced motion and coarse pointer: 几何跟随指针，无强制动画；触控拖动手柄与更宽分隔线命中区。

### Visual Exceptions

宿主 chrome 使用其原生 CSS Modules 和 token，不引入 Yeisme Surface 依赖到上游。插件嵌入内容继续原 Surface；通过联合截图验证边界。

### Cross-host Semantics

- Canonical data/action/receipt owner: DSH 官方会话服务及各领域 owner；ui-layout 只拥有浏览器展示状态。
- Same capability in Workbench: conversation 与原插件 view kind。
- DSH role: primary。
- Shared states and wording: 使用原 owner 的加载、未知、不可用与错误状态。
- Handoff trigger and target: 既有插件动作，保持原 action identity。
- Semantic differences allowed: 仅展示位置、预览／保留状态和布局几何。
- Pixel differences intentionally ignored: 无；继承宿主主题，使用语义图标映射。
