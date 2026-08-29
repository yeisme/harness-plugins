// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ArtifactIntentSchema,
  PANE_ARTIFACT_SCHEMA,
  type ArtifactIntentV1,
  type ArtifactRefV1,
  type PaneContextV1,
} from '@yeisme/dsh-pane-protocol'
import {
  buildArtifactGestureIntent,
  createArtifactDragPayload,
  parseArtifactDragPayload,
  type ArtifactHandoffEvidenceV1,
} from '../src/artifacts.js'
import { PaneIntentDispatcher } from '../src/composition.js'
import {
  PaneArtifactHandoffMenu,
  type ArtifactHandoffTargetV1,
} from '../src/handoff-menu.js'

afterEach(cleanup)

const sourceRef: ArtifactRefV1 = {
  schema: PANE_ARTIFACT_SCHEMA,
  owner: 'eikona',
  kind: 'image',
  ref: 'artifact:image:1',
  version: '1',
  mediaType: 'image/png',
  title: 'Frame one',
  evidenceRefs: [],
  capabilities: ['handoff'],
}

const context: PaneContextV1 = { workspaceRef: 'workspace:one', revision: '1' }

const targets: readonly ArtifactHandoffTargetV1[] = [
  { owner: 'scaena', label: 'Scaena', paneKind: 'creator.production', intents: ['handoff', 'attach_context'] },
  { owner: 'pinax', label: 'Pinax', intents: ['link'] },
]

function renderMenu(extra: Partial<Parameters<typeof PaneArtifactHandoffMenu>[0]> = {}) {
  const dispatched: ArtifactIntentV1[] = []
  const evidence: ArtifactHandoffEvidenceV1[] = []
  const utils = render(createElement(PaneArtifactHandoffMenu, {
    source: sourceRef,
    context,
    targets,
    channel: 'local-contract',
    gesture: 'g-fixed',
    onDispatch: intent => { dispatched.push(intent) },
    onEvidence: record => { evidence.push(record) },
    ...extra,
  }))
  return { ...utils, dispatched, evidence }
}

function menuItems(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
}

describe('pane artifact handoff menu', () => {
  it('builds the exact same intent shape for menu clicks and drag payloads', () => {
    const { container, dispatched } = renderMenu()
    const item = container.querySelector<HTMLButtonElement>('[data-pane-handoff-target="scaena"] [data-pane-handoff-intent="handoff"]')!
    fireEvent.click(item)
    expect(dispatched).toHaveLength(1)
    const menuIntent = ArtifactIntentSchema.parse(dispatched[0])
    const dragIntent = buildArtifactGestureIntent({
      gesture: 'g-fixed',
      intent: 'handoff',
      source: sourceRef,
      targetOwner: 'scaena',
      targetPaneKind: 'creator.production',
      context,
    })
    const payload = parseArtifactDragPayload(createArtifactDragPayload(dragIntent))
    expect(payload).toEqual({ ok: true, intent: menuIntent })
    expect(menuIntent.idempotencyKey).toBe(dragIntent.idempotencyKey)
  })

  it('carries a stable idempotency key so a double click admits once end-to-end', () => {
    const dispatcher = new PaneIntentDispatcher()
    const handle = vi.fn(async () => ({ status: 'accepted' as const, receiptRef: 'receipt:scaena:1', owner: 'scaena', summary: 'Asset attached.' }))
    dispatcher.register({ id: 'creator.scaena-handoff', intents: ['handoff'], targetOwners: ['scaena'], handle })
    const evidence: ArtifactHandoffEvidenceV1[] = []
    const { container } = renderMenu({
      hasAdmission: key => dispatcher.hasAdmission(key),
      onDispatch: intent => { void dispatcher.dispatch(intent) },
      onEvidence: record => { evidence.push(record) },
    })
    const item = container.querySelector<HTMLButtonElement>('[data-pane-handoff-target="scaena"] [data-pane-handoff-intent="handoff"]')!
    fireEvent.click(item)
    fireEvent.click(item)
    return vi.waitFor(() => {
      expect(handle).toHaveBeenCalledOnce()
      expect(evidence.filter(record => record.kind === 'intent_duplicate')).toHaveLength(1)
    })
  })

  it('keeps entries usable on both channels and reports the resolved channel', () => {
    for (const channel of ['official', 'local-contract'] as const) {
      const { container, evidence, unmount } = renderMenu({ channel })
      expect(container.querySelector('[data-pane-handoff-menu]')?.getAttribute('data-pane-handoff-channel')).toBe(channel)
      for (const item of menuItems(container)) {
        expect(item.disabled).toBe(false)
      }
      expect(evidence).toContainEqual({ schema: 'pane.artifact-handoff-evidence.v1', kind: 'channel_resolved', channel })
      unmount()
    }
  })

  it('fails closed with a visible reason when the source ref is invalid', () => {
    const onDispatch = vi.fn()
    const { container } = renderMenu({ source: { ...sourceRef, ref: '/home/user/private/file.txt' }, onDispatch })
    expect(container.querySelector('[data-pane-handoff-reason="artifact_ref_invalid"]')).not.toBeNull()
    for (const item of menuItems(container)) {
      expect(item.disabled).toBe(true)
      fireEvent.click(item)
    }
    expect(onDispatch).not.toHaveBeenCalled()
  })

  it('disables fail-closed targets with their reason while other targets stay enabled', () => {
    const disabled: readonly ArtifactHandoffTargetV1[] = [
      { owner: 'scaena', label: 'Scaena', intents: ['handoff'], disabledReason: '目标模块未安装：dsh plugin add @yeisme/dsh-ai-drama-director' },
      { owner: 'pinax', label: 'Pinax', intents: ['link'] },
    ]
    const { container, dispatched } = renderMenu({ targets: disabled })
    const blocked = container.querySelector<HTMLButtonElement>('[data-pane-handoff-target="scaena"] [role="menuitem"]')!
    expect(blocked.disabled).toBe(true)
    expect(blocked.title).toContain('目标模块未安装')
    const open = container.querySelector<HTMLButtonElement>('[data-pane-handoff-target="pinax"] [role="menuitem"]')!
    fireEvent.click(open)
    expect(dispatched).toHaveLength(1)
    expect(dispatched[0]).toMatchObject({ intent: 'link', targetOwner: 'pinax' })
  })

  it('renders unknown intent kinds disabled instead of dispatching them', () => {
    const rogue: readonly ArtifactHandoffTargetV1[] = [
      { owner: 'scaena', label: 'Scaena', intents: ['teleport' as never] },
    ]
    const onDispatch = vi.fn()
    const { container } = renderMenu({ targets: rogue, onDispatch })
    const item = container.querySelector<HTMLButtonElement>('[role="menuitem"]')!
    expect(item.disabled).toBe(true)
    expect(item.getAttribute('data-pane-handoff-intent')).toBe('unknown')
    fireEvent.click(item)
    expect(onDispatch).not.toHaveBeenCalled()
  })
})
