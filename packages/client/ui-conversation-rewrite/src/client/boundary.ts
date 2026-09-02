/**
 * Branch/Edit/Retry 统一边界计算（V2 core facade）。
 *
 * DSH-specific addressing（messageId/turn-tail single-tail 启发式）留在本
 * adapter；稳定边界、fail-closed reason 与 target 推导委托给 host-neutral 的
 * `@yeisme/dsh-client-ui-conversation-rewrite-core`。V1 的签名、返回形状与
 * 五个 legacy reason 保持不变；V2 新增 reason 按语义折回最近的 legacy 值。
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/boundary
 */

import type { ConversationSnapshot, ConversationNode, SteeringMessageNode, UserMessageNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import {
  computeRetryTargetV2,
  computeUserTurnTargetV2,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core'
import type {
  RewriteCapabilitiesV2,
  RewriteConversationSnapshotV2,
  RewriteDecisionV2,
  RewriteDisableReasonV2,
  RewriteMessageV2,
} from '@yeisme/dsh-client-ui-conversation-rewrite-core'

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
  /** 目标消息的会话事件 seq（retry 为 assistant seq，edit 为 user seq）。 */
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

/** 返回小于 beforeSeq 的最近 turn/end seq；没有则 null。 */
export function previousTurnEndSeq(snapshot: ConversationSnapshot, beforeSeq: number): number | null {
  let best: number | null = null
  for (const seq of snapshot.turnEnds.values()) {
    if (seq < beforeSeq && (best === null || seq > best)) best = seq
  }
  return best
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

function sameMessageId(left: MessageId | undefined, right: MessageId): boolean {
  return left !== undefined && (left === right || String(left) === String(right))
}

interface AddressedAssistant {
  readonly node: Extract<ConversationNode, { kind: 'assistant' }>
  /**
   * True when the node matched messageId exactly. False when it came from the
   * single-tail heuristic: only that path may fall back to the newest prompt,
   * because its seq is not comparable with the legacy window.
   */
  readonly exact: boolean
}

function assistantForMessage(snapshot: ConversationSnapshot, messageId: MessageId): AddressedAssistant | undefined {
  const legacy = snapshot.nodes.find((node): node is Extract<ConversationNode, { kind: 'assistant' }> =>
    node.kind === 'assistant' && sameMessageId(node.messageId, messageId),
  )
  if (legacy !== undefined) return { node: legacy, exact: true }

  // Current DSH renders the action strip from the incremental turn-tail node.
  // Older histories can omit that final assistant from the top-level legacy
  // window while retaining it as closing.finalNode in the Chat target.
  const chatNodes = snapshot.chat?.nodes?.values?.() ?? []
  const tailFinals: Extract<ConversationNode, { kind: 'assistant' }>[] = []
  for (const node of chatNodes) {
    if (node.kind !== 'turn-tail' || typeof node.data !== 'object' || node.data === null) continue
    const closing = (node.data as { closing?: { finalNode?: ConversationNode } | null }).closing
    const finalNode = closing?.finalNode
    if (finalNode?.kind !== 'assistant') continue
    if (sameMessageId(finalNode.messageId, messageId)) return { node: finalNode, exact: true }
    tailFinals.push(finalNode)
  }
  // Some rc.7 slot runtimes deliver a per-entry UUID that differs from the
  // durable finalNode.messageId. With exactly one completed Turn tail there is
  // still one unambiguous addressed assistant; never guess when several exist.
  const [onlyTail] = tailFinals
  if (tailFinals.length === 1 && onlyTail !== undefined) return { node: onlyTail, exact: false }
  return undefined
}

/** Optional first-round support: only true when `session.forkBeforeMessage` is bound. */
export interface RewriteBoundaryOptions {
  readonly firstRound?: boolean
}

// ─── V2 core delegation ──────────────────────────────────────────────────────

function nodeKey(node: ConversationNode): string {
  return `${node.kind}:seq:${node.seq}`
}

/** DSH snapshot → host-neutral V2 snapshot（最小投影；generation Web 侧未知恒为 0）。 */
function toV2Snapshot(snapshot: ConversationSnapshot): RewriteConversationSnapshotV2 {
  // 只投影 boundary 关心的三类节点；assistant 节点无 content（durable identity only）。
  const messages: RewriteMessageV2[] = []
  for (const node of snapshot.nodes) {
    if (node.kind !== 'user' && node.kind !== 'steering' && node.kind !== 'assistant') continue
    const content: readonly { readonly type: string; readonly [key: string]: unknown }[] =
      node.kind === 'assistant'
        ? []
        : (node.content as unknown as readonly { readonly type: string; readonly [key: string]: unknown }[])
    messages.push({
      key: nodeKey(node),
      kind: node.kind,
      seq: node.seq,
      ...(node.kind === 'assistant' && node.messageId !== undefined ? { messageId: String(node.messageId) } : {}),
      content,
      completed: true,
    })
  }
  return {
    sessionId: String(snapshot.sessionId),
    generation: 0,
    running: snapshot.running,
    removed: snapshot.removed,
    messages,
    turnEnds: [...snapshot.turnEnds.values()],
  }
}

/**
 * V2 reason → legacy reason：新增的 settlement/stable-boundary/stale 折回
 * 语义最近的 V1 值（running / first-round / not-found）。
 */
function toV1Reason(reason: RewriteDisableReasonV2): RewriteDisableReason {
  switch (reason) {
    case 'not-found':
    case 'not-text':
    case 'running':
    case 'first-round':
    case 'removed':
      return reason
    case 'settlement-pending':
      return 'running'
    case 'stable-boundary-unavailable':
      return 'first-round'
    case 'stale':
      return 'not-found'
  }
}

function toV1Decision(decision: RewriteDecisionV2, assistantSeq: number | null, messageId?: MessageId): RewriteDecision {
  if (!decision.ok) return disabled(toV1Reason(decision.reason))
  const target = decision.target
  // V1 target：edit 的 key/seq 用 user seq；retry 的 key 用 messageId、seq 用 assistant seq。
  const seq = target.kind === 'retry' && assistantSeq !== null ? assistantSeq : target.messageSeq
  const key = target.kind === 'retry' ? `retry:${messageId}` : `edit:${seq}`
  return { ok: true, target: { kind: target.kind, key, seq, boundarySeq: target.boundarySeq, text: target.text } }
}

function capabilitiesOf(options?: RewriteBoundaryOptions): RewriteCapabilitiesV2 {
  return { forkBeforeMessage: options?.firstRound === true }
}

/** 计算 Retry 的派生目标：定位 assistant 对应 prompt，再取 prompt 之前的 turn/end。 */
export function computeRetryTarget(
  snapshot: ConversationSnapshot,
  messageId: MessageId,
  options?: RewriteBoundaryOptions,
): RewriteDecision {
  if (snapshot.removed) return disabled('removed')

  const addressed = assistantForMessage(snapshot, messageId)
  if (addressed === undefined) return disabled('not-found')
  const assistant = addressed.node

  // single-tail 启发式且窗口内没有更早 prompt 时，V1 回退到最新 prompt；
  // 用超过全部 seq 的合成 assistant seq 在 V2 snapshot 中表达该 addressing
  // 决策（决策属于 adapter，core 不做 fallback）。
  const base = toV2Snapshot(snapshot)
  const assistantKey = nodeKey(assistant)
  const messages = [...base.messages]
  let syntheticSeq = assistant.seq
  if (!addressed.exact && findPromptBefore(snapshot.nodes, assistant.seq) === null) {
    syntheticSeq = snapshot.nodes.reduce((max, node) => Math.max(max, node.seq), 0) + 1
  }
  if (!messages.some((message) => message.key === assistantKey)) {
    messages.push({ key: assistantKey, kind: 'assistant', seq: syntheticSeq, content: [], completed: true })
  }
  const v2: RewriteConversationSnapshotV2 = { ...base, messages }

  const decision = computeRetryTargetV2(v2, assistantKey, capabilitiesOf(options))
  return toV1Decision(decision, assistant.seq, messageId)
}

/** 计算 Edit 的派生目标：仅接受已发送且纯文本的用户消息。 */
export function computeEditTarget(
  snapshot: ConversationSnapshot,
  seq: number,
  options?: RewriteBoundaryOptions,
): RewriteDecision {
  if (snapshot.removed) return disabled('removed')

  // V1 语义：Edit 只寻址 user 节点（steering 不经此 API）。
  const node = snapshot.nodes.find((candidate): candidate is UserMessageNode => candidate.kind === 'user' && candidate.seq === seq)
  if (node === undefined) return disabled('not-found')

  const decision = computeUserTurnTargetV2(toV2Snapshot(snapshot), seq, 'edit', capabilitiesOf(options))
  return toV1Decision(decision, null)
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
