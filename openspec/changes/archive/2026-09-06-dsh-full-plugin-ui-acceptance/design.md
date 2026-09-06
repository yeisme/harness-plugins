## 实施决策

沿用共享 Surface 和 scoped token，修复共用层后由所有消费者继承。Creator Studio 复用 sibling service 事件模式，在 Pane 晚到、撤销或替换时清理旧注册；异步 remote 解析用 generation 防止过期挂载。产物测试实际执行客户端 factory，精简宿主替身仅覆盖导入契约，不宣称替代实机。

正式检查顺序执行，避免包 build 的 clean 与其他测试读取产物竞争。实机使用独立 DSH_HOME 中的官方 web profile；任意自定义 profile 不会自动获得官方 Web 基础层。

全量实机发现示例插件的 resident overlay 会拦截工作区按钮；改为默认关闭、由明确入口打开的官方 Modal，内部使用共享 Surface，示例插件保持启用。Agents 在没有当前会话时展示 disabled reason，订阅会话变化后更新入口，不保留无反馈的 no-op 按钮。

Remote facade 本身可能是带 injection guard 的 Proxy；命名空间可选读取必须捕获 getter 的拒绝，不能只使用 optional chaining。缺少授权时保留不可用状态，不绕过宿主权限。最终运行证据与本机历史会话封装修复记录见 `docs/delivery/dsh-full-plugin-ui-acceptance-2026-09-05.md`。

## UI Contract

- Surface classification: adopted（共享 Surface 与批注 dialog）；其余 renderer 沿用原分类。
- Surface kind: workspace / navigator / inspector / dialog，保持既有用途。
- First / second / third visual priority: 当前内容与操作、状态与原因、技术细节。
- Existing components reused: ui-surface、ui-visual-kit、官方 primitives。
- Cards that earn existence: 媒体对象；批注引用改为紧凑分区，移除嵌套卡片外框。
- Primary scroll owner: Pane body；批注 dialog 在可用视口内单一滚动。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| Creator 启动 | 等待服务，异步挂载 | 缺 Pane 展示原因 | remote 不可用提示 | 注册真实入口 | 服务撤销清理旧挂载 | 不提供死按钮 |
| 批注 | 保留输入 | 禁用空提交 | 保留草稿及原因 | 本地反馈 | 沿用 owner 限制 | 可见原因，不能伪造模型可用 |
| 共享面板 | 既有 skeleton | 紧凑空态 | 紧凑状态条 | receipt 摘要 | 保留可信内容 | 文本与焦点可访问 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 单列；批注底部浮层 | 单列与可滚动操作 | 保留原双区布局，批注锚定 |

### Accessibility

- Keyboard path: 选区动作 → 评论 → 输入 → 提交；Escape 返回原入口。
- Focus owner/return: 沿用已有 controller，实际浏览器验证自动焦点和关闭。
- Visible labels and accessible names: 表单 label 始终可见；中英文分别验证。
- Reduced motion and coarse pointer: 保留减少动效规则，触控关键目标至少 44px。

### Visual Exceptions

不新增例外。沿用现有批注浮层生命周期与视口定位，不新增 overlay 系统。

## 兼容与验证

新增 CSS 变量补齐已定义 PANEL_SCALE，不删除现有变量；字体继承宿主 family，字号由规范 token 决定。所有正式检查由 `node scripts/run-full-plugin-validation.mjs` 顺序执行。实机验证由 `node scripts/run-web-plugin-acceptance.mjs` 执行；逐项区分配置、启动、可见变化和未验证能力。未知外部 owner 不调用、不伪造成功。

回滚只撤回本轮源代码与基线变更，保留用户已有 diff、profile 中其他插件和领域数据。
