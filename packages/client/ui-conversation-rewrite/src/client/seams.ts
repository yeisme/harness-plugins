/**
 * Capability probes for conversation-rewrite additive seams.
 *
 * Published DSH still lacks `conversation.chat.user-actions` and
 * `session.forkBeforeMessage`. Probe first; never render a dead Edit/Retry
 * entry when the owner surface is absent.
 *
 * @module @yeisme/dsh-client-ui-conversation-rewrite/seams
 */

import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'

/** Owner currency of the user-message action strip. Matches the upstream slot PR. */
export interface UserActionOwnerProps {
  /** Durable `user/message` id; absent on plain user nodes. */
  readonly messageId?: MessageId | undefined
  /** Engine-owned node seq; the addressing currency for user nodes. */
  readonly seq: number
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface SlotMap {
    'conversation.chat.user-actions': {
      kind: 'list'
      scope: 'session'
      owner: UserActionOwnerProps
    }
  }
}

/** Narrow slots face used by the probe so tests do not need a full ClientContext. */
export interface SlotSpecReader {
  spec(name: 'conversation.chat.user-actions' | (string & {})): unknown
}

/** Host face that may grow `forkBeforeMessage` after the Wave B seam lands. */
export interface ForkBeforeMessageHost {
  forkBeforeMessage?(opts: { sessionId: SessionId; atMessageSeq: number }): Promise<SessionId>
}

/** True when the conversation surface published the user-actions list slot. */
export function hasUserActionsSlot(slots: SlotSpecReader | undefined): boolean {
  return slots !== undefined && slots.spec('conversation.chat.user-actions') !== undefined
}

/** Bind `forkBeforeMessage` when the sessions host actually exposes it. */
export function bindForkBeforeMessage(sessions: unknown): ForkBeforeMessageHost['forkBeforeMessage'] {
  if (sessions === null || typeof sessions !== 'object') return undefined
  const candidate = Reflect.get(sessions, 'forkBeforeMessage')
  if (typeof candidate !== 'function') return undefined
  return (opts) => candidate.call(sessions, opts) as Promise<SessionId>
}
