# Agent Note: Conversation user-actions slot

Status: proposed

English | [中文](2026-08-20-conversation-user-actions-slot.zh.md)

## Problem

The conversation chat surface exposes exactly one per-message action slot, `conversation.chat.assistant-actions`, addressed by a finalized assistant `messageId`. User messages have no equivalent extension point: their IconActions row is hard-wired to copy + clock, so a plugin cannot contribute actions addressing a specific user message — the primitives needed for "edit and resend this message", "retry from before this message", or per-message provenance affordances. The historical result was either a dead UI stub (an edit button with no backend) or no surface at all.

## Proposal

Add the symmetric slot in `packages/client/ui-conversation`:

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

`UserMessageNodeView` (keys `user` and `steering`) declares the slot as a child and renders it into `MessageIconActions.extraActions`, between the built-in copy and clock controls — the same site discipline as the assistant strip. Two addressing facts fall out of the event grammar and are frozen into the owner type:

- Plain user nodes carry no durable `messageId`; the engine-owned `seq` is the addressing currency (it is also what session forking addresses).
- Admitted steering nodes do carry the `user/message` id, so `messageId` is optional and present only for them.

### Alternatives considered

- **Addressing by `messageId` only**: impossible for plain user nodes, which have none; would force contributors to guess or re-derive seqs.
- **A single message-agnostic slot with a `role` field**: widens every existing contributor's match surface for no current consumer; the assistant strip's "finalized message" invariant would be diluted.
- **No slot; ship edit/retry inside dsh core**: the mutation semantics (fork-and-resend) are already composable from `session.fork` + `session.prompt` by an independent plugin; only the render site is missing, and that is exactly what a slot is for.

## Consequences

- Additive only: the slot declaration, the two registrations, and the render wiring in `UserMessageNodeView`. No existing slot, event, or component semantics change; with zero contributors the rendered output is byte-identical (empty list renders nothing).
- Plugins can now ship per-user-message actions without importing the conversation implementation, mirroring the assistant-actions contract.
- Contributors must treat an in-flight turn as non-addressable (disable, do not hide silently) — same policy as assistant actions.

## Verification

- `packages/client/ui-conversation/tests/user-actions-slot.client.spec.tsx`: contributed action renders inside the user actions row; plain user owner is `{ seq }`; steering owner is `{ messageId, seq }`; empty list renders no markup and keeps copy/clock.
- Existing `chat-branch-tails.client.spec.tsx` user IconActions tests unchanged except a null `renderSlot` stub in the fixture adapter.
- Package typecheck and full `ui-conversation` client suite green.
