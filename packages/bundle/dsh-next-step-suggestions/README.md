# @yeisme/dsh-next-step-suggestions

DSH Web 可点击“下一步建议”bundle：在 composer 上方渲染建议 chips，点击只把提示词填入输入框，不自动发送、不直接执行。

## 安装

从本仓库 checkout 安装：

```bash
dsh plugin --profile web add ./packages/bundle/dsh-next-step-suggestions
```

发布后安装：

```bash
dsh plugin --profile web add @yeisme/dsh-next-step-suggestions
```

## 启用

安装后：

- 当会话存在 Plan 多方案（`plan-options` projection）时，composer 上方出现建议 chips。
- 单击 chip：将 `/plan-select {"optionId":"..."}` 或对应提示词填入输入框。
- 多选模式：可勾选多个方案，选择「应用到输入框」顺序追加，或「并行执行」生成并行执行提示词。
- 点击不会自动发送；用户确认后按 Enter/发送才进入模型或命令执行。

## 回滚

```bash
dsh plugin --profile web remove @yeisme/dsh-next-step-suggestions
```

回滚只移除插件行与 chips，不迁移、不修改会话日志。

## 限制

- V1 只接入 `plan-options` 与 client-local source registry；host 跨插件 registry 为 retain-next。
- 并行组合只是提示词，真正并行调度由 Plan/agent owner 决定。
- 本包不 import DSH core 私有实现，不复制 DOM patch。
