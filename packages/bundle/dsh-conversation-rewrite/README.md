# @yeisme/dsh-conversation-rewrite

DSH Web 会话改写/重试 bundle：以「分支派生」方式提供用户消息 Edit 与 Assistant Retry，不原地修改 `SessionEvent`。

## 安装

从本仓库 checkout 安装：

```bash
dsh plugin --profile web add ./packages/bundle/dsh-conversation-rewrite
```

发布后安装：

```bash
dsh plugin --profile web add @yeisme/dsh-conversation-rewrite
```

## 启用

安装后：

- Assistant 消息动作条出现 **Retry**（非首轮可用；运行中/unknown/无文本输入会禁用并显示原因）。
- 当上游 DSH 合入 `conversation.chat.user-actions` slot 后，用户气泡自动出现 **Edit**；当前发布版 DSH 尚无该 slot，因此 Edit 默认不注册。
- 首轮 Edit/Retry 依赖 `session.forkBeforeMessage`（retain-next），当前保持禁用。

## 回滚

```bash
dsh plugin --profile web remove @yeisme/dsh-conversation-rewrite
# 或
dsh --profile web --dump-config
```

回滚只移除插件行与按钮/编辑器，不迁移、不修改会话日志。

## 限制

- V1 仅支持纯文本用户消息；附件/图片编辑保留为后续任务。
- unknown/partial/stale/running 状态只显示 typed error 或禁用，绝不自动重试。
- 本包不 import DSH core 私有实现，不复制 DOM patch。
