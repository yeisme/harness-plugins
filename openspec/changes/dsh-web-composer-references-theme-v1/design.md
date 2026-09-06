## Context

本次在共享 dirty checkout 内实施；Aigora 仅为会话起点，实际 owner 为 harness-plugins 与 DSH 宿主。现有 ComposerReferenceCapabilityV1、公开 conversation.input.dock 和统一视觉系统继续保留。现有并行改动不得回退或作为本次成果重复归属。Open Design 本机命令为兼容 wrapper，并非官方 CLI；使用仓库设计事实源完成设计，不声称获得原生 Open Design 证据。

## Goals / Non-Goals

目标：用户确认的多类型引用与主题统一方案在实际 Web 可用。非目标：外部知识库、跨工作区检索、新调度器、自动工具执行、第三方内容强制换肤、发布部署。

## Decisions

- 新增版本化引用草稿能力，key 由 workspace 与 conversation 构成；既有 V1 保持原有语义。目标以宿主明确的当前主对话为准，不通过最后 DOM 焦点推断。目标失效时要求选择，禁止悄悄切换。
- 引用作为结构化正文节点，附件按 owner/ref/version/scope/anchor 去重。普通 @ 字符保持普通文本。宿主编辑器负责 selection bookmark、IME、undo/redo，不在插件创建另一个 contenteditable。
- 分组发现通过 owner 授权的目录/搜索能力返回 bounded projection；来源缺失时显示不可用原因。目录只取有界清单；图片使用授权资源引用；Agent/技能/工具仅表达类型明确的意图。
- 跨面板插入携带捕获的目标与草稿 revision，保留来源焦点；无有效 bookmark 时追加末尾。批量收集在确认时冻结目标。通知包含目标名及返回输入框动作。
- 发送分 prepare/ack：prepare 冻结正文、引用和提交标识，owner 校验可访问性与版本；ack 只消费本次提交的节点，期间追加不丢失。未知结果不自动重发；失败保留草稿。历史投影读取已冻结快照。
- stale 不自动换内容。刷新与移除由用户明确操作；旧快照必须由 owner 证明仍可读才允许发送。会话关闭、权限撤销和解析失败不降级拼接纯文本。
- 宿主适配使用 upstream-prs 的独立补丁和 staging 源码。结构化接口缺失时诚实禁用；插件验收不能代替本次实际宿主验收。

## UI Contract

- Surface classification: 引用 dock / toolbar 为 embed；来源预览为 adopted。
- Surface kind: micro / inspector；宿主输入框仍为唯一 conversation companion。
- First / second / third visual priority: 当前目标和正文输入；引用标签及来源；状态与次级动作。
- Existing components reused: 宿主编辑器、官方 Button/Menu/Modal/Pill、ui-visual-kit token、ui-surface composition；既有 selection action registry。
- Cards that earn existence: 仅来源预览使用一个必要容器；不新增卡片墙。
- Primary scroll owner: 对话由宿主拥有；引用搜索结果与预览各自有界滚动，不嵌套整页滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| @ 搜索 | 加载提示，避免旧结果误选 | 分组无结果说明 | 原因及重试 | 插入标签 | 展示实际范围 | 无权限或 owner 不可用原因 |
| 引用草稿 | 来源解析中 | 隐藏空清单 | 保留正文，定位问题引用 | 已加入目标提示 | 刷新/移除/授权旧快照 | 目标缺失时选择 |
| 发送 | 提交状态，防重复 | 沿用宿主空输入规则 | 保留草稿 | 消费确认部分 | 不自动重试未知结果 | 缺能力禁用结构化发送 |
| 主题 | 沿用宿主初始化 | 不适用 | 回到 token fallback | 同步宿主偏好 | 未适配外部面板明确边界 | 不创建平行偏好存储 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 工具条主动作+更多，来源预览使用宿主窄屏面板；标签换行 | 紧凑预览，限制弹层宽高 | 来源预览浮层/inspector，主对话位置不变 |

### Accessibility

- Keyboard path: @ → 分组 combobox → 方向键选择 → Enter 插入 → Escape 关闭；中文合成过程中不触发选择或提交。
- Focus owner/return: 宿主 primitives 拥有弹层焦点；跨面板插入不聚焦对话；关闭预览返回原触发项。
- Visible labels and accessible names: 引用目标、类型、来源、移除、展开均有可读名称；状态不只用颜色。
- Reduced motion and coarse pointer: 沿用现有 motion token 和 reduced-motion；触屏不依赖 hover 才可操作。

### Visual Exceptions

无。遵循 docs/design/dsh-unified-panel-visual-system.md，不另建 token、font、portal 或 z-index 体系。

### Cross-host Semantics

- Canonical data/action/receipt owner: DSH Conversation 和对应资源/能力 owner。
- Same capability in Workbench: 不在本期修改 Workbench。
- DSH role: primary。
- Shared states and wording: loading / ready / stale / unavailable / unknown；错误显示原因与恢复。
- Handoff trigger and target: 外部引用面板加入明确主对话，无自动执行。
- Semantic differences allowed: 不改变权限、版本或执行语义。
- Pixel differences intentionally ignored: 第三方插件可保留自身主题，需接入约定。

## Migration Plan

所有已发布 API 采取 additive 扩展；V1 不移除、不重定义 pinned 限制、不改变已有普通文本发送。新宿主能力探测成功才启用。回滚可取消新能力注册/撤回独立宿主补丁，继续 V1 降级；不迁移历史消息数据。无本期弃用或移除发布。

## Risks / Trade-offs

- 宿主源码与运行版可能不同 → 记录精确版本与本地 profile，分别检查补丁可应用和真实链路。
- 多处共享 dirty 文件 → 每个路径一个 writer，先记录基线再作小范围合并。
- 请求覆盖所有内容 owner，但运行 profile 不一定提供 → 实现 registry 和真实可用 owner；缺项明确记录，不能以测试夹具冒充真实支持。
- 快照/正文包含用户内容 → 只在必要消息存储边界保留，普通日志和测试证据使用合成内容。

## Open Questions

无待用户决策项。当前宿主能力、可用来源和运行证据由实施时探测填写，不用推测替代验收。
