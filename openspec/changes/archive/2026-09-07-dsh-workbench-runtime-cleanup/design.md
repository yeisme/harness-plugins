## 决策

统一 staging CLI 是唯一开发宿主。`dsh:dev` 的 HMR、增量构建、外部 bundle 和自定义 profile 能力保留；所有启动和 profile 命令直接使用经过检查的本地 CLI，不依赖全局版本。缺少源码、错误 release base 或不匹配构建时停止并给出准备命令。准备完整工作台时按顺序应用 unified-workbench、composer-reference 与本轮 cleanup 补丁。

本轮移除 `createReferenceTargetControl` 内置实现与注册，但保留 `conversation.reference.target` 可扩展 slot、事件与 `chooseTarget` 服务。全局模态框按实际引用操作打开；每个 Pane 的 composer 仍绑定自身 sessionId。引用折叠摘要只报告引用数量，目标由 Pane 标题和作用域确定。

## 兼容、迁移与回退

命令名、profile、会话日志、草稿、布局存储键与引用事件保持兼容。用户明确要求即时移除多余 Target 产品展示，因此本次直接删除内置展示，无需保留一版可见旧栏；第三方 slot 与服务仍可使用。先为旧全局安装做本地可恢复副本，再用包管理器 link 已验证的兼容 CLI。仅结束确认属于本次旧预览的进程；不批量删除其他服务、测试家目录或业务数据。Git 提交和可恢复副本用于回退；不自动恢复混用旧组件的默认入口。

## UI Contract

- Surface classification: embed（已有 DSH host composer）。
- Surface kind: workspace；按 `docs/design/dsh-unified-panel-visual-system.md`。
- First / second / third visual priority: Pane 标题、对话正文、输入框与引用摘要。
- Existing components reused: 原生 composer、引用折叠区、按需 Modal。
- Cards that earn existence: 无新增卡片。
- Primary scroll owner: 原会话正文。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 引用目标选择 | 由调用方等待 | 无可用会话返回 unavailable | 保留明确原因 | 只在选择后切换目标 | 重校验 owner | 已取消请求不切换 |
| 引用折叠区 | 保留原内容 | 无引用不渲染 | 保留原校验反馈 | 只显示引用数量 | 保留修订检查 | 不新增按钮 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 删除 Target 常驻行；沿用输入布局 | 同左 | 多 Pane 各自独立，无重复目标行 |

### Accessibility

键盘路径与焦点由原 Modal 管理；Escape 取消并回到发起操作。Pane 标签提供上下文；不删除引用项可访问名称。不增加动效或改变触控目标。

### Visual Exceptions

无新增视觉例外；宿主级 UI 使用官方 primitive，不引入插件 Surface 依赖。

## 验证与存档

启动器离线单测证明所有调用绑定 staging CLI，并拒绝错误基线；会话 UI 测试证明无 Target 注册、按需选择和取消可用。真实浏览器在隔离上下文验证侧栏拖入、独立草稿/会话绑定、切换和无 Target 栏。所有集成执行保存脱敏六件套到 `temp/integration-test-runs/`，只记录验证摘要。补丁应用检查、focused 类型检查、bundle 构建与本项目 surface/visual/plugin gates 后做本地 Git 提交；不推送。
