// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { CreatorStudioController } from '../src/controller.ts'
import { createCreatorStudioTranslator, en, pseudoLong, pseudoRtl } from '../src/locales.ts'
import { CREATOR_LIFECYCLE_GROUPS, CreatorStudioView } from '../src/views.tsx'
import { creatorSnapshot } from './fixtures.ts'

afterEach(cleanup)

async function readyController(): Promise<CreatorStudioController> {
  const controller = new CreatorStudioController({
    snapshot: async () => ({ ok: true, value: creatorSnapshot() }),
    dispatch: async () => ({ ok: true, value: { status: 'accepted', receiptRef: 'receipt:one' } }),
    resolveArtifact: async () => ({ ok: true, value: null }),
    assets: async query => ({ ok: true, value: {
      schemaVersion: 'creator.asset.page.v1alpha1', scope: query.scope, status: 'ready', freshness: 'fresh', reasonCode: 'asset_page', safeMessage: 'Assets ready.',
      items: [{ owner: 'eikona', projectRef: query.scope === 'current_project' ? 'project:one' : 'project:two', ref: `image:${query.scope}`, version: '1', kind: 'image', title: `Asset ${query.scope}`, status: 'ready', evidenceRefs: [] }], unavailableOwners: [],
    } }),
    decideApproval: async () => ({ ok: true, value: { status: 'accepted', receiptRef: 'receipt:approval:one', owner: 'ordo', actionId: 'ordo.approval.decide', summary: 'Approved.' } }),
  })
  await controller.refresh()
  return controller
}

