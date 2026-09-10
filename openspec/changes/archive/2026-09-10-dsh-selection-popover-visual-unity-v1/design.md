## 决策

遵循 docs/design/dsh-unified-panel-visual-system.md。fit：选区交互层拥有工具条，selection-annotation拥有引用/草稿弹框；仅组合统一视觉，不复制执行或会话状态。Codex式克制、紧凑和一致性作为本轮方向；视觉须用户认可，不能以token使用或测试通过替代。

## UI Contract

- Surface classification: adopted，既有浮层。
- Surface kind: micro（工具条）和 dialog（既有草稿框）。
- First / second / third visual priority: 选中内容、可用动作、次要状态。
- Existing components reused: 原选区工具条、原草稿框与共享vk token。
- Cards that earn existence: 单层浮层，无菜单内额外卡片。
- Primary scroll owner: 原弹框内容区。

### State Matrix

| Feature | Loading | Empty | Error | Success | Partial/Stale | Disabled |
|---|---|---|---|---|---|---|
| 浮层CSS | 保留原状态 | 不新增入口 | 原状态文案 | 中性强调 | 不改变原拒绝策略 | 原禁用语义与可读标签 |

### Responsive

| <=420px | 421–720px | >720px |
|---|---|---|
| 保留触摸sheet与44px命中 | 锚定浮层，同族外框 | 不放大装饰或新增壳层 |

### Accessibility

原焦点、Escape、键盘选择、拖动和reduced-motion逻辑不变。主动作仍有文字和字重区别，取消额外蓝色装饰；focus-visible继续使用宿主焦点色。

### Visual Exceptions

无。四类浮层统一bg-elevated、border-l1、radius-lg及轻阴影；按钮保持radius-md，主动作fill-active。灰度样式不是Codex产品精确像素声明，需在实际DSH安装界面继续走查。

## 验证

构建两个拥有者包；原selection-actions浏览器回归覆盖浅深主题、拖动、键盘、触摸与缩放。新增浅/深主题用computed style核对工具条、菜单、composer的背景/边框/圆角/阴影一致并截图，明确不产生发送。
