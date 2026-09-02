/**
 * 稳定边界决策：Edit/Retry 共享同一"目标 prompt 之前最近的 turn/end"规则。
 *
 * 纯函数、零副作用：只读 snapshot，返回 typed decision；数组输入视为
 * immutable，内部需要顺序时先复制。检查顺序与 Web V1 保持一致
 * （removed → not-found → not-text → settlement → 首轮边界 → running），
 * 使 Web facade 可以做纯映射而不产生行为漂移。
 *
 * V2 与 V1 的三点刻意差异：
 * - `settlement-pending`：消息未定稿（completed=false）或 Retry 锚定的 turn
 *   仍在运行时返回，表示"等待 turn 落定"而不是笼统的 running；
 * - `stable-boundary-unavailable`：目标 prompt 不是首条 prompt 却没有前置
 *   turn/end（同轮多条排队 prompt）时返回——此场景 fork 会丢上下文、
 *   forkBeforeMessage 会带上错误前缀，只能 fail closed；
 * - 首轮 target 的 messageSeq 一律指向被改写 prompt 自身（forkBeforeMessage
 *   在该消息之前派生 child，再发送编辑后的文本），Retry 不再使用 assistant seq。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite-core
 */

import type {
  RewriteCapabilitiesV2,
  RewriteConversationSnapshotV2,
  RewriteDecisionV2,
  RewriteDisableReasonV2,
  RewriteKindV2,
  RewriteMessageV2,
} from './types.ts'

function disabled(reason: RewriteDisableReasonV2): RewriteDecisionV2 {
  return { ok: false, reason }
}

/** 仅当全部内容块为 text 时返回拼接文本；空文本视为不可改写。 */
export function textOfRewriteContentV2(
  content: readonly { readonly type: string; readonly [key: string]: unknown }[],
): string | null {
  let text = ''
  for (const part of content) {
    if (part.type !== 'text') return null
    const value = (part as { readonly text?: unknown }).text
    if (typeof value !== 'string') return null
    text += value
  }
  return text.length === 0 ? null : text
}

/** 返回严格小于 beforeSeq 的最近 turn/end seq；没有则 null。 */
export function previousTurnEndSeqV2(turnEnds: readonly number[], beforeSeq: number): number | null {
  let best: number | null = null
  for (const seq of turnEnds) {
    if (seq < beforeSeq && (best === null || seq > best)) best = seq
  }
  return best
}

function hasTurnEndAfter(turnEnds: readonly number[], seq: number): boolean {
  for (const endSeq of turnEnds) {
    if (endSeq > seq) return true
  }
  return false
}

function isPromptKind(kind: RewriteMessageV2['kind']): boolean {
  return kind === 'user' || kind === 'steering'
}

/** 按 seq 排序的消息副本；调用方持有的数组不被修改。 */
function sortedMessages(snapshot: RewriteConversationSnapshotV2): RewriteMessageV2[] {
  return [...snapshot.messages].sort((left, right) => left.seq - right.seq)
}

/** 从 assistant 向前找最近一条 user/steering prompt 作为该轮输入。 */
function promptBefore(messages: readonly RewriteMessageV2[], beforeSeq: number): RewriteMessageV2 | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const node = messages[index]
    if (node === undefined || node.seq >= beforeSeq) continue
    if (isPromptKind(node.kind)) return node
  }
  return null
}

/** 是否存在 seq 更早的其它 prompt：决定"首轮"与"边界缺失"的分流。 */
function hasEarlierPrompt(messages: readonly RewriteMessageV2[], prompt: RewriteMessageV2): boolean {
  return messages.some((node) => isPromptKind(node.kind) && node.seq < prompt.seq)
}

/**
 * 首轮分流：目标是首条 prompt 时，能力可用即返回 boundarySeq=null 的可执行
 * target；否则 first-round。非首条 prompt 缺边界一律 stable-boundary-unavailable。
 */
