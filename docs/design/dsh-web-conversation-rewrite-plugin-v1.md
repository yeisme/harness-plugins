# DSH Web 会话改写/重试/分支插件 V1 方案

> 状态：设计草案
> 定位：DSH Web 的“编辑上一条消息、重试/重新生成回答、更精确地分支”体验与插件化设计。
> 正式实现 owner：Harness Plugins + DSH 上游的最小 additive seam。2026-08-20 起 dsh fork 退役：seam 实现固化为 `agent/harness-plugins/upstream-prs/user-actions-slot/`（已完成：slot 声明/注册/渲染接线 + 测试 + 双语 note，分支 `pr/user-actions-slot`），以 PR 提交 deepseek-ai 上游；`forkBeforeMessage` 走同通道 backlog。

## 1. 现状确认

先回答“目前 DSH Web 到底能不能编辑/分支/重试”：

| 能力 | 当前状态 | 说明 |
| --- | --- | --- |
| 分支（fork） | ✅ 已有 | Session 行可“从最近一个已完成轮次分支”；Assistant 消息尾部 IconActions 有 Branch 按钮，只能从“已完成轮次的最后一条 Assistant 消息”分支。fork 子会话作为平级行出现，继承标题并自动加 `(1)`。 |
| 编辑已发送的用户消息 | ❌ 不支持 | 曾有一个无后端的编辑 stub，已移除。现在用户气泡只有复制/时间；队列编辑器只能编辑“尚未发送”的排队消息。 |
| 用户主动重试/重新生成 | ❌ 不支持 | 现有 `model-retry` 是 provider 请求失败的自动重试展示（scheduled/started/cancelled），不是用户点击“重新生成”。终态错误行只展示错误，没有可执行动作。 |
| 从任意消息分支 | ⚠️ 部分 | 只能从已完成轮次的最后 Assistant 消息分支；不能“在这个用户消息之前分支”，也不能“编辑后从该消息重新出发”。 |

## 2. 设计原则

1. **保持 append-only 会话日志不可变**。DSH 的 `SessionEvent` 是唯一真相，历史不能原地改写；编辑/重试本质是“派生一个 child session 并在新上下文中继续”，而不是篡改旧日志。
2. **编辑 = 分支 + 新 prompt**。编辑一条已发送用户消息，等于在“该消息所属轮次之前”建立一个 child，写入编辑后的内容，再作为新轮次发送。
3. **重试 = 分支 + 重发原 prompt**。重试一条 Assistant 回答，等于在“触发它的用户消息之前”建立 child，重发同一条用户消息，让模型重新生成。
4. **先有 host 能力，再放 UI 控件**。不能重蹈“edit stub”覆辙：按钮必须和真实 mutation/服务成对出现。
5. **split-owner**。DSH Host 拥有会话日志、fork/prompt、边界校验；Harness Plugins 拥有按钮、内联编辑器、交互状态；浏览器不复制 canonical state。

## 3. 核心交互设计

### 3.1 编辑用户消息（Edit as Branch）

```text
用户消息气泡
  └─ [编辑]
       └─ 气泡内联展开为 textarea（保留原文本/图片说明）
            └─ [保存]
                 ├─ 目标消息之前存在已完成轮次
                 │    └─ 在该轮次 turn/end 处 fork child
                 │         └─ child.prompt(编辑后的内容)
                 └─ 目标消息是第一条消息（无前置 turn/end）
                      └─ 创建空 child（parent lineage 保留）并 prompt
```

- 保存后自动打开 child 会话，child 标题继承源标题并递增 `(N)`。
- 父会话保持不变；用户可在会话列表中对比两条分支。
- 取消/Escape 退出编辑，不产生任何日志。

### 3.2 重试 Assistant 回答（Retry as Branch）

```text
Assistant 消息动作条
  └─ [重试]
       ├─ 找到该轮次的用户 prompt（通常是轮次内最后一个 user/steering 节点）
       ├─ 在该用户 prompt 之前的 turn/end 处 fork child
       └─ child.prompt(原 user content)  → 自动打开 child
```

- 对“最后一条 Assistant 回答”提供快速入口，对历史 Assistant 回答也允许。
- 如果该轮次没有可安全重发的用户 prompt（例如纯 context/injection），禁用并给出原因。
- 不自动替换父会话，避免 KV-cache/上下文被破坏。

### 3.3 与现有 Fork 的关系

统一心智模型：`Branch`、`Edit`、`Retry` 都是“派生分支”的不同动作：

| 动作 | fork 边界 | 后续动作 |
| --- | --- | --- |
| Branch | 该消息所属已完成轮次的 turn/end | 仅打开 child |
| Edit | 该用户消息之前的 turn/end（或空 child） | 写入编辑后内容并 prompt |
| Retry | 该用户 prompt 之前的 turn/end（或空 child） | 重发原 prompt |

## 4. 插件架构

### 4.1 需要的最小 upstream seam（DSH 上游；已固化为 `upstream-prs/user-actions-slot/`）

当前 `ui-conversation` 只声明了 `conversation.chat.assistant-actions`，没有 `conversation.chat.user-actions`。要让外部插件给用户气泡加 Edit 按钮，需要加一个对称的 additive slot：

```ts
// ui-conversation contract/slots.ts
'conversation.chat.user-actions': {
  kind: 'list'
  scope: 'session'
  owner: UserActionOwnerProps // { messageId?: MessageId; seq: number }
}
```

