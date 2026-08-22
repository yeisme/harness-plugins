# @yeisme/dsh-client-ui-next-step-suggestions

DSH Web 可点击“下一步建议”客户端插件：在 composer 上方渲染建议 chips，点击只把提示词填入输入框，不自动发送、不直接执行。

## 行为

- 单击 chip：将 `suggestion.prompt` 写入 composer draft；空草稿替换，非空草稿追加在新行。
- 多选模式：可勾选多个建议，点击「应用到输入框」按顺序追加，或点击「并行执行」生成并行执行提示词。
- 点击不会调用 `submit()`、`command.execute()` 或 `session.prompt()`。

## 来源

V1 内置来源：

- `plan-options` projection：Plan 多方案转为建议，prompt 为 `/plan-select {"optionId":"..."}`。
- client-local `SuggestionSourceRegistry`：同 bundle 的其他 client 插件可注册安全建议。

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