describe('Creator Studio task views', () => {
  it('renders the lifecycle, next action, owner disclosure, Production, and review priority', async () => {
    const controller = await readyController()
    const onOpenMode = vi.fn()
    const onOpenDrama = vi.fn()
    const onOpenShowControl = vi.fn()
    render(<CreatorStudioView mode="home" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={onOpenMode} onOpenDrama={onOpenDrama} onOpenShowControl={onOpenShowControl} />)
    expect(screen.getByRole('heading', { name: '下一动作' })).toBeTruthy()
    expect(CREATOR_LIFECYCLE_GROUPS.map(group => group.id)).toEqual(['start', 'create', 'produce', 'review', 'library'])
    expect(document.querySelectorAll('[data-lifecycle]')).toHaveLength(5)
    expect(screen.getByText('雨夜来客')).toBeTruthy()
    expect(document.querySelectorAll('.cs-owner-row')).toHaveLength(6)
    expect(document.querySelector('[data-owner-status-panel]')).toBeTruthy()
    expect(document.querySelector('.cs-owner-grid')).toBeNull()
    const sections = [...document.querySelectorAll('[data-creator-home] > *')]
    expect(sections[0]?.textContent).toContain('下一动作')
    expect(sections[1]?.getAttribute('data-production')).toBeTruthy()
    expect(sections[2]?.hasAttribute('data-review-list')).toBe(true)
    const quickImage = [...document.querySelectorAll<HTMLButtonElement>('.cs-quick-card')].find(button => button.textContent?.includes('图像'))
    expect(quickImage).toBeTruthy()
    fireEvent.click(quickImage!)
    expect(onOpenMode).toHaveBeenCalledWith('visual')
    const drama = [...document.querySelectorAll<HTMLButtonElement>('.cs-quick-card')].find(button => button.textContent?.includes('完整做剧'))
    fireEvent.click(drama!)
    expect(onOpenDrama).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByRole('button', { name: /全剧控制台/ }))
    expect(onOpenShowControl).toHaveBeenCalledOnce()
  })

  it('keeps the show-control entry visible but disabled when its owner projection is missing', async () => {
    const controller = await readyController()
    render(<CreatorStudioView mode="home" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    const entry = screen.getByRole('button', { name: /全剧控制台/ }) as HTMLButtonElement
    expect(entry.disabled).toBe(true)
    expect(entry.title).toContain('尚未安装')
  })

  it('keeps legacy aliases canonical in the lifecycle and localizes zh/en/pseudo copy', async () => {
    const controller = await readyController()
    render(<CreatorStudioView mode="jobs" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} t={createCreatorStudioTranslator('en')} />)
    expect(screen.getByText('Generation (legacy)')).toBeTruthy()
    expect(document.querySelector('[data-lifecycle="produce"] [data-active="true"]')).toBeTruthy()
    expect(en['state.retry']).toBe('Retry')
    expect(pseudoLong['state.retry']).not.toBe(en['state.retry'])
    expect(pseudoRtl['state.retry']).toContain('RTL')
  })

  it('renders Sonora waveform and owner-gated action composer', async () => {
    const controller = await readyController()
    render(<CreatorStudioView mode="audio" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    expect(screen.getByText('主角对白 Take 1')).toBeTruthy()
    expect(document.querySelector('.cs-waveform')).toBeTruthy()
    expect(document.querySelector('[data-action-composer="sonora.create"]')).toBeTruthy()
  })

  it('renders project assets, independent generation and actionable approvals', async () => {
    const controller = await readyController()
    const pane = { openView: vi.fn() }
    const { unmount } = render(<CreatorStudioView mode="assets" controller={controller} pane={pane} onOpenMode={vi.fn()} />)
    expect(await screen.findByText('Asset current_project')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '全部项目' }))
    expect(await screen.findByText('Asset all_projects')).toBeTruthy()
    unmount()

    const generation = render(<CreatorStudioView mode="generation" controller={controller} pane={pane} onOpenMode={vi.fn()} />)
    expect(screen.getByText('生成当前镜头')).toBeTruthy()
    generation.unmount()

    render(<CreatorStudioView mode="approvals" controller={controller} pane={pane} onOpenMode={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '批准' }))
    expect(await screen.findByText('Approved.')).toBeTruthy()
  })

  it('keeps legacy review and jobs view kinds renderable', async () => {
    const controller = await readyController()
    const jobs = render(<CreatorStudioView mode="jobs" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    expect(document.querySelector('[data-creator-generation][data-legacy="true"]')).toBeTruthy()
    jobs.unmount()
    render(<CreatorStudioView mode="review" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    expect(document.querySelector('[data-creator-approvals][data-legacy="true"]')).toBeTruthy()
  })

  it('renders cold, loading, error, retained-safe-content, and partial owner states', async () => {
    const controller = new CreatorStudioController({
      snapshot: async () => ({ ok: true, value: creatorSnapshot() }),
      dispatch: async () => ({ ok: true, value: { status: 'accepted', receiptRef: 'receipt:one' } }),
      resolveArtifact: async () => ({ ok: true, value: null }),
    })
    const view = render(<CreatorStudioView mode="home" controller={controller} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    expect(screen.getByText('Creator Studio 尚未读取。')).toBeTruthy()
    act(() => controller.store.set({ ...controller.store.getSnapshot(), phase: 'loading' }))
    expect(screen.getByText('正在读取 Creator Studio owner 投影…')).toBeTruthy()
    act(() => controller.store.set({ ...controller.store.getSnapshot(), phase: 'error', errorCode: 'host_unavailable' }))
    expect(screen.getByRole('alert')).toBeTruthy()

    await act(async () => { await controller.refresh() })
    expect(screen.getByText('雨夜来客')).toBeTruthy()
    act(() => controller.store.set({ ...controller.store.getSnapshot(), phase: 'error', errorCode: 'transport_uncertain' }))
    expect(screen.getByText('雨夜来客')).toBeTruthy()
    expect(document.querySelector('.cs-state-strip[data-phase="stale"]')).toBeTruthy()
    view.unmount()

    const partial = await readyController()
    const current = partial.store.getSnapshot()
    const snapshot = current.snapshot!
    act(() => partial.store.set({ ...current, snapshot: { ...snapshot, owners: snapshot.owners.map(owner => owner.owner === 'eikona' ? { ...owner, status: 'partial', freshness: 'stale', summary: 'Eikona projection is partial.' } : owner) } }))
    render(<CreatorStudioView mode="visual" controller={partial} pane={{ openView: vi.fn() }} onOpenMode={vi.fn()} />)
    expect(screen.getAllByText('Eikona projection is partial.')).toHaveLength(2)
    expect(document.querySelector('.ys-state[data-phase="stale"]')).toBeTruthy()
  })
})