并在 `UserMessageNodeView` 的 `MessageIconActions.extraActions` 位置渲染该 slot。这个改动不改变现有行为，只是把用户气泡的动作条开放给插件。

### 4.2 推荐 host 服务（可选但更完整）

纯客户端可以先组合现有 `session.fork` + `session.prompt`，但为了支持“第一条消息编辑/重试”和原子边界，建议新增一个 host RPC：

```ts
// session.forkBeforeMessage
request: {
  sessionId: SessionId
  atMessageSeq: number
}
response: { childSessionId: SessionId }
```

语义：以 `atMessageSeq` 所在轮次之前的最近一个 `turn/end` 为 seed 边界创建 child；如果 `atMessageSeq` 是第一条消息，则创建 `seedLength: 0` 的 child（仍保留 `parentSession`、cwd、workspace 归属）。之后客户端继续调用现有 `session.prompt`。

更便利的封装（可选）：

```ts
session.rewriteAt({ sessionId, atMessageSeq, content, mode: 'edit' | 'retry' })
```

但推荐保留 `forkBeforeMessage` + `prompt` 两个原语，避免把“发送策略”耦合进 fork。

### 4.3 Harness Plugins 包结构

```text
packages/
  host/dsh-chat-rewrite-host/      # 可选：forkBeforeMessage host 插件/服务映射
  client/ui-chat-rewrite/          # 客户端：Edit/Retry 按钮 + 内联编辑器 + controller
  bundle/dsh-chat-rewrite/         # 可安装 bundle：cordis.patch.yml 组合 host/client
```

客户端插件注册：

- `conversation.chat.user-actions`：Edit 按钮，点击后进入 inline edit state。
- `conversation.chat.assistant-actions`：Retry 按钮。
- 使用 `ctx.sessions` 的 `fork` / `open` / `binding(id).session.prompt`；若 host seam 存在，则优先调用 `forkBeforeMessage`。

### 4.4 状态机

每个消息动作是一个“pending mutation”，不是乐观更新：

```text
idle → editing (仅 Edit) → submitting → opened / error
idle → submitting (Retry) → opened / error
```

- `submitting` 禁用重复点击，按钮显示 spinner。
- `error` 保留在原气泡上显示轻量错误（不吞失败），并允许重试。
- 成功后打开 child；若 child 已创建但打开失败，至少让用户能在列表中看到 child。

## 5. 关键边界与校验

| 边界 | 规则 |
| --- | --- |
| 消息不是 user/assistant 可寻址节点 | 不显示 Edit/Retry 或禁用 |
| 目标消息所在轮次仍在运行 | 禁用，避免与正在流式输出的轮次竞争 |
| 目标用户消息已包含图片/附件 | Edit 首版只支持文本重写；附件保留原样或显示“不支持修改附件” |
| 第一条消息 | 用空 child 分支，而不是 fork 当前整个 turn |
| 父会话已 archive/删除 | 禁用 mutation，返回 typed error |
| 失败 | 保留原会话；`unknown`/`partial` 不自动重试，只显示 reconcile 入口 |

## 6. 分期实施

| Wave | 范围 | 验收门 |
| --- | --- | --- |
| Wave 0 | 上游 `conversation.chat.user-actions` slot + Harness Plugins 空按钮（仅 Branch/Retry 占位） | slot 注册/渲染有测试；无死按钮 |
| Wave 1 | 非首轮 Retry：fork 前一个 turn/end + prompt 原消息；Assistant 动作条 Retry 可用 | 同一 prompt 生成 child，父会话不变 |
| Wave 2 | 非首轮 Edit：用户气泡 inline edit + 保存后 fork/prompt | 编辑后 child 打开，父会话不变 |
| Wave 3 | Host `forkBeforeMessage` 支持首轮编辑/重试；原子边界校验 | 首轮消息也可编辑/重试，lineage 正确 |
| Wave 4 | 交互完善：键盘、a11y、错误重试、branch lineage 视觉、设置开关 | 键盘/读屏/失败矩阵全绿 |

## 7. 测试与证据

- 合同测试：`forkBeforeMessage` 的边界选择（首轮、前一 turn/end、open turn、unknown seq）。
- 组件测试：Edit 按钮/textarea/保存/取消、Retry 按钮 loading/error。
- 集成测试：fork child + prompt 在真实 client runtime 中打开 child。
- E2E：从一条历史用户消息编辑并看到 child 重新回答；从 Assistant 回答 Retry 生成新分支。
- 所有集成/组件/e2e 证据写入对应子项目 `temp/integration-test-runs/<run-id>/`，并脱敏。

## 8. 与现有 OpenSpec/设计的关系

- 复用 `openspec/changes/dsh-pane-plugin-ecosystem-v1/` 的 Pane/插件生命周期与 typed intent 思路。
- 复用 `agent/harness-plugins/openspec/changes/dsh-long-term-history-global-search-v1/` 的“历史恢复/会话分支”基础。
- 不改变 `session.fork` 现有语义；新增 `forkBeforeMessage` 是 additive。
- dsh 源码 fork 已退役（2026-08-20）：不在 monorepo 内维护 dsh 源码副本；seam 实现固化为 `agent/harness-plugins/upstream-prs/` patch 系列（含上游格式的双语 Agent Note 草案），以 PR 提交 deepseek-ai 上游，`.agents/notes/proposed/` 流程在上游仓内进行。
