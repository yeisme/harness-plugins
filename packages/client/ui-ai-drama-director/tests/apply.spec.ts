import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { PaneCommandDescriptorSchema, PaneViewDescriptorSchema } from '@yeisme/dsh-pane-protocol'
import {
  createWorkbenchHandoff,
  type DramaContextV1,
  type DramaEvidenceRecordV1,
  type SignedWorkbenchHandoffV1,
} from '@yeisme/dsh-ai-drama-director'
import { apply, type DramaDirectorClientFace } from '../src/client/index.js'

const flush = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0))

interface RegisteredView {
  readonly descriptor: Record<string, unknown>
  readonly component: unknown
}

interface RegisteredCommand {
  readonly descriptor: Record<string, unknown>
  readonly execute: () => unknown
}

function fakePane() {
  const views = new Map<string, RegisteredView>()
  const commands = new Map<string, RegisteredCommand>()
  const opens: Array<Record<string, unknown>> = []
  return {
    views,
    commands,
    opens,
    registerView(input: unknown) {
      const registration = input as RegisteredView
      const kind = registration.descriptor.kind as string
      if (views.has(kind)) throw new Error(`duplicate_kind ${kind}`)
      views.set(kind, registration)
      return () => {
        views.delete(kind)
      }
    },
    registerCommand(input: unknown) {
      const registration = input as RegisteredCommand
      const id = registration.descriptor.id as string
      if (commands.has(id)) throw new Error(`duplicate_command ${id}`)
      commands.set(id, registration)
      return () => {
        commands.delete(id)
      }
    },
    openView(request: unknown) {
      opens.push(request as Record<string, unknown>)
    },
    async executeCommand(id: string) {
      return commands.get(id)?.execute()
    },
  }
}

function contextV1(freshness: DramaContextV1['freshness'] = 'fresh'): DramaContextV1 {
  return {
    schema: 'drama.context.v1',
    workspaceRef: 'ws:1',
    projectRef: 'pr:1',
    showRef: 'show:1',
    ownerVersions: { drama: 'v1' },
    contextRevision: 'rev:1',
    freshness,
  }
}

function fakeRemote(options: { freshness?: DramaContextV1['freshness']; dispatchResult?: unknown } = {}) {
  const dispatchCalls: unknown[] = []
  const snapshotCalls: number[] = []
  const dramaDirector = {
    snapshot: async () => {
      snapshotCalls.push(1)
      return contextV1(options.freshness ?? 'fresh')
    },
    dispatch: async (request: unknown) => {
      dispatchCalls.push(request)
      return options.dispatchResult ?? { kind: 'submitted', reason: 'accepted', retried: false }
    },
    requestHandoff: async (input: { readonly contextRef: string }) =>
      createWorkbenchHandoff({
        contextRef: input.contextRef,
        targetSurface: 'workbench',
        presentationIntent: 'open_show',
        nonce: `nonce:${dispatchCalls.length}:${snapshotCalls.length}`,
        expiresAt: Date.now() + 60_000,
      }),
  }
  return {
    remote: { creatorStudio: { snapshot: async () => ({}) }, dramaDirector },
    dispatchCalls,
    snapshotCalls,
  }
}

