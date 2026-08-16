// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@deepseek-ai/dsh-client-runtime/client', () => import('./browser-runtime.mock.ts'))
vi.mock('@deepseek-ai/dsh-client-locale/client', () => import('./browser-runtime.mock.ts'))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => import('./browser-runtime.mock.ts'))

import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { apply, inject } from '../src/client/index.ts'

const contexts: Context[] = []

afterEach(async () => {
  await Promise.all(contexts.splice(0).map(ctx => ctx.fiber.dispose()))
})

async function bench() {
  const ctx = new Context()
  contexts.push(ctx)
  await ctx.plugin(SlotRegistry).await()
  ctx.provide('locale', new LocaleRuntime(ctx))
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  ctx.provide('remote.ordoAgentOps', {
    snapshot: vi.fn().mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
        snapshotRef: 'not-mounted',
        snapshotVersion: 0,
        generatedAt: '2026-08-14T00:00:00.000Z',
        state: 'needs_contract',
        freshness: 'offline',
        reasonCode: 'owner_read_contract_unavailable',
        source: 'owner-gated',
        safeMessage: 'owner projection is not mounted',
      },
    })
  })
  return { ctx, slots: ctx.get('slots') as SlotRegistry }
}

describe('@yeisme/dsh-ordo-agent-ops browser consolidation', () => {
  it('uses one slot contribution while multiple client rows coexist, then clears it after the final dispose', async () => {
    const { ctx, slots } = await bench()
    const first = await ctx.plugin({ inject: [...inject], apply })
    const second = await ctx.plugin({ inject: [...inject], apply })

    expect(slots.entries('sidebar.footer.action').filter(entry => entry.id === 'ordo-agent-ops')).toHaveLength(1)

    await first.dispose()
    expect(slots.entries('sidebar.footer.action').filter(entry => entry.id === 'ordo-agent-ops')).toHaveLength(1)
    await second.dispose()
    expect(slots.entries('sidebar.footer.action').filter(entry => entry.id === 'ordo-agent-ops')).toHaveLength(0)
  })
})