function firstBoundaryDecision(
  kind: RewriteKindV2,
  snapshot: RewriteConversationSnapshotV2,
  prompt: RewriteMessageV2,
  text: string,
  capabilities: RewriteCapabilitiesV2,
): RewriteDecisionV2 {
  if (hasEarlierPrompt(snapshot.messages, prompt)) return disabled('stable-boundary-unavailable')
  if (!capabilities.forkBeforeMessage) return disabled('first-round')
  return {
    ok: true,
    target: {
      kind,
      key: `${kind}:${prompt.key}`,
      sourceSessionId: snapshot.sessionId,
      sourceGeneration: snapshot.generation,
      messageKey: prompt.key,
      messageSeq: prompt.seq,
      boundarySeq: null,
      text,
    },
  }
}

/**
 * Edit / TUI 历史改写的共同入口：按用户消息 seq 定位 prompt。
 * TUI 未修改提交（重发原文）同样传 `kind: 'retry'`，语义仍是 fork child 后重发。
 */
export function computeUserTurnTargetV2(
  snapshot: RewriteConversationSnapshotV2,
  userSeq: number,
  kind: RewriteKindV2,
  capabilities: RewriteCapabilitiesV2,
): RewriteDecisionV2 {
  if (snapshot.removed) return disabled('removed')

  const messages = sortedMessages(snapshot)
  const prompt = messages.find((node) => node.seq === userSeq && isPromptKind(node.kind))
  if (prompt === undefined) return disabled('not-found')

  const text = textOfRewriteContentV2(prompt.content)
  if (text === null) return disabled('not-text')
  if (!prompt.completed) return disabled('settlement-pending')

  const boundarySeq = previousTurnEndSeqV2(snapshot.turnEnds, prompt.seq)
  if (boundarySeq === null) return firstBoundaryDecision(kind, snapshot, prompt, text, capabilities)

  // 目标 prompt 所在 turn 仍在运行：user 目标返回 running。
  if (!hasTurnEndAfter(snapshot.turnEnds, prompt.seq) && snapshot.running) return disabled('running')

  return {
    ok: true,
    target: {
      kind,
      key: `${kind}:${prompt.key}`,
      sourceSessionId: snapshot.sessionId,
      sourceGeneration: snapshot.generation,
      messageKey: prompt.key,
      messageSeq: prompt.seq,
      boundarySeq,
      text,
    },
  }
}

/**
 * Retry 入口：按 assistant key 寻址（key 由 adapter 精确解析；Web 的
 * single-tail 启发式留在 adapter，不进入 core）。寻址到 assistant 后由 core
 * 解析其对应 prompt 与边界，不做任何 fallback。
 */
export function computeRetryTargetV2(
  snapshot: RewriteConversationSnapshotV2,
  assistantKey: string,
  capabilities: RewriteCapabilitiesV2,
): RewriteDecisionV2 {
  if (snapshot.removed) return disabled('removed')

  const messages = sortedMessages(snapshot)
  const assistant = messages.find((node) => node.key === assistantKey && node.kind === 'assistant')
  if (assistant === undefined) return disabled('not-found')

  const prompt = promptBefore(messages, assistant.seq)
  if (prompt === null) return disabled('not-found')

  const text = textOfRewriteContentV2(prompt.content)
  if (text === null) return disabled('not-text')
  if (!prompt.completed) return disabled('settlement-pending')

  const boundarySeq = previousTurnEndSeqV2(snapshot.turnEnds, prompt.seq)
  if (boundarySeq === null) return firstBoundaryDecision('retry', snapshot, prompt, text, capabilities)

  // Retry 锚定的 turn 仍在运行：等待落定，不能猜完成边界。
  if (!hasTurnEndAfter(snapshot.turnEnds, prompt.seq) && snapshot.running) return disabled('settlement-pending')

  return {
    ok: true,
    target: {
      kind: 'retry',
      key: `retry:${assistant.key}`,
      sourceSessionId: snapshot.sessionId,
      sourceGeneration: snapshot.generation,
      messageKey: prompt.key,
      messageSeq: prompt.seq,
      boundarySeq,
      text,
    },
  }
}
