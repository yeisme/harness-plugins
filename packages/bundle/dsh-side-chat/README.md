# @yeisme/dsh-side-chat

DSH Web 侧边对话 bundle：在 pane 里并行跟进另一个会话——附着既有 session、新建空白 session（runtime `create` 探测）、或从当前会话 fork——**主对话区 current selection 全程不动**。

## 安装

```
dsh plugin --profile web add @yeisme/dsh-side-chat
# 或从本仓
dsh plugin --profile web add ./packages/bundle/dsh-side-chat
```

## 语义

- 一切读写经官方 client services：`ISessions.binding()` → `SessionFace`（`prompt(content, 'queue' | 'steer')`、`cancel()`、`ConversationSnapshot` 订阅）、官方 `fork()`、可选 runtime `create()`。
- **主选择不变量**：不调用 `sessions.open()/openSubagent()/clear()`（包测试以 open 计数断言钉死）。
- close pane = detach：只取消本地订阅；session 原样留在列表，可再次附着。
- running 会话默认 steer（可切 queue），对齐官方 busy-Enter 语义；`promptError` 行内透传，不清空草稿。
- 渲染为有界投影：用户/助手文本、折叠工具卡摘要、错误节点、queue 计数。

## 降级

| 环境 | 表现 |
| --- | --- |
| 无 `paneWorkbench` | 零注册，无入口，卸载无副作用 |
| runtime 无 `create` | “新建会话”禁用 + 原因；fork 与附着不受影响 |
| slash 目录缺失 | `/side-chat` 禁用 + 原因；pane 内操作不受影响 |
| 附着目标不可解析 | 行内提示，不回退到其他 session |

## 命令

- `/side-chat`（`category: pane`）→ 打开侧边对话视图（picker 起步）。

## 开发

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-side-chat run test
pnpm --filter @yeisme/dsh-side-chat run test
pnpm --filter @yeisme/dsh-side-chat run build
node scripts/check-bundle-contracts.mjs
```

设计合同见 `openspec/changes/dsh-web-pane-terminal-sidechat-v1/`（capability `dsh-side-chat-pane`）。
