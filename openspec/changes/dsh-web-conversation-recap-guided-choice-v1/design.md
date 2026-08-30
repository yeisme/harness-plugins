## Context

`ui-next-step-suggestions` 已通过官方 `conversation.input.dock` 渲染 Plan/source chips，拥有 draft-only 写入、多选与 apply preference。Session standard kit 同时提供 `useSession(ConversationSnapshot)`，因此完成态可在浏览器本地从已有安全快照判断，不需要 Host 新协议。

## Goals / Non-Goals

**Goals:**

- 无更具体 source 时，为最近成功完成轮次展示 recap 与恰好三项建议。
- 保持现有多选、replace/append 和不自动发送语义。
- 为多选提供可逆的键盘轮转。

**Non-Goals:**

- 不从 raw reasoning、tool arguments/result 或 provider payload 生成 recap。
- 不新增 durable suggestion registry、Host service 或官方 Web core 改动。
- 不用通用建议覆盖 Plan/plugin 提供的具体建议。

## Decisions

1. 从 `ConversationSnapshot.turnEnds` 判断最近完成 turn，从该 turn 的 finalized assistant text blocks 生成有界 recap；`running` 或 pending 时隐藏。
2. Plan/source suggestions 优先。仅当合并后的具体建议为空时注入三项 completion fallback，避免稀释 owner 建议。
3. recap 作为同一个 `Surface` 内的说明区，不新占 slot。chips 与现有 apply path 完全复用。
4. 多选模式下 Tab/Shift+Tab 和左右方向键在 chips 内取模轮转；Escape 清空选择并退出多选，避免形成不可退出的 focus trap。单选模式保留浏览器原生 Tab 顺序。

## Risks / Trade-offs

- [recap 只是提取最后回答而非模型摘要] → 明确有界、确定性，避免成本与第二份语义真相。
- [通用建议不一定匹配领域] → 具体 Plan/plugin source 始终优先；fallback 只在空源时出现。
- [Snapshot shape 演进] → 只读取已发布字段并保留无完成 turn 时的 null 降级。

## Migration Plan

纯加法更新，无存储迁移。旧 source API 和 Plan adapter 不变。回滚只需删除 completion helper、recap markup 与 keyboard handler。

## Open Questions

未来是否把 typed completion suggestions 提升为 Host projection，留待 owner contract 明确后决定。
