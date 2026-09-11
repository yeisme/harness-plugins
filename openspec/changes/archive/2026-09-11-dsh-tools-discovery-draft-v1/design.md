## Context

用户已确认八项产品取舍并要求实施。当前工具页嵌入 conversation.view，同时独立 Pane 绑定明确 sessionId；活动已移交 dsh-context。共享 checkout 有工具、引用与创作相关 WIP，本变更只增量扩展，不恢复旧实现。

## Goals / Non-Goals

目标：用途发现、理解当前可用条件、加入明确会话草稿；修复对话宽度手柄残留与工具页留白。非目标：市场安装、在线模型推荐、直接执行、递归正文阅读、调用排错重建、生产与发布。

## Decisions

1. 目录范围默认当前会话，可切换本机已有；后端目录保持原权限和来源边界。并行查询的部分成功保留，失败不变为零项，旧数据标过期。
2. 可选用途摘要、关键词和分类从来源或受维护的补充目录取得；没有时使用原说明和未分类。中文搜索在本地进行，不向模型发送目录或查询。
3. 工具和 Skill 复用 tool/capability、skill/guidance 引用构造及 Host 草稿事务。绑定目标不能由 DOM 焦点或全局 current 推断；不自动激活会话、不发送。保持正文和已有引用，真实 ack 后显示成功。相同 source/ref/version 的重复引用去重，迟到回执只能影响原目标。
4. 所有公开合同增量扩展，新增字段可选、能力通过 probe 检查，旧方法和字段保持原义。缺少功能明确说明原因，兼容 staging 必须验证真实工作路径。
5. 会话正文宽度手柄只属于正文。工具页填满 content slot，不能由 transcript width 偏好裁剪或覆盖命中区；工作台外层 splitter 保留。
6. 不可用项提供原因和现有设置 owner 导航；无精确导航时显示管理入口与操作指引，不能假造可修复动作。返回后保留筛选与选中项，重新读目录。

## UI Contract

- Surface classification: adopted；Surface kind: inspector。
- First / second / third visual priority: 搜索和目标范围；用途与可用性列表；所选详情和加入草稿。
- Existing components reused: ui-surface、ui-visual-kit、DSH primitives 的 Button/Menu/Input 及原生有标签 select；唯一视觉权威为 docs/design/dsh-unified-panel-visual-system.md。
- Cards that earn existence: 无统计卡和重复嵌套卡；用列表、分隔线和按需详情。
- Primary scroll owner: 结果列表；宽屏详情独立滚动，窄屏按选中内容单页滚动。外层不增加正文 max-width。
- Motion: 不添加依赖，无装饰入场；沿用 token、focus-visible、reduced-motion 和 coarse pointer 44px 命中。
- component tree: ToolsPane -> context toolbar -> scope/purpose/source filters -> catalog list + selected detail -> inline receipt。

线框：

```text
绑定会话 A    [搜索用途或名称] [当前会话/本机已有] [检测] [管理]
[用途] [类型] [来源]                 覆盖/过期提示（需要时）
名称 + 用途 + 可用条件列表 | 选中项用途/原文/来源/条件
                          | [加入 A 草稿] [去对话]
```

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 目录 | 紧凑加载提示 | 无能力或无匹配分别说明，后者可清筛选 | 检测恢复 | 数量+真实列表 | 保留成功来源/旧数据并标识 | 显示不可用原因 |
| 引用 | 防重复提交 | 无绑定要求显式选择 | 不破坏草稿，保留选择 | ack 后提示已加入 | 未确认不自动重试 | 缺接口/失权给原因 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 工具栏换行，单列，详情显式返回 | 紧凑工具栏，单页列表/详情 | 列表占满宽度，选中后双栏 |

### Accessibility

- Keyboard path: 搜索、筛选、结果、加入/去对话；原生 Enter/Space，详情 Escape 返回。
- Focus owner/return: 返回恢复原行；添加回执不抢焦点；选择其他 Pane 不改变目标。
- Visible labels and accessible names: 中英一致，控件与错误有名称，状态伴随文字。
- Reduced motion and coarse pointer: 使用既有系统规则，无新动效。
- Visual Exceptions: 无。保持现有组件家族，不采用截图中的重复大标题与留白。

## Risks / Trade-offs

工具目录不保证已连接或已加载，状态须保守。来源不完整时缺席不能被当成禁用。共享脏源码和并行清理 build 产物可能影响整仓检查，验证阶段串行构建并分别记录已引入/既有/环境问题。草稿 source proof 必须来自原合同；不得编造 digest。真实模型/外部 MCP 调用不属于验收，本地 Host 草稿事务必须有证据。

## Migration Plan

无数据迁移。先补增量合同与兼容能力，再更新界面；宿主改动独立 patch packet，通过既有 staging 补丁链接入。回滚仅撤销本 change 自有 hunks，旧引用及目录字段仍可读，不重置用户 session/layout/profile。

## Open Questions

无产品未决项。实现需验证具体宿主目标寻址接口及调宽残留的浏览器证据，结论写入 verification.md。