function fakeShowControlRemote() {
  return {
    snapshot: async (showRef: string) => ({ schemaVersion: 'drama.show-control.snapshot.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, generatedAt: '2026-08-29T00:00:00Z', showRef, showVersion: 'v1', title: 'Show one', status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', summary: { episodeCount: 0, activeEpisodeCount: 0, reviewCount: 0, attentionCount: 0, assetCount: 0, deliveryReadyCount: 0 }, blockerRefs: [], evidenceRefs: [] }),
    episodes: async (query: { showRef: string }) => ({ schemaVersion: 'drama.show-control.episode-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [] }),
    reviews: async (query: { showRef: string }) => ({ schemaVersion: 'drama.show-control.review-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [] }),
    assets: async (query: { showRef: string }) => ({ schemaVersion: 'drama.show-control.asset-page.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, showRef: query.showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', items: [] }),
    delivery: async (showRef: string) => ({ schemaVersion: 'drama.show-control.delivery.v1alpha1', snapshotRef: 'show:snapshot:one', snapshotVersion: 1, generatedAt: '2026-08-29T00:00:00Z', showRef, status: 'ready', freshness: 'fresh', safeMessage: 'Ready.', readyCount: 0, totalCount: 0, items: [], blockerRefs: [], evidenceRefs: [] }),
    previewAction: async () => { throw new Error('no targets') },
    dispatch: async () => ({ status: 'reconcile_required', receiptRef: 'receipt:unused', owner: 'ordo', reconcileReason: 'unused' }),
  }
}

function setup(options: Parameters<typeof fakeRemote>[0] = {}, extras: Record<string, unknown> = {}) {
  const ctx = new Context()
  const pane = fakePane()
  const remote = fakeRemote(options)
  const records: DramaEvidenceRecordV1[] = []
  ctx.provide('paneWorkbench', pane)
  ctx.provide('remote', remote.remote)
  ctx.provide('dramaEvidenceSink', (record: DramaEvidenceRecordV1) => records.push(record))
  for (const [key, value] of Object.entries(extras)) ctx.provide(key, value)
  const face = () => ctx.get('dramaDirector') as DramaDirectorClientFace
  return { ctx, pane, remote, records, face }
}

describe('retired standalone Workbench launch', () => {
  it('rejects every launch intent without contacting either V2 or legacy transport', async () => {
    const { ctx, pane, remote, records, face } = setup()
    let requests = 0
    Object.assign(remote.remote.dramaDirector, {
      requestBridgeLaunch: async () => { requests++; throw new Error('retired target contacted') },
      requestHandoff: async () => { requests++; throw new Error('retired legacy contacted') },
    })
    const dispose = await apply(ctx as never)
    await flush()
    for (const intent of ['open_show', 'open_episode', 'open_artifact', 'open_review', 'open_evidence'] as const) {
      expect(await face().activateWorkbenchLaunch(intent)).toMatchObject({
        state: 'disabled', disabledReason: 'target_unavailable', intent,
      })
    }
    await pane.commands.get('drama.handoff')?.execute()
    expect(requests).toBe(0)
    expect(records.some(record => record.kind === 'handoff_opened')).toBe(false)
    dispose()
  })
})

describe('drama client apply', () => {
  it('runs in a DOM-less runtime (no window/document listeners)', async () => {
    expect(typeof window).toBe('undefined')
    const { ctx, pane } = setup()
    const dispose = await apply(ctx as never)
    expect(pane.views.size).toBe(11)
    dispose()
    expect(pane.views.size).toBe(0)
  })

  it('registers the six Director and four show-control views with schema-valid descriptors', async () => {
    const { ctx, pane } = setup()
    const dispose = await apply(ctx as never)

    expect([...pane.views.keys()].sort()).toEqual([
      'creator.pipeline',
      'drama.asset-wall',
      'drama.audio',
      'drama.context',
      'drama.delivery',
      'drama.review',
      'drama.review-inbox',
      'drama.run',
      'drama.show-board',
      'drama.story',
      'drama.visual',
    ])
    for (const registration of pane.views.values()) {
      expect(() => PaneViewDescriptorSchema.parse(registration.descriptor)).not.toThrow()
      expect(typeof registration.component).toBe('function')
    }
    dispose()
  })

  it('contributes the /drama group as pane command descriptors with slash metadata', async () => {
    const { ctx, pane } = setup()
    const dispose = await apply(ctx as never)

    expect(pane.commands.size).toBe(14)
    for (const registration of pane.commands.values()) {
      expect(() => PaneCommandDescriptorSchema.parse(registration.descriptor)).not.toThrow()
    }
    const hub = pane.commands.get('drama')
    expect(hub?.descriptor.presentation).toMatchObject({ launcher: true, group: 'drama' })
    expect(hub?.descriptor.slash).toMatchObject({ name: 'drama', category: 'work' })
    expect((hub?.descriptor.slash as { hint: string }).hint.length).toBeLessThanOrEqual(80)
    expect(((hub?.descriptor.slash as { aliases: string[] }).aliases).length).toBeLessThanOrEqual(4)
    dispose()
  })

  it('disposes exactly and rebuilds cleanly across HMR-style reloads', async () => {
    const { ctx, pane } = setup()

    const first = await apply(ctx as never)
    expect(pane.views.size).toBe(11)
    expect(pane.commands.size).toBe(14)
    first()
    expect(pane.views.size).toBe(0)
    expect(pane.commands.size).toBe(0)
    expect(ctx.get('dramaDirector')).toBeUndefined()

    const second = await apply(ctx as never)
    expect(pane.views.size).toBe(11)
    second()
    const third = await apply(ctx as never)
    expect(pane.views.size).toBe(11)
    expect(pane.commands.size).toBe(14)
    third()
    expect(pane.views.size).toBe(0)
  })

  it('keeps a second apply a no-op while mounted', async () => {
    const { ctx, pane } = setup()
    const first = await apply(ctx as never)
    const second = await apply(ctx as never)
    expect(pane.views.size).toBe(11)
    second()
    expect(pane.views.size).toBe(11)
    first()
    expect(pane.views.size).toBe(0)
  })

  it('fails closed without pane workbench but still exposes the probe', async () => {
    const ctx = new Context()
    const dispose = await apply(ctx as never)
    const face = ctx.get('dramaDirector') as Pick<DramaDirectorClientFace, 'probe'>
    expect(face.probe.paneWorkbench.available).toBe(false)
    expect(face.probe.available).toBe(false)
    dispose()
    expect(ctx.get('dramaDirector')).toBeUndefined()
  })

  it('registers views even when command-experience is missing, with a standard reason', async () => {
    const { ctx, pane, face } = setup()
    const dispose = await apply(ctx as never)
    expect(face().probe.commandExperience.available).toBe(false)
    expect(face().probe.commandExperience.reason).toContain('slash directory')
    // Pane views and pane-internal commands are unaffected.
    expect(pane.views.size).toBe(11)
    expect(pane.commands.size).toBe(14)
    dispose()
  })

  it('emits capability-ready and discovery evidence when all dependencies probe', async () => {
    const slashDirectory = { snapshot: () => ({}), subscribe: () => () => {} }
    const { ctx, records } = setup({}, { slashDirectory })
    const dispose = await apply(ctx as never)
    expect(records.some(record => record.kind === 'pack_installed' && record.reasonCategory === 'capability_ready')).toBe(true)
    expect(records.some(record => record.kind === 'command_opened' && record.reasonCategory === 'discovery')).toBe(true)
    dispose()
  })

  it('maps probe misses to per-command disabled entries with reasons', async () => {
    const ctx = new Context()
    const pane = fakePane()
    ctx.provide('paneWorkbench', pane)
    const dispose = await apply(ctx as never)
    const face = ctx.get('dramaDirector') as DramaDirectorClientFace

    const entries = face.commandEntries()
    const review = entries.find(entry => entry.id === 'drama.review')
    expect(review?.disabled).toBe(true)
    expect(review?.reason).toBe('missing drama owner projection')
    expect(entries.find(entry => entry.id === 'drama.help')?.disabled).toBe(false)
    expect(entries.find(entry => entry.id === 'drama.open')?.disabled).toBe(false)
    dispose()
  })

  it('applies the Director preset via the pane face and records first-open evidence', async () => {
    const { ctx, pane, records, face } = setup()
    const dispose = await apply(ctx as never)
    const result = face().applyPreset()
    expect(result?.applied).toEqual(['Context', 'Review', 'Run'])
    expect(pane.opens.map(call => call.kind)).toEqual(['drama.context', 'drama.review', 'drama.run', 'drama.context'])
    expect(records.some(record => record.kind === 'command_opened' && record.reasonCategory === 'first_open')).toBe(true)
    dispose()
  })

  it('opens the additive show-control preset and individual panes only when the owner remote probes', async () => {
    const { ctx, pane, face } = setup()
    ctx.provide('remote.dramaShowControl' as never, fakeShowControlRemote())
    const dispose = await apply(ctx as never)
    await flush()
    expect(face().probe.showControl.available).toBe(true)

    pane.opens.length = 0
    pane.commands.get('drama.show')?.execute()
    expect(pane.opens.map(call => call.kind)).toEqual(['drama.show-board', 'drama.review-inbox', 'drama.run', 'drama.delivery', 'drama.show-board'])
    pane.commands.get('drama.assets')?.execute()
    expect(pane.opens.at(-1)?.kind).toBe('drama.asset-wall')

    pane.opens.length = 0
    pane.commands.get('drama.open')?.execute()
    expect(pane.opens.map(call => call.kind)).toEqual(['drama.context', 'drama.review', 'drama.run', 'drama.context'])
    dispose()
  })

  it('dispatches a fresh-context mutation and records review completion evidence', async () => {
    const { ctx, pane, remote, records } = setup()
    const dispose = await apply(ctx as never)
    await flush()

    await pane.commands.get('drama.review')?.execute()
    await flush()
    expect(remote.dispatchCalls).toHaveLength(1)
    expect(remote.dispatchCalls[0]).toMatchObject({
      schema: 'drama.command-request.v1',
      command: 'review',
      selector: 'show:show:1',
      contextRevision: 'rev:1',
    })
    expect(records.some(record => record.kind === 'command_submitted' && record.reasonCategory === 'review')).toBe(true)
    dispose()
  })

  it('blocks mutations on a stale context and never auto-retries', async () => {
    const { ctx, pane, remote, records } = setup({ freshness: 'stale' })
    const dispose = await apply(ctx as never)
    await flush()

    await pane.commands.get('drama.review')?.execute()
    await flush()
    expect(remote.dispatchCalls).toHaveLength(0)
    expect(remote.snapshotCalls.length).toBe(1)
    expect(records.some(record => record.kind === 'command_reconcile' && record.reasonCategory === 'review')).toBe(true)
    dispose()
  })

  it('handles preset persistence receipts without blocking layout application', async () => {
    const deniedService = {
      create: async () => ({ status: 'permission_denied', action: 'create', reason: 'workspace scope is not permitted' }),
      update: async () => ({ status: 'permission_denied', action: 'update' }),
      delete: async () => ({ status: 'permission_denied', action: 'delete' }),
      reset: async () => ({ status: 'permission_denied', action: 'reset' }),
    }
    const { ctx, pane, face } = setup({}, { paneWorkspacePresets: deniedService })
    const dispose = await apply(ctx as never)

    const save = await face().savePresetVariant({ name: 'My Director', scope: 'workspace', draft: {} })
    expect(save.writeDisabled).toBe(true)
    expect(save.reason).toBe('workspace scope is not permitted')
    expect(save.receipt?.status).toBe('permission_denied')

    // The local layout application is untouched by the denied write.
    face().applyPreset()
    expect(pane.opens.length).toBe(4)
    dispose()
  })
})

describe('drama client handoff consumption', () => {
  function signedFor(intent: 'open_review' | 'open_show', nonce: string, expiresAt = Date.now() + 60_000): SignedWorkbenchHandoffV1 {
    const signed = createWorkbenchHandoff({
      contextRef: 'show:1',
      targetSurface: 'workbench',
      presentationIntent: intent,
      nonce,
      expiresAt,
    })
    if (signed === undefined) throw new Error('fixture failed to sign')
    return signed
  }

  it('consumes a valid handoff: gate, owner re-resolution, target view, evidence', async () => {
    const { ctx, pane, remote, records, face } = setup()
    const dispose = await apply(ctx as never)
    await flush()
    const snapshotsBefore = remote.snapshotCalls.length

    const result = await face().consumeHandoff(signedFor('open_review', 'nonce:e2e'))
    expect(result.ok).toBe(true)
    // The target re-resolves owner data instead of trusting the payload.
    expect(remote.snapshotCalls.length).toBeGreaterThan(snapshotsBefore)
    expect(pane.opens.some(call => call.kind === 'drama.review')).toBe(true)
    expect(records.some(record => record.kind === 'handoff_opened' && record.reasonCategory === 'open_review')).toBe(true)
    dispose()
  })

  it('rejects an expired handoff without opening anything', async () => {
    const { ctx, pane, records, face } = setup()
    const dispose = await apply(ctx as never)
    await flush()

    const result = await face().consumeHandoff(signedFor('open_review', 'nonce:old', Date.now() - 1))
    expect(result).toMatchObject({ ok: false, category: 'expired' })
    expect(pane.opens).toHaveLength(0)
    expect(records.some(record => record.kind === 'handoff_expired')).toBe(true)
    dispose()
  })

  it('rejects a replayed handoff on the second submission', async () => {
    const { ctx, pane, face } = setup()
    const dispose = await apply(ctx as never)
    await flush()
    const signed = signedFor('open_show', 'nonce:twice')

    expect((await face().consumeHandoff(signed)).ok).toBe(true)
    const replay = await face().consumeHandoff(signed)
    expect(replay).toMatchObject({ ok: false, category: 'nonce_replay' })
    expect(pane.opens.filter(call => call.kind === 'drama.context')).toHaveLength(1)
    dispose()
  })

  it('rejects a handoff whose target view is dependency-disabled', async () => {
    // No creator-studio projection: Review stays disabled.
    const ctx = new Context()
    const pane = fakePane()
    const remote = fakeRemote()
    ctx.provide('paneWorkbench', pane)
    ctx.provide('remote', { dramaDirector: remote.remote.dramaDirector })
    const records: DramaEvidenceRecordV1[] = []
    ctx.provide('dramaEvidenceSink', (record: DramaEvidenceRecordV1) => records.push(record))
    const dispose = await apply(ctx as never)
    await flush()
    const face = ctx.get('dramaDirector') as DramaDirectorClientFace

    const result = await face.consumeHandoff(signedFor('open_review', 'nonce:missing-target'))
    expect(result).toMatchObject({ ok: false, category: 'target_missing' })
    if (!result.ok) expect(result.reason).toContain('install')
    expect(pane.opens).toHaveLength(0)
    expect(records.some(record => record.kind === 'handoff_contract_mismatch' && record.reasonCategory === 'target_missing')).toBe(true)
    dispose()
  })

  it('keeps the legacy handoff command unavailable after retirement', async () => {
    const { ctx, pane, records } = setup()
    const dispose = await apply(ctx as never)
    await flush()
    await pane.commands.get('drama.handoff')?.execute()
    await flush()
    expect(records.some(record => record.kind === 'command_needs_contract' && record.reasonCategory === 'target_unavailable')).toBe(true)
    expect(records.some(record => record.kind === 'handoff_opened' && record.reasonCategory === 'legacy_bridge')).toBe(false)
    expect(records.some(record => record.kind === 'handoff_opened' && record.reasonCategory === 'bridge_v2')).toBe(false)
    const snapshot = (ctx.get('dramaDirector') as DramaDirectorClientFace)
    dispose()
    void snapshot
  })
})
