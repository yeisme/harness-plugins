import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

test('bundle patch inserts pane-domain', () => {
  const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  assert.match(patch, /id: pane-domain/)
  assert.match(patch, /@yeisme\/dsh-pane-domain/)
})

test('bundle ships a dual-face contract: browser client and host owner-source mount', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  assert.ok(pkg.exports['./client'], 'browser client entry')
  assert.ok(pkg.exports['./host'], 'host owner-source entry')
  assert.equal(pkg.exports['.'], './index.mjs')
  const entry = readFileSync(join(root, 'index.mjs'), 'utf8')
  assert.match(entry, /lib\/host\.js/, 'root entry wires the host face')
  assert.ok(pkg.files.includes('lib/host.js'), 'host build artifact is published')
})

test('built host entry mounts domain.<owner> owner sources when transports are injected', async (t) => {
  const hostPath = join(root, 'lib/host.js')
  if (!existsSync(hostPath)) {
    t.skip('lib/host.js not built yet; run pnpm --filter @yeisme/dsh-pane-domain run build')
    return
  }
  const { Context } = await import('@deepseek-ai/cordis')
  const host = (await import(hostPath)).default
  const { sonoraSnapshotRead } = await import('@yeisme/dsh-client-ui-pane-domain/host')
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose() })
  const context = { workspaceRef: 'workspace:demo', revision: '1' }
  ctx.provide('domainOwnerTransport.sonora', {
    read: () => sonoraSnapshotRead({ takes: [{ resourceRef: 'take:1', title: 'Take one', lane: 'ready' }], freshness: 'fresh', rightsPreview: true, costPreview: true }, context),
    subscribe: () => () => {},
  })
  const dispose = host.apply(ctx)
  const service = ctx.get('domain.sonora')
  assert.ok(service, 'domain.sonora mounted')
  assert.equal(service.getSnapshot().status, 'ready')
  assert.deepEqual(service.getSnapshot().allowedActions.map(action => action.id), ['render.take', 'review.accept'])
  dispose()
  assert.equal(ctx.get('domain.sonora'), undefined, 'owner source unmounted on dispose')
})

test('host face never fakes an owner source when no transport is injected', async (t) => {
  const hostPath = join(root, 'lib/host.js')
  if (!existsSync(hostPath)) {
    t.skip('lib/host.js not built yet; run pnpm --filter @yeisme/dsh-pane-domain run build')
    return
  }
  const { Context } = await import('@deepseek-ai/cordis')
  const host = (await import(hostPath)).default
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose() })
  const dispose = host.apply(ctx)
  assert.equal(ctx.get('domain.sonora'), undefined)
  assert.equal(ctx.get('domain.pinax'), undefined)
  dispose()
})

test('built host entry mounts domain.auctra and domain.eikona owner sources when transports are injected', async (t) => {
  const hostPath = join(root, 'lib/host.js')
  if (!existsSync(hostPath)) {
    t.skip('lib/host.js not built yet; run pnpm --filter @yeisme/dsh-pane-domain run build')
    return
  }
  const { Context } = await import('@deepseek-ai/cordis')
  const host = (await import(hostPath)).default
  const { auctraSnapshotRead, eikonaSnapshotRead } = await import('@yeisme/dsh-client-ui-pane-domain/host')
  const ctx = new Context()
  t.after(async () => { await ctx.fiber.dispose() })
  const context = { workspaceRef: 'workspace:demo', revision: '5' }
  ctx.provide('domainOwnerTransport.auctra', {
    read: () => auctraSnapshotRead({
      reviews: [{ ref: 'review:1', title: 'Pending scene', status: 'pending' }],
      pulse: { blocked: 0, reviewPending: 1, drafting: 0, staleVariants: 0, exportReady: 0 },
    }, context),
    subscribe: () => () => {},
  })
  ctx.provide('domainOwnerTransport.eikona', {
    read: () => eikonaSnapshotRead({
      cards: [{ ref: 'artifact:eikona:1', title: 'Image one', category: 'image', lifecycleState: 'accepted', revision: '1' }],
      freshness: 'current',
    }, context),
    subscribe: () => () => {},
  })
  const dispose = host.apply(ctx)
  const auctra = ctx.get('domain.auctra')
  assert.ok(auctra, 'domain.auctra mounted')
  assert.equal(auctra.getSnapshot().status, 'approval_required')
  assert.deepEqual(auctra.getSnapshot().allowedActions.map(action => action.id), ['candidate.create', 'review.accept', 'review.partial'])
  const eikona = ctx.get('domain.eikona')
  assert.ok(eikona, 'domain.eikona mounted')
  assert.equal(eikona.getSnapshot().status, 'ready')
  assert.equal(eikona.getSnapshot().modelRef, 'openai/gpt-5.4-image-2')
  dispose()
  assert.equal(ctx.get('domain.auctra'), undefined, 'auctra owner source unmounted on dispose')
  assert.equal(ctx.get('domain.eikona'), undefined, 'eikona owner source unmounted on dispose')
})
