import { describe, expect, it } from 'vitest'
import {
  contextRevisionMatches,
  createWorkbenchHandoff,
  handleDramaCommand,
  isDramaMutation,
  parseDramaSelector,
  recordDramaEvidence,
  resolveCurrentDramaContext,
  shouldResyncContext,
  shouldRetryUnknownDramaResult,
  verifyWorkbenchHandoff,
  DramaEventSession,
  type DramaActionDescriptorV1,
  type DramaContextV1,
} from '../src/index.js'

const freshContext = (overrides: Partial<DramaContextV1> = {}): DramaContextV1 => ({
  schema: 'drama.context.v1',
  workspaceRef: 'ws:alpha',
  projectRef: 'proj:show',
  showRef: 'show:1',
  episodeRef: 'ep:2',
  ownerVersions: { auctra: 'v1' },
  contextRevision: 'rev-3',
  freshness: 'fresh',
  ...overrides,
})

const request = (command: string, selector = 'episode:ep-2', contextRevision = 'rev-3') => ({
  schema: 'drama.command-request.v1',
  command,
  selector,
  contextRevision,
})

const descriptor = (overrides: Partial<DramaActionDescriptorV1> = {}): DramaActionDescriptorV1 => ({
  descriptorRef: 'desc:review-1',
  command: 'review',
  targetRef: 'episode:ep-2',
  contextRevision: 'rev-3',
  expiresAt: 1_800_000_000_000,
  idempotencyKey: 'idem-1',
  ...overrides,
})

describe('current context and selectors', () => {
  it('parses kind:ref selectors and rejects argv, paths, and ambiguity', () => {
    expect(parseDramaSelector('episode:ep-2')).toMatchObject({ ok: true, kind: 'episode', ref: 'episode:ep-2' })
    expect(parseDramaSelector('next-review')).toMatchObject({ ok: true, kind: 'next-review' })
    expect(parseDramaSelector('rm --force')).toMatchObject({ ok: false })
    expect(parseDramaSelector('/etc/passwd')).toMatchObject({ ok: false })
    expect(parseDramaSelector('ep-2')).toMatchObject({ ok: false, ambiguous: true })
  })

  it('resolves a validated owner snapshot and fails closed without an owner', async () => {
    await expect(resolveCurrentDramaContext(undefined)).resolves.toMatchObject({
      ok: false,
      reason: 'drama context owner is not mounted',
    })
    await expect(resolveCurrentDramaContext({
      snapshot: async () => freshContext(),
    })).resolves.toMatchObject({ ok: true, context: freshContext() })
    await expect(resolveCurrentDramaContext({
      snapshot: async () => ({ schema: 'drama.context.v1', workspaceRef: '/etc/passwd' }),
    })).resolves.toMatchObject({ ok: false })
  })

  it('detects context revision drift and stale freshness', () => {
    const current = freshContext()
    expect(contextRevisionMatches(current, 'rev-3')).toBe(true)
    expect(contextRevisionMatches(current, 'rev-4')).toBe(false)
    expect(shouldResyncContext(current, freshContext({ contextRevision: 'rev-4' }))).toBe(true)
    expect(shouldResyncContext(current, freshContext({ freshness: 'gap' }))).toBe(true)
    expect(shouldResyncContext(current, freshContext())).toBe(false)
  })
})

