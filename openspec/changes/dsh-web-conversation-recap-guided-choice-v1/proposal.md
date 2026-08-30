## Why

现有 Web suggestions 只在 Plan 或其它插件显式提供 source 时出现，Agent 正常完成任务后仍缺少可扫描的 Conversation recap 和明确下一步。多选已存在，但键盘用户缺少在建议间连续轮转的高效路径。

## What Changes

- 在 Session 成功完成一轮且无 pending interaction 时，从现有安全 Conversation snapshot 生成有界 recap。
- 当没有更具体的 Plan/source 建议时，展示恰好三项通用下一步建议：检查结果、运行验证、继续下一步。
- 建议保持 draft-only：单击或批量应用只写 Composer，不自动发送。
- 多选模式下支持 Tab/Shift+Tab 循环焦点，Escape 退出多选；ArrowLeft/ArrowRight 同样轮转。
- 继续复用官方 `conversation.input.dock` slot、现有 source registry 与 visual-kit，不新增 Host 状态或 DSH core fork。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `next-step-suggestions`: 增加完成态 recap、三项 fallback 建议与键盘轮转。

## Impact

- 代码：`packages/client/ui-next-step-suggestions` 与 bundle re-export/README。
- 公共 TypeScript API：只增加 optional 字段与新导出 helper，现有 source/组件调用保持兼容。
- Host/wire：无新增 RPC、projection 或持久化；浏览器只读取现有 `ConversationSnapshot`。
- 回滚：移除 completion fallback source 与 recap 渲染即可恢复原 Plan/source-only 行为。
