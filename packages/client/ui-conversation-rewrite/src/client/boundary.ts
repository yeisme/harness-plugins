/**
 * Branch/Edit/Retry 统一边界计算。
 *
 * 这些纯函数只做“在哪个稳定边界派生 child”的决策，不发起任何 mutation。
 * 未知/partial/stale/运行中状态一律返回 typed disabled reason，绝不自动重试。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/boundary
 */

import type { ConversationSnapshot, ConversationNode, SteeringMessageNode, UserMessageNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'

/** 禁用原因；组件据此显示可理解的文案，不吞失败。 */
export type RewriteDisableReason =
  | 'not-found'
  | 'not-text'
  | 'running'
  | 'first-round'
  | 'removed'

/** Edit/Retry 共享的派生目标：boundarySeq 为 null 时表示需要 forkBeforeMessage 支持首轮。 */
export interface RewriteTarget {
  readonly kind: 'edit' | 'retry'
  readonly key: string
  /** 目标消息的会话事件 seq。 */
  readonly seq: number
  /** 目标消息之前的最近 turn/end；null 表示首轮（依赖 forkBeforeMessage）。 */
  readonly boundarySeq: number | null
  /** 新 child 中要发送的文本内容。 */
  readonly text: string
}

export type RewriteDecision =
  | { ok: true; target: RewriteTarget }
  | { ok: false; reason: RewriteDisableReason }

type MessageContent = UserMessageNode['content'] | SteeringMessageNode['content']

/** 仅当消息内容全部为 text 块时返回拼接文本，否则返回 null（附件/图片等非文本内容 V1 不静默改写）。 */
export function textOfContent(content: MessageContent): string | null {
  let text = ''
  for (const block of content) {
    if (block.type !== 'text') return null
    text += block.text
  }
  return text.length === 0 ? null : text
}

function isTextOnly(content: MessageContent): boolean {
  return textOfContent(content) !== null
}

/** 返回小于 beforeSeq 的最近 turn/end seq；没有则 null。 */
export function previousTurnEndSeq(snapshot: ConversationSnapshot, beforeSeq: number): number | null {
  let best: number | null = null
  for (const seq of snapshot.turnEnds.values()) {
    if (seq < beforeSeq && (best === null || seq > best)) best = seq
  }
  return best
}

/** 是否存在位于 seq 之后的已完成 turn/end。 */
function hasTurnEndAfter(snapshot: ConversationSnapshot, seq: number): boolean {
  for (const endSeq of snapshot.turnEnds.values()) {
    if (endSeq > seq) return true
  }
  return false
}

/** 从 assistant 节点向前找最近一条已发送 user/steering 消息作为该轮次的用户输入。 */
function findPromptBefore(nodes: readonly ConversationNode[], beforeSeq: number): UserMessageNode | SteeringMessageNode | null {
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const node = nodes[index]
    if (node === undefined || node.seq >= beforeSeq) continue
    if (node.kind === 'user' || node.kind === 'steering') return node
  }
  return null
}

function disabled(reason: RewriteDisableReason): RewriteDecision {
  return { ok: false, reason }
}

/** Optional first-round support: only true when `session.forkBeforeMessage` is bound. */
export interface RewriteBoundaryOptions {
  readonly firstRound?: boolean
}

function firstRoundDecision(
  kind: RewriteTarget['kind'],
  key: string,
  seq: number,
  text: string,
  firstRound: boolean | undefined,
): RewriteDecision {
  if (firstRound === true) {
    return { ok: true, target: { kind, key, seq, boundarySeq: null, text } }
  }
  return disabled('first-round')
}

/** 计算 Retry 的派生目标：定位 assistant 对应 prompt，再取 prompt 之前的 turn/end。 */
export function computeRetryTarget(
  snapshot: ConversationSnapshot,
  messageId: MessageId,
  options?: RewriteBoundaryOptions,
): RewriteDecision {
  if (snapshot.removed) return disabled('removed')

  const assistant = snapshot.nodes.find((node): node is Extract<ConversationNode, { kind: 'assistant'; messageId?: MessageId }> =>
    node.kind === 'assistant' && node.messageId === messageId,
  )
  if (assistant === undefined) return disabled('not-found')

  const prompt = findPromptBefore(snapshot.nodes, assistant.seq)
  if (prompt === null) return disabled('not-found')
  if (!isTextOnly(prompt.content)) return disabled('not-text')

  const text = textOfContent(prompt.content)
  if (text === null) return disabled('not-text')

  const boundarySeq = previousTurnEndSeq(snapshot, prompt.seq)
  if (boundarySeq === null) {
    return firstRoundDecision('retry', `retry:${messageId}`, assistant.seq, text, options?.firstRound)
  }
  if (!hasTurnEndAfter(snapshot, prompt.seq) && snapshot.running) return disabled('running')

  return {
    ok: true,
    target: {
      kind: 'retry',
      key: `retry:${messageId}`,
      seq: assistant.seq,
      boundarySeq,
      text,
    },
  }
}

/** 计算 Edit 的派生目标：仅接受已发送且纯文本的用户消息。 */
export function computeEditTarget(
  snapshot: ConversationSnapshot,
  seq: number,
  options?: RewriteBoundaryOptions,
): RewriteDecision {
  if (snapshot.removed) return disabled('removed')

  const node = snapshot.nodes.find((candidate): candidate is UserMessageNode => candidate.kind === 'user' && candidate.seq === seq)
  if (node === undefined) return disabled('not-found')
  if (!isTextOnly(node.content)) return disabled('not-text')

  const text = textOfContent(node.content)
  if (text === null) return disabled('not-text')

  const boundarySeq = previousTurnEndSeq(snapshot, seq)
  if (boundarySeq === null) {
    return firstRoundDecision('edit', `edit:${seq}`, seq, text, options?.firstRound)
  }
  if (!hasTurnEndAfter(snapshot, seq) && snapshot.running) return disabled('running')

  return {
    ok: true,
    target: {
      kind: 'edit',
      key: `edit:${seq}`,
      seq,
      boundarySeq,
      text,
    },
  }
}

/** 将禁用原因映射为稳定的 UI 文案 key。 */
export function disableReasonKey(reason: RewriteDisableReason, kind: 'edit' | 'retry'): string {
  if (kind === 'retry') {
    switch (reason) {
      case 'not-found': return 'retry.disabled.notFound'
      case 'not-text': return 'retry.disabled.notText'
      case 'running': return 'retry.disabled.running'
      case 'first-round': return 'retry.disabled.firstRound'
      case 'removed': return 'retry.disabled.removed'
    }
  }
  switch (reason) {
    case 'not-found': return 'edit.disabled.notFound'
    case 'not-text': return 'edit.disabled.notText'
    case 'running': return 'edit.disabled.running'
    case 'first-round': return 'edit.disabled.firstRound'
    case 'removed': return 'edit.disabled.removed'
  }
}