describe('typed /drama handlers', () => {
  it('opens read commands from the current context', async () => {
    const result = await handleDramaCommand(request('open'), {
      owner: { snapshot: async () => freshContext() },
    })
    expect(result).toEqual({
      kind: 'opened',
      reason: 'open opened from current context',
      retried: false,
    })
    expect(isDramaMutation('open')).toBe(false)
    expect(isDramaMutation('review')).toBe(true)
  })

  it('revalidates a server-authored descriptor before one-shot dispatch', async () => {
    const result = await handleDramaCommand(request('review', 'next-review'), {
      owner: { snapshot: async () => freshContext() },
      now: () => 1_700_000_000_000,
      readDescriptor: async () => descriptor(),
      dispatch: async () => 'submitted',
    })
    expect(result).toEqual({ kind: 'submitted', reason: 'review submitted once', retried: false })
  })

  it('returns reconcile on drift, expiry, or stale freshness and never auto-retries unknown', async () => {
    const drifted = await handleDramaCommand(request('review', 'next-review', 'rev-old'), {
      owner: { snapshot: async () => freshContext() },
    })
    expect(drifted.kind).toBe('reconcile_required')

    const expired = await handleDramaCommand(request('review', 'next-review'), {
      owner: { snapshot: async () => freshContext() },
      now: () => 1_900_000_000_000,
      readDescriptor: async () => descriptor({ expiresAt: 1_800_000_000_000 }),
    })
    expect(expired.kind).toBe('reconcile_required')

    const stale = await handleDramaCommand(request('review', 'next-review'), {
      owner: { snapshot: async () => freshContext({ freshness: 'stale' }) },
    })
    expect(stale.kind).toBe('reconcile_required')

    const unknown = await handleDramaCommand(request('review', 'next-review'), {
      owner: { snapshot: async () => freshContext() },
      now: () => 1_700_000_000_000,
      readDescriptor: async () => descriptor(),
      dispatch: async () => 'unknown',
    })
    expect(unknown).toMatchObject({ kind: 'unknown', retried: false })
    expect(shouldRetryUnknownDramaResult()).toBe(false)
  })

  it('keeps mutations fail-closed without a descriptor or dispatch settlement', async () => {
    const missing = await handleDramaCommand(request('generate', 'episode:ep-2'), {
      owner: { snapshot: async () => freshContext() },
    })
    expect(missing.kind).toBe('needs_contract')

    const noDispatch = await handleDramaCommand(request('generate', 'episode:ep-2'), {
      owner: { snapshot: async () => freshContext() },
      now: () => 1_700_000_000_000,
      readDescriptor: async () => descriptor({ command: 'generate' }),
    })
    expect(noDispatch.kind).toBe('unknown')
    expect(noDispatch.retried).toBe(false)
  })
})

describe('snapshot + push event session', () => {
  it('applies in-order events and ignores duplicates without polling', () => {
    const session = new DramaEventSession()
    expect(session.usesPolling()).toBe(false)
    expect(session.applySnapshot(freshContext(), 4)).toMatchObject({
      listening: true,
      lastSequence: 4,
      paused: false,
    })
    expect(session.applyEvent({
      sequence: 5,
      kind: 'updated',
      contextRevision: 'rev-3',
    })).toMatchObject({ lastSequence: 5, paused: false, reason: 'event applied' })
    expect(session.applyEvent({
      sequence: 5,
      kind: 'updated',
      contextRevision: 'rev-3',
    }).reason).toBe('duplicate event ignored')
    expect(session.getSnapshot().listening).toBe(true)
  })

  it('pauses mutation on gap or context revision change and tears down the listener', () => {
    const session = new DramaEventSession()
    let tornDown = false
    session.applySnapshot(freshContext(), 1)
    session.attach(() => {
      tornDown = true
    })
    const gap = session.applyEvent({ sequence: 4, kind: 'updated', contextRevision: 'rev-3' })
    expect(gap).toMatchObject({ paused: true, listening: false, reason: 'event gap; resync snapshot' })
    expect(tornDown).toBe(true)

    const revision = new DramaEventSession()
    revision.applySnapshot(freshContext(), 1)
    expect(revision.applyEvent({
      sequence: 2,
      kind: 'updated',
      contextRevision: 'rev-9',
    })).toMatchObject({ paused: true, reason: 'context revision changed; resync snapshot' })
  })
})

