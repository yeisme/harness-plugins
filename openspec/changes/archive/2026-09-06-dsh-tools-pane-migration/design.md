# 工具 Pane 迁移

用户已批准移除工具、插件 tab，首轮为目录、启停与调用观测；手动调用不在本轮范围。能力归属 fit：harness-plugins 只投影 host 的工具与会话状态，Pane Workbench 拥有布局。

## 实现与兼容

复用 ui-mcp-inspector 的工具目录 controller、generation-CAS 和安全调用派生。以 `mcp-inspector` 为单例 pane kind，默认右侧、MCP 筛选，通过 `+` 与 `/mcp` 打开。pane 读取 sessions.list.current 和 sessions.binding(id).session；切换 session 重新挂载内容，释放旧订阅。关闭释放目录轮询与 controller，布局恢复不存活动或参数。

旧 conversation.view 注册按当前用户明确要求立即移除，不保留重复 tab。包名、现有导出类型、旧 view id 常量和命令名称保留；旧导出兼容期至少一个 release，本轮不删除。旧会话选择由 host 的缺失 view 回退到聊天处理。内部 `/mcp` 消费方同时更新。回滚为恢复本轮注册、适配和命令路由改动；无数据迁移，既有布局和 host 状态仍可使用。

用户已确认同时移除官方 settings.plugins section。改动以 upstream-prs/remove-plugins-settings 补丁交付，浏览器入口保持可加载但不注册 UI；保留插件安装与 CLI 查询。

## UI Contract

- Surface classification: adopted
- Surface kind: inspector；Diagnostics inspector archetype
- First / second / third visual priority: 工具与当前选择 / 调用状态 / 安全技术摘要
- Existing components reused: Surface、现有 Tools inspector、Pane Workbench chrome
- Cards that earn existence: 无新增卡片
- Primary scroll owner: pane 内容根容器
- 视觉依据：docs/design/dsh-unified-panel-visual-system.md

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 目录与启停 | 原 skeleton | 无目录项 | 安全错误码和重新检查 | host 刷新后反馈 | 保留 host complete 标识与 CAS 冲突反馈 | host canToggle 决定 |
| 调用活动 | 读取现有会话快照 | 无调用/未选会话 | 无会话绑定明确提示 | 完成、耗时与错误数 | 仅展示已加载会话历史 | 不提供执行按钮 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单列分段、控件换行 | 单列目录/活动/详情切换 | 允许现有目录与活动双列 |

### Accessibility

- Keyboard path: 原生按钮与输入支持 Tab/Enter/Space；pane 导航复用现有键盘行为。
- Focus owner/return: Pane Workbench；内容不抢占外部焦点。
- Visible labels and accessible names: zh/en 字典；长标题可读取完整名称。
- Reduced motion and coarse pointer: 沿用既有样式，触摸目标至少 44px。

### Visual Exceptions

无新增例外；保留已有 class/data 属性，避免破坏并行视觉改动。

### Cross-host Semantics

- Canonical data/action/receipt owner: DSH host toolHub 与 sessions
- Same capability in Workbench: none
- DSH role: primary
- Shared states and wording: 沿用启用、连接健康、运行、完成、错误
- Handoff trigger and target: 无
- Semantic differences allowed: 无
- Pixel differences intentionally ignored: 无跨 host 像素要求

## 验证

测试注册/卸载/晚到 pane 服务、会话切换与无会话、目录降级、过滤和启停、重复打开与跨区移动；运行相关包 test/typecheck/build，稳定后运行 check:surfaces、test:visual、check:plugins。集成运行使用项目 evidence runner，已有脏工作树失败单独归因。
