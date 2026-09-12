import { Context } from '@deepseek-ai/cordis'
import { createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { PANE_ACTION_REQUEST_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { CreatorStudioOwnerDirectory } from '../src/directory.ts'
import { CreatorStudioGateway, CREATOR_STUDIO_EXPECTED_CONTEXT, CREATOR_STUDIO_OWNER_DIRECTORY } from '../src/gateway.ts'
import { SonoraSubtitleExportClient } from '../src/sonora-subtitle-export.ts'
import { createSonoraSubtitleExportAdapter } from '../src/sonora-subtitle-adapter.ts'
import type { CreatorStudioContextV1 } from '../src/types.ts'

const context: CreatorStudioContextV1 = { tenantRef: 'tenant:test', workspaceRef: 'workspace:test', projectRef: 'project:test', sessionRef: 'session:test',
  principalRef: 'principal:test', membershipRevision: '1', installationRef: 'installation:test', pluginDigest: 'digest:test', policyRevision: '1', runtimeGeneration: '1', revision: '1' }
const track = { ref: 'sonora://subtitle-track/test', track_digest: 'track-digest', review_digest: 'review-digest', readability_status: 'ok', decision_code: 'approved', cue_count: 1, updated_at: '2026-09-08T00:00:00Z', cues: [{ text: 'private-cue-sentinel' }] }
const subtitleContent = '1\n00:00:00,000 --> 00:00:02,000\nFixture subtitle.\n'
const exported = { schema: 'sonora.subtitle_export.v1', ref: 'sonora://subtitle-export/test', track_ref: track.ref, track_digest: track.track_digest, review_digest: track.review_digest,
  format: 'srt', media_type: 'application/x-subrip', content_digest: createHash('sha256').update(subtitleContent).digest('hex'), size_bytes: new TextEncoder().encode(subtitleContent).byteLength, created_at: '2026-09-08T00:00:00Z' }
const contexts: Context[] = []
afterEach(async () => { for (const ctx of contexts.splice(0)) await ctx.fiber.dispose() })

async function setup() {
  let source = { ...track }
  let loseResponse = false
  let saved = false
  let catalogRead = async (): Promise<Response> => Response.json({ validation_level: 'capability_probe', profiles: [], diagnostics_available: true })
  const fetcher = vi.fn<typeof fetch>(async (url, options) => {
    const path = new URL(String(url)).pathname
    if (path === '/api/v1/transcription-providers') return catalogRead()
    if (path.startsWith('/api/v1/subtitle-tracks/')) return Response.json(source)
    if (options?.method === 'POST') {
      saved = true
      if (loseResponse) throw new Error('fixture response lost')
      return Response.json(exported, { status: 201 })
    }
    if (path.endsWith('/by-idempotency-key') && saved) return Response.json(exported)
    if (path === '/api/v1/subtitle-exports/test' && saved) return Response.json(exported)
    if (path === '/api/v1/subtitle-exports/test/content' && saved) return new Response(subtitleContent, { headers: { 'Content-Type': 'application/x-subrip; charset=utf-8' } })
    return new Response('', { status: 404 })
  })
  const client = new SonoraSubtitleExportClient(async scope => ({ context: scope, baseURL: 'http://127.0.0.1:8740', headers: {} }), fetcher)
  const selected = vi.fn(async () => track.ref)
  const adapter = createSonoraSubtitleExportAdapter(client, selected)
  const ctx = new Context()
  contexts.push(ctx)
  const directory = new CreatorStudioOwnerDirectory()
  directory.register(adapter)
  const providedContext = { ...context }
  ctx.provide(CREATOR_STUDIO_EXPECTED_CONTEXT, providedContext)
  ctx.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
  await ctx.plugin(CreatorStudioGateway)
  const gateway = ctx.get('creatorStudio') as CreatorStudioGateway
  const snapshot = await gateway.snapshot()
  const owner = snapshot.owners.find(item => item.owner === 'sonora')!
  const action = owner.actions[0]!
  const request = { schema: PANE_ACTION_REQUEST_SCHEMA, owner: 'sonora', actionId: 'subtitle.export', descriptorRef: action?.descriptorRef,
    expectedTargetRef: track.ref, expectedTargetVersion: track.track_digest, context, idempotencyKey: 'export-original-key', values: { format: 'srt' } }
  return { gateway, owner, request, fetcher, selected, adapter, ctx, providedContext,
    setCatalogRead: (read: () => Promise<Response>) => { catalogRead = read },
    changeTrack: (patch: Partial<typeof track>) => { source = { ...source, ...patch } },
    loseResponse: () => { loseResponse = true } }
}

it('reads the catalog independently while an export remains executable', async () => {
  const h = await setup()
  expect(await h.gateway.readTranscriptionCatalog({ ...context, projectRef: 'project:other' })).toBeNull()
  expect(h.fetcher.mock.calls.some(([url]) => String(url).endsWith('/transcription-providers'))).toBe(false)
  let resolve!: (response: Response) => void
  const waiting = new Promise<Response>(done => { resolve = done })
  h.setCatalogRead(() => waiting)
  const pending = h.gateway.readTranscriptionCatalog(context)
  await vi.waitFor(() => expect(h.fetcher.mock.calls.some(([url]) => String(url).endsWith('/transcription-providers'))).toBe(true))
  let result
  try { result = await h.gateway.dispatch(h.request) }
  finally { resolve(Response.json({ validation_level: 'capability_probe', profiles: [], diagnostics_available: true })) }
  expect(result?.status).toBe('completed')
  expect(await pending).toEqual({ validation_level: 'capability_probe', profiles: [], diagnostics_available: true })
})

it('discards a catalog response after the membership changes', async () => {
  const h = await setup()
  let resolve!: (response: Response) => void
  h.setCatalogRead(() => new Promise(done => { resolve = done }))
  const pending = h.gateway.readTranscriptionCatalog()
  await vi.waitFor(() => expect(resolve).toBeTypeOf('function'))
  h.providedContext.membershipRevision = '2'
  resolve(Response.json({ validation_level: 'capability_probe', profiles: [] }))
  expect(await pending).toBeNull()
})

it('registers an owner-derived export action and returns a fixed-version artifact receipt', async () => {
  const h = await setup()
  expect(h.owner.status).toBe('ready')
  expect(h.owner.actions).toHaveLength(1)
  expect(h.owner.actions[0]).toMatchObject({ confirmation: 'confirm', targetVersion: track.track_digest, preview: { cost: { amount: 0, estimate: false } } })
  expect(JSON.stringify(h.owner)).not.toContain('private-cue-sentinel')
  const result = await h.gateway.dispatch(h.request)
  expect(result).toMatchObject({ owner: 'sonora', actionId: 'subtitle.export', status: 'completed', receiptRef: exported.ref,
    outputArtifacts: [{ ref: exported.ref, version: exported.content_digest, mediaType: exported.media_type }] })
  const posts = h.fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')
  expect(posts).toHaveLength(1)
  expect(JSON.parse(posts[0]![1]!.body as string)).toEqual({ track_ref: track.ref, track_digest: track.track_digest, review_digest: track.review_digest, format: 'srt' })
  const artifact = result.outputArtifacts![0]!
  expect(await h.gateway.readArtifactContent(artifact)).toMatchObject({ content: subtitleContent, contentRevision: exported.content_digest })
  expect(await h.gateway.readArtifactContent({ ...artifact, version: 'wrong-version' })).toBeNull()
  expect(JSON.stringify(await h.gateway.snapshot())).not.toContain('Fixture subtitle.')
  expect(h.fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('recovers the original receipt after the selected track changes without another POST or preview', async () => {
  const h = await setup()
  h.loseResponse()
  expect((await h.gateway.dispatch(h.request)).status).toBe('unknown')
  h.changeTrack({ track_digest: 'new-version', review_digest: 'new-review' })
  const reads = h.selected.mock.calls.length
  const result = await h.gateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'sonora', actionId: 'subtitle.export',
    expectedTargetRef: track.ref, context, idempotencyKey: h.request.idempotencyKey })
  expect(result).toMatchObject({ status: 'completed', receiptRef: exported.ref })
  expect(h.selected).toHaveBeenCalledTimes(reads)
  expect(h.fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(1)
})

it('rejects changed review or cross-project requests before creating exports', async () => {
  const h = await setup()
  h.changeTrack({ review_digest: 'new-review' })
  expect((await h.gateway.dispatch(h.request)).status).toBe('reconcile_required')
  expect((await h.gateway.dispatch({ ...h.request, context: { ...context, projectRef: 'project:other' } })).status).toBe('reconcile_required')
  expect(h.fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
})

it('does not publish an export action for blocked tracks or settle an unobserved key', async () => {
  const h = await setup()
  h.changeTrack({ readability_status: 'blocked', decision_code: 'blocked' })
  const snapshot = await h.adapter.snapshot(context)
  expect(snapshot.status).toBe('attention_required')
  expect(snapshot.actions).toEqual([])
  const result = await h.gateway.reconcile({ schema: 'pane.action-reconcile-request.v1alpha1', owner: 'sonora', actionId: 'subtitle.export',
    expectedTargetRef: track.ref, context, idempotencyKey: 'unobserved-key' })
  expect(result.status).toBe('unknown')
  expect(h.fetcher.mock.calls.filter(([, options]) => options?.method === 'POST')).toHaveLength(0)
})