describe('Workbench handoff signer/validator', () => {
  it('signs refs-only handoff and rejects expiry or digest tampering', () => {
    const signed = createWorkbenchHandoff({
      contextRef: 'ctx:1',
      targetSurface: 'workbench.review',
      presentationIntent: 'open_review',
      nonce: 'nonce-1',
      expiresAt: 1_800_000_000_000,
      artifactRef: 'art:scene-1',
    })
    expect(signed).toBeDefined()
    expect(verifyWorkbenchHandoff(signed!, 1_700_000_000_000)).toEqual({ ok: true })
    expect(verifyWorkbenchHandoff(signed!, 1_900_000_000_000).ok).toBe(false)
    expect(verifyWorkbenchHandoff({
      handoff: signed!.handoff,
      digest: 'tampered',
    }, 1_700_000_000_000).ok).toBe(false)
  })

  it('refuses unsafe refs and records only redacted evidence categories', () => {
    expect(createWorkbenchHandoff({
      contextRef: '/etc/passwd',
      targetSurface: 'workbench.review',
      presentationIntent: 'open_review',
      nonce: 'nonce-1',
      expiresAt: 1_800_000_000_000,
    })).toBeUndefined()
    expect(recordDramaEvidence({ kind: 'handoff_opened', reasonCategory: 'opened' })).toMatchObject({
      schema: 'drama.evidence.v1',
      kind: 'handoff_opened',
    })
    expect(recordDramaEvidence({
      kind: 'command_submitted',
      reasonCategory: 'https://secret.example/token',
    })).toBeUndefined()
  })

  describe('DSH -> Workbench handoff integration', () => {
    it('creates and validates local handoff without external Workbench', () => {
      const handoff = createWorkbenchHandoff({
        contextRef: 'ctx:drama-1',
        targetSurface: 'workbench.review',
        presentationIntent: 'open_review',
        nonce: 'nonce-local-1',
        expiresAt: Date.now() + 300_000, // 5 minutes
        artifactRef: 'art:scene-42',
      })

      expect(handoff).toBeDefined()
      expect(handoff?.handoff).toMatchObject({
        contextRef: 'ctx:drama-1',
        targetSurface: 'workbench.review',
        presentationIntent: 'open_review',
      })
      expect(handoff?.handoff.artifactRef).toBe('art:scene-42')
    })

    it('validates handoff integrity and rejects tampered payloads', () => {
      const valid = createWorkbenchHandoff({
        contextRef: 'ctx:review-1',
        targetSurface: 'workbench.review',
        presentationIntent: 'open_review',
        nonce: 'nonce-integrity-1',
        expiresAt: Date.now() + 300_000,
      })

      expect(valid).toBeDefined()
      expect(verifyWorkbenchHandoff(valid!, Date.now())).toEqual({ ok: true })

      // Tamper with digest
      const tampered = { handoff: valid!.handoff, digest: 'tampered-digest' }
      expect(verifyWorkbenchHandoff(tampered, Date.now()).ok).toBe(false)
    })

    it('rejects expired handoffs without retry', () => {
      const expired = createWorkbenchHandoff({
        contextRef: 'ctx:expired-1',
        targetSurface: 'workbench.review',
        presentationIntent: 'open_review',
        nonce: 'nonce-expired-1',
        expiresAt: Date.now() - 1000, // expired 1 second ago
      })

      expect(expired).toBeDefined()
      expect(verifyWorkbenchHandoff(expired!, Date.now()).ok).toBe(false)
    })

    it('supports multiple handoff intents with different surface targets', () => {
      const intents = [
        'open_show',
        'open_episode',
        'open_review',
        'open_artifact',
        'open_evidence',
      ] as const

      for (const intent of intents) {
        const handoff = createWorkbenchHandoff({
          contextRef: 'ctx:intent-test',
          targetSurface: 'workbench.review',
          presentationIntent: intent,
          nonce: `nonce-${intent}`,
          expiresAt: Date.now() + 300_000,
        })

        expect(handoff).toBeDefined()
        expect(handoff?.handoff.presentationIntent).toBe(intent)
      }
    })
  })
})
