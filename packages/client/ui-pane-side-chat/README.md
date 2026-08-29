# @yeisme/dsh-client-ui-pane-side-chat

DSH Web 侧边对话 client 包：在 pane 里附着/新建/fork 一个 session 做侧边对话，**主对话区 current selection 全程不动**。

## 数据面（全部官方 client services）

| 路径 | 官方面 | 说明 |
| --- | --- | --- |
| 附着既有 | `ISessions.binding(id)` → `SessionFace` | `prompt(content, 'queue'\|'steer')`、`cancel()`、`loadOlder()`、`ConversationSnapshot` 订阅 |
| 新建 | runtime `create()`（结构化探测） | 未上 `ISessions` 公开面；缺席即禁用“新建会话”并指引 fork |
| fork | `ISessions.fork({sessionId, increaseTitle})` | 官方标记 origin；不 `open()` |

**主选择不变量**：任何路径不调用 `sessions.open()/openSubagent()/clear()`——controller 不持有这些方法的引用，`tests/controller.spec.ts` 以计数断言钉死。close pane = detach（只取消本地订阅，session 原样保留）。

## 结构

- `src/controller.ts`：生命周期状态机（empty/attaching/attached/unresolvable）+ 绑定订阅 + prompt/cancel/翻页。
- `src/view.tsx`：有界投影渲染（用户/助手文本、折叠工具卡、错误节点、queue 计数）+ composer（running 默认 steer 可切 queue）+ picker + removed 态。
- `src/locales.ts`：zh/en 双表 + 命名插值 + 无 locale 回退。
- `src/client/index.ts`：Cordis client face（`inject: ['sessions','locale']`；`paneWorkbench` optional probe，缺席零注册）。视图工厂即组件：per-tab controller（多 tab 各自绑定），resource key `side-chat:<sessionId>` 预选 / `side-chat:picker` 起步。

## 开发

```bash
pnpm --filter @yeisme/dsh-client-ui-pane-side-chat run typecheck
pnpm --filter @yeisme/dsh-client-ui-pane-side-chat run test
pnpm --filter @yeisme/dsh-client-ui-pane-side-chat run build
```

可安装形态见 bundle `packages/bundle/dsh-side-chat/`；设计合同见 `openspec/changes/dsh-web-pane-terminal-sidechat-v1/`（capability `dsh-side-chat-pane`）。
