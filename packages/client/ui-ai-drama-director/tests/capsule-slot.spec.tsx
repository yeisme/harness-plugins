// @vitest-environment jsdom
/**
 * Header capsule slot (real-render wave): declaration-gated registration,
 * source precedence (remote gateway → fixture → static capsule), fail-closed
 * decode, switch routing, and idempotent dispose.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement, type ReactNode } from 'react'
import { Context } from '@deepseek-ai/cordis'
import {
  buildPipelineCapsuleOpenRequest,
  decodePipelineCapsuleProjection,
  minimalPipelineCapsule,
  registerPipelineCapsuleSlot,
  PIPELINE_CAPSULE_REASONS,
  PIPELINE_CAPSULE_SLOT,
  PIPELINE_CAPSULE_SLOT_ENTRY_ID,
} from '../src/client/capsule-slot.js'
import {
  createPipelineFixtureOwner,
  PIPELINE_FIXTURE_OWNER_SERVICE,
} from '../src/client/pipeline/fixture-owner.js'
import { PIPELINE_WORKBENCH_PANE_KIND } from '../src/client/pipeline/workbench-pane.js'

afterEach(cleanup)

interface SlotRegistration {
  readonly input: Record<string, unknown>
  readonly component: (props: never) => ReactNode
}

function fakeSlots(options: { readonly declared?: boolean; readonly withSpec?: boolean } = {}) {
  const registrations: SlotRegistration[] = []
  const injections: string[] = []
  let unclaims = 0
  return {
    registrations,
    injections,
    unclaims: () => unclaims,
    inject(name: string, setup: () => () => void): () => void {
      injections.push(name)
      const unregister = setup()
      return () => {
        unclaims += 1
        unregister()
      }
    },
    register(input: Record<string, unknown>, component: (props: never) => ReactNode): () => void {
      const registration: SlotRegistration = { input, component }
      registrations.push(registration)
      return () => {
        const index = registrations.indexOf(registration)
        if (index >= 0) registrations.splice(index, 1)
      }
    },
    ...(options.withSpec === false
      ? {}
      : { spec(name: string): unknown { return options.declared === false ? undefined : { name } } }),
  }
}

function fakePane() {
  const opens: Array<Record<string, unknown>> = []
  return {
    opens,
    registerView(): () => void { return () => {} },
    openView(request: unknown): void { opens.push(request as Record<string, unknown>) },
  }
}

function contextWith(extras: Record<string, unknown>): Context {
  const ctx = new Context()
  for (const [key, value] of Object.entries(extras)) ctx.provide(key, value)
  return ctx
}

function capsuleRegistration(slots: ReturnType<typeof fakeSlots>): SlotRegistration {
  const registration = slots.registrations.find(item => item.input.id === PIPELINE_CAPSULE_SLOT_ENTRY_ID)
  if (registration === undefined) throw new Error('capsule slot entry was not registered')
  return registration
}

function renderCapsule(slots: ReturnType<typeof fakeSlots>): void {
  render(createElement(capsuleRegistration(slots).component))
}

describe('registerPipelineCapsuleSlot gating', () => {
  it('does not register when the slots service is missing', () => {
    const ctx = contextWith({})
    const handle = registerPipelineCapsuleSlot(ctx as never)
    expect(handle.snapshot()).toMatchObject({
      registered: false,
      phase: 'unavailable',
      reason: PIPELINE_CAPSULE_REASONS.slots,
    })
    expect(() => handle.dispose()).not.toThrow()
  })

  it('does not register when the header actions slot is not declared', () => {
    const slots = fakeSlots({ declared: false })
    const ctx = contextWith({ slots })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    expect(handle.snapshot()).toMatchObject({
      registered: false,
      phase: 'unavailable',
      reason: PIPELINE_CAPSULE_REASONS.declaration,
    })
    expect(slots.injections).toEqual([])
    expect(slots.registrations).toEqual([])
  })

  it('treats a slots face without spec() as undeclared (fail closed)', () => {
    const slots = fakeSlots({ withSpec: false })
    const ctx = contextWith({ slots })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    expect(handle.snapshot().registered).toBe(false)
    expect(handle.snapshot().reason).toBe(PIPELINE_CAPSULE_REASONS.declaration)
    expect(slots.injections).toEqual([])
  })

  it('claims the official header actions slot when the declaration probes', () => {
    const slots = fakeSlots()
    const ctx = contextWith({ slots })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    expect(handle.snapshot().registered).toBe(true)
    expect(slots.injections).toEqual([PIPELINE_CAPSULE_SLOT])
    const registration = capsuleRegistration(slots)
    expect(registration.input).toMatchObject({
      name: PIPELINE_CAPSULE_SLOT,
      id: PIPELINE_CAPSULE_SLOT_ENTRY_ID,
    })
    expect(typeof registration.input.order).toBe('number')
  })
})

describe('pipeline capsule data source', () => {
  it('falls back to the fixture owner when the real gateway is absent', async () => {
    const slots = fakeSlots()
    const fixture = createPipelineFixtureOwner()
    const ctx = contextWith({ slots, [PIPELINE_FIXTURE_OWNER_SERVICE]: fixture })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    renderCapsule(slots)
    expect(await screen.findByTestId('plw-capsule')).toBeTruthy()
    expect(fixture.calls.snapshot).toBe(1)
    expect(handle.snapshot().phase).toBe('fixture')
    expect(handle.snapshot().reason).toBeUndefined()
  })

  it('prefers the real remote.creativePipeline gateway over the fixture', async () => {
    const slots = fakeSlots()
    const fixture = createPipelineFixtureOwner()
    let gatewayReads = 0
    const gateway = {
      snapshot: async () => {
        gatewayReads += 1
        const envelope = await createPipelineFixtureOwner().snapshot()
        return envelope
      },
    }
    const ctx = contextWith({ slots, remote: { creativePipeline: gateway }, [PIPELINE_FIXTURE_OWNER_SERVICE]: fixture })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    renderCapsule(slots)
    expect(await screen.findByTestId('plw-capsule')).toBeTruthy()
    expect(gatewayReads).toBe(1)
    expect(fixture.calls.snapshot).toBe(0)
    expect(handle.snapshot().phase).toBe('remote')
  })

  it('renders nothing and records the decode reason when the capsule violates the contract', async () => {
    const slots = fakeSlots()
    const broken = { snapshot: async () => ({ schema: 'dsh.creative-pipeline-workbench-snapshot.v1alpha1', capsule: { nope: true } }) }
    const ctx = contextWith({ slots, remote: { creativePipeline: broken } })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    renderCapsule(slots)
    await waitFor(() => expect(handle.snapshot().phase).toBe('unavailable'))
    expect(handle.snapshot().reason).toContain('pipeline.')
    expect(screen.queryByTestId('plw-capsule')).toBeNull()
  })

  it('renders nothing and records the reason when the projection read fails', async () => {
    const slots = fakeSlots()
    const failing = { snapshot: async () => { throw new Error('owner down') } }
    const ctx = contextWith({ slots, remote: { creativePipeline: failing } })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    renderCapsule(slots)
    await waitFor(() => expect(handle.snapshot().phase).toBe('unavailable'))
    expect(handle.snapshot().reason).toBe(PIPELINE_CAPSULE_REASONS.readFailed)
    expect(screen.queryByTestId('plw-capsule')).toBeNull()
  })

  it('renders the minimal static capsule without run state when no source probes', async () => {
    const slots = fakeSlots()
    const ctx = contextWith({ slots })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    renderCapsule(slots)
    const capsule = (await screen.findByTestId('plw-capsule')) as HTMLElement
    expect(capsule.getAttribute('data-surface')).toBe('workbench')
    expect(handle.snapshot()).toMatchObject({ phase: 'static', reason: PIPELINE_CAPSULE_REASONS.source })
    // No run chip and no review/draft indicators on the static tier.
    expect(capsule.querySelector('[role="status"]')).toBeNull()
    expect(capsule.querySelector('.plw-capsule-badge')).toBeNull()
    expect(capsule.querySelector('.plw-capsule-dot')).toBeNull()
  })
})

describe('pipeline capsule surface switching', () => {
  it('opens the singleton creator.pipeline pane when switching to workbench', async () => {
    const slots = fakeSlots()
    const pane = fakePane()
    const ctx = contextWith({ slots, [PIPELINE_FIXTURE_OWNER_SERVICE]: createPipelineFixtureOwner() })
    registerPipelineCapsuleSlot(ctx as never, { pane })
    renderCapsule(slots)
    fireEvent.click(await screen.findByRole('button', { name: 'Workbench' }))
    expect(pane.opens).toEqual([
      expect.objectContaining({
        kind: PIPELINE_WORKBENCH_PANE_KIND,
        resourceKey: 'creator:pipeline',
        singleton: true,
        retention: 'keep-alive',
      }),
    ])
    expect(screen.getByRole('button', { name: 'Workbench' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('routes the agent switch to local surface state only (no fabricated navigation)', async () => {
    const slots = fakeSlots()
    const pane = fakePane()
    const ctx = contextWith({ slots, [PIPELINE_FIXTURE_OWNER_SERVICE]: createPipelineFixtureOwner() })
    registerPipelineCapsuleSlot(ctx as never, { pane })
    renderCapsule(slots)
    fireEvent.click(await screen.findByRole('button', { name: 'Agent' }))
    expect(pane.opens).toEqual([])
    expect(screen.getByRole('button', { name: 'Agent' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Workbench' }).getAttribute('aria-pressed')).toBe('false')
  })

  it('disables switching with the probe reason when the Pane Workbench face is missing', async () => {
    const slots = fakeSlots()
    const ctx = contextWith({ slots, [PIPELINE_FIXTURE_OWNER_SERVICE]: createPipelineFixtureOwner() })
    registerPipelineCapsuleSlot(ctx as never)
    renderCapsule(slots)
    await waitFor(() => expect(screen.queryByTestId('plw-capsule')).toBeNull())
    const control = await screen.findByRole('button', { name: 'Agent ⇄ Workbench' })
    expect((control as HTMLButtonElement).disabled).toBe(true)
    expect(control.getAttribute('title')).toBe(PIPELINE_CAPSULE_REASONS.pane)
  })
})

describe('pipeline capsule dispose', () => {
  it('is idempotent and reverts the slot claim exactly once', () => {
    const slots = fakeSlots()
    const ctx = contextWith({ slots })
    const handle = registerPipelineCapsuleSlot(ctx as never, { pane: fakePane() })
    expect(slots.unclaims()).toBe(0)
    handle.dispose()
    expect(slots.unclaims()).toBe(1)
    handle.dispose()
    handle.dispose()
    expect(slots.unclaims()).toBe(1)
  })
})

describe('capsule slot helpers', () => {
  it('builds the pipeline pane open request for the singleton workbench pane', () => {
    expect(buildPipelineCapsuleOpenRequest()).toMatchObject({
      kind: PIPELINE_WORKBENCH_PANE_KIND,
      role: 'content',
      preferredRegion: 'right',
      singleton: true,
    })
  })

  it('the static capsule passes the fail-closed decoder', () => {
    const capsule = minimalPipelineCapsule()
    expect(capsule).toBeDefined()
    expect(capsule?.surface).toBe('workbench')
    expect(capsule?.run).toBeUndefined()
    expect(capsule?.menu.run_state).toBe('unknown')
    expect(capsule?.pending_review).toBe(false)
  })

  it('decoder rejects non-envelope and bad-capsule input fail-closed', () => {
    expect(decodePipelineCapsuleProjection(undefined).ok).toBe(false)
    expect(decodePipelineCapsuleProjection({ capsule: { surface: 'workbench' } }).ok).toBe(false)
    const fixture = createPipelineFixtureOwner()
    return fixture.snapshot().then(envelope => {
      const decoded = decodePipelineCapsuleProjection(envelope)
      expect(decoded.ok).toBe(true)
    })
  })
})
