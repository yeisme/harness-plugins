// @vitest-environment jsdom
import { Context, Service } from '@deepseek-ai/cordis'
import { useSyncExternalStore } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { makeTranslate, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { apply, inject } from '../src/client/index.ts'
import { OrdoAgentOpsPanel } from '../src/client/OrdoAgentOpsPanel.tsx'
import type { OrdoAgentOpsPanelFace } from '../src/client/slots.ts'
import type { OrdoAgentOpsSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import { zh } from '../src/client/locales.ts'

usePinnedBrowserLanguages('zh-CN')
afterEach(cleanup)

const snapshot: OrdoAgentOpsSnapshot = {
  schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
  snapshotRef: 'not-mounted' as OrdoAgentOpsSnapshot['snapshotRef'],
  snapshotVersion: 0,
  generatedAt: '2026-08-14T00:00:00.000Z',
  state: 'needs_contract',
  freshness: 'offline',
  reasonCode: 'owner_read_contract_unavailable',
  source: 'owner-gated',
  safeMessage: 'owner projection is not mounted',
}

const t = makeTranslate(zh, commonZh)
const neverHook = (() => { throw new Error('Agent Ops panel must not read global hooks') }) as never

async function bench() {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  class RemoteService extends Service {
    constructor(serviceCtx: Context) { super(serviceCtx, 'remote') }
  }
  new RemoteService(ctx)
  const snapshotRead = vi.fn().mockResolvedValue({ ok: true, value: snapshot } as const)
  ctx.provide('remote.ordoAgentOps', { snapshot: snapshotRead })
  return { ctx, slots: ctx.get('slots') as SlotRegistry, snapshotRead }
}

function declare(slots: SlotRegistry): () => void {
  return slots.register({ name: 'root', children: { 'sidebar.footer.action': { kind: 'list', scope: 'root' } } } as never, () => null)
}

describe('ui-ordo-agent-ops browser plugin', () => {
  it('declares only the services used by the panel', () => {
    expect(inject).toEqual(['slots', 'remote', 'remote.ordoAgentOps', 'locale'])
  })

  it('renders a truthful needs_contract panel and refreshes through the Remote', async () => {
    const b = await bench()
    declare(b.slots)
    const fiber = await b.ctx.plugin({ inject: [...inject], apply }).await()
    const entry = b.slots.entries('sidebar.footer.action')[0]!
    const face = (entry.inject as unknown as () => OrdoAgentOpsPanelFace)()
    const injected = {
      refresh: face.refresh,
      useState: <T,>(selector: (value: ReturnType<OrdoAgentOpsPanelFace['hooks']['state']['getSnapshot']>) => T): T =>
        useSyncExternalStore(callback => face.hooks.state.subscribe(callback), () => selector(face.hooks.state.getSnapshot())),
    }
    render(<OrdoAgentOpsPanel
      wide
      useSessions={neverHook}
      useWorkspaces={neverHook}
      {...injected}
      t={t}
    />)
    fireEvent.click(screen.getByRole('button', { name: zh['panel.aria'] }))
    await vi.waitFor(() => { expect(screen.getByText(zh['panel.needsContractDetail'])).toBeTruthy() })
    expect(screen.getByText('needs_contract')).toBeTruthy()
    expect(b.snapshotRead).toHaveBeenCalled()
    await fiber.dispose()
    await b.ctx.fiber.dispose()
  })
})
