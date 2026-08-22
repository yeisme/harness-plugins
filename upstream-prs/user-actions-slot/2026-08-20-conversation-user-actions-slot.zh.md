# Agent Note：会话 user-actions 插槽

Status: proposed

[English](2026-08-20-conversation-user-actions-slot.md) | 中文

## 问题

会话聊天面目前只有一条按消息寻址的动作插槽 `conversation.chat.assistant-actions`，以已定稿的 assistant `messageId` 寻址。用户消息没有对等扩展点：其 IconActions 行被硬编码为复制 + 时钟，插件无法贡献针对某条用户消息的动作——而这正是"编辑本条消息后重发""从本条消息之前重试""按消息查看来源"等能力所需的挂载面。历史后果只有两种：无后端的死按钮 stub，或干脆没有入口。

## 提案

在 `packages/client/ui-conversation` 增加对称插槽：

```ts
'conversation.chat.user-actions': {
  kind: 'list'
  scope: 'session'
  owner: UserActionOwnerProps
}
```

```ts
export interface UserActionOwnerProps {
  /** Stable identity carried from the `user/message` event; absent on plain user nodes. */
  messageId?: MessageId | undefined
  /** Engine-owned node seq; the durable fork-addressing currency for user nodes. */
  seq: number
}
```

`UserMessageNodeView`（`user` 与 `steering` 两个 key）将该插槽声明为 child，渲染进 `MessageIconActions.extraActions`，位于内建复制与时钟控件之间——与 assistant 动作条同一落点纪律。事件语法决定了两条寻址事实，并冻结进 owner 类型：

- 普通用户节点没有持久 `messageId`；引擎持有的 `seq` 是寻址货币（会话 fork 同样以它寻址）。
- 已采纳的 steering 节点携带 `user/message` id，因此 `messageId` 为可选，仅在该类节点出现。

### 备选方案

- **仅以 `messageId` 寻址**：普通用户节点没有该字段，不可行；会迫使贡献者猜测或自行推导 seq。
- **单一消息无关插槽加 `role` 字段**：为不存在的消费方扩大所有现存贡献者的匹配面；assistant 动作条"已定稿消息"的不变量也会被稀释。
- **不做插槽，把编辑/重试做进 dsh core**：变更语义（fork 后重发）已可由独立插件用 `session.fork` + `session.prompt` 组合出来；缺的只是渲染落点，而插槽正是为此存在。

## 后果

- 纯增量：插槽声明、两处注册、`UserMessageNodeView` 的渲染接线。不改变任何现存插槽、事件或组件语义；零贡献者时渲染输出逐字节不变（空列表不渲染）。
- 插件无需 import 会话实现即可提供按用户消息的动作，与 assistant-actions 合同对齐。
- 贡献者必须把进行中的轮次视为不可寻址（禁用而非静默隐藏）——与 assistant 动作同一策略。

## 验证

- `packages/client/ui-conversation/tests/user-actions-slot.client.spec.tsx`：贡献动作渲染进用户动作行；普通用户 owner 为 `{ seq }`；steering owner 为 `{ messageId, seq }`；空列表不渲染标记且复制/时钟保留。
- 现存 `chat-branch-tails.client.spec.tsx` 的用户 IconActions 测试不变，仅在 fixture 适配器补一个返回 null 的 `renderSlot` 桩。
- 包 typecheck 与 `ui-conversation` client 全量套件通过。
