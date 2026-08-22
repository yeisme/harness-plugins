## Why

DSH Web 中模型/CLI 输出的“下一步建议”和 Plan 多方案目前以纯文本呈现，用户需要手动复制粘贴；Plan 的 `plan/options` 已有结构化多方案数据，但 Web UI 尚未暴露为可交互建议。用户希望像聊天产品一样点击建议，但点击不是直接执行，而是把建议文本填入输入框，由用户确认后再发送。

准入结论为 `fit`：Harness Plugins 拥有 DSH Web 侧的 suggestion chips、多选/并行组合与 composer draft 写入；DSH Host 继续拥有 session log、prompt 发送、plan mode 与 plan selection 的 canonical state。本 change 不修改 agent loop，不创建第二个执行器。

## What Changes

- 新增 `@yeisme/dsh-client-ui-next-step-suggestions` client package：在 `conversation.input.dock` 渲染可点击建议 chips。
- 点击 chip 只调用 `inputActions.setDraft()` 写入草稿，不调用 `submit()`，不直接执行。
- 支持单选、多选和“并行执行”组合提示词；并行语义由用户确认后发送，实际调度仍由 Plan/agent owner 决定。
- V1 首个真实来源为 `plan-options` projection：每个 `PlanOption` 生成一个 suggestion；同时提供 client 侧 `registerSource` 扩展点，供其他 client 插件贡献安全建议。
- 新增 `@yeisme/dsh-next-step-suggestions` bundle，组合 client 插件为可安装 profile row。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| suggestion chips 渲染 | required | Harness Plugins | deliver-now | component tests |
| 点击填入草稿（不发送） | required | Harness Plugins | deliver-now | component tests |
| 多选与并行组合 | required | Harness Plugins | deliver-now | unit tests |
| plan-options 来源 | required | DSH plan-mode + Harness Plugins | deliver-now | integration/unit tests |
| 插件 source 扩展点 | required | Harness Plugins | deliver-now（client-local） | unit tests |
| host 侧跨插件 registry/projection | optional | Harness Plugins | retain-next | 后续 change |

## Capabilities

### New Capabilities

- `dsh-next-step-suggestions-ui`: DSH Web 建议 chips、多选/并行组合、composer draft 写入交互。
- `dsh-next-step-suggestions-sources`: plan-options 与 client 插件建议来源适配。

### Modified Capabilities

无。本 change 不修改 DSH core 既有行为；新增 UI 与 bundle 均为 additive。

## Impact

- 新 owner package：`packages/client/ui-next-step-suggestions/`、`packages/bundle/dsh-next-step-suggestions/`。
- 依赖：`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-conversation`、`@deepseek-ai/dsh-client-ui-slots`、React；不复制 DSH core。
- 不修改 `client/deepseek-harness` 核心；V1 复用既有 `conversation.input.dock` 与 `inputActions.setDraft`。
- 合同兼容分类：全部 additive；rollback 为移除 bundle row。
