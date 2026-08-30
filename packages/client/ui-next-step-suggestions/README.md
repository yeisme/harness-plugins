# @yeisme/dsh-client-ui-next-step-suggestions

DSH Web 可点击“下一步建议”客户端插件：在 composer 上方渲染建议 chips，点击只把提示词填入输入框，不自动发送、不直接执行。

## 行为

- 单击 chip：将 `suggestion.prompt` 写入 composer draft；空草稿替换，非空草稿追加在新行。
- 多选模式：可勾选多个建议，点击「应用到输入框」按顺序追加，或点击「并行执行」生成并行执行提示词。
- 当 Agent 完成轮次且没有更具体的 Plan/plugin 建议时，显示有界 Conversation recap 与恰好三项通用后续建议。
- 多选模式支持 Tab/Shift+Tab、左右方向键首尾轮转；Esc 清空选择并退出多选。
- 点击不会调用 `submit()`、`command.execute()` 或 `session.prompt()`。

## 来源

V1 内置来源：

- `plan-options` projection：Plan 多方案转为建议，prompt 为 `/plan-select {"optionId":"..."}`。
- client-local `SuggestionSourceRegistry`：同 bundle 的其他 client 插件可注册安全建议。
- completion fallback：仅从最近完成轮次的 finalized assistant text 生成 recap；不读取 reasoning、tool payload 或 provider payload，且不会覆盖更具体来源。

## 使用

作为 bundle `@yeisme/dsh-next-step-suggestions` 的一部分安装：

```bash
dsh plugin --profile web add ./packages/bundle/dsh-next-step-suggestions
```

## 开发

```bash
pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run test
pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run typecheck
pnpm --filter @yeisme/dsh-client-ui-next-step-suggestions run build
```
