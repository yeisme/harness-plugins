# maximized-pane-composer-dock

DSH AppFrame 在 Right/Bottom Pane 真正最大化时保留原生 conversation composer，
并将其停靠在主区域底部。会话 Header、聊天记录和空白态 Hero 继续隐藏；输入、草稿、
附件、模型、权限、发送/停止与快捷键仍由 `ui-conversation` 原 owner 处理。

## 依赖

- 先应用 `upstream-prs/pane-workspace-layout/`。
- 本补丁只修改该 seam 已引入的 AppFrame 与测试，不修改 Pane 插件业务状态。

## 应用

```bash
./apply.sh /path/to/deepseek-harness-checkout
```

## 验证

```bash
pnpm vitest run packages/client/ui-layout/tests/app-frame.client.spec.tsx
pnpm run build:lib:client
```

浏览器验收：最大化 Right 或 Bottom Pane 后，原生输入卡位于侧栏右侧主区域底部，
空白会话不显示 Hero 标题/光效；按 Escape 恢复布局后 composer 回到 Conversation。
