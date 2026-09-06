// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionInsightsPanel, type SessionInsightsTrajectorySeam } from '../src/client/insights-panel.tsx'
import type { SessionInsightsBindingState } from '../src/client/insights-binding.ts'
import { SESSION_DIRECTORY_PAGE_SIZE, type SessionDirectoryEntryV1, type SessionDirectoryProbe } from '../src/client/session-directory.ts'
import { en, type TokenUsageTranslator } from '../src/client/locales.ts'
import type { TokenBalanceSlice } from '../src/client/controller.ts'
import { SESSION_INSIGHTS_SCHEMA_VERSION, type SessionInsightsSnapshotV1 } from '../src/wire.ts'

afterEach(cleanup)

const t: TokenUsageTranslator = key => en[key]

function snapshot(overrides: Partial<SessionInsightsSnapshotV1> = {}): SessionInsightsSnapshotV1 {
  return {
    schemaVersion: SESSION_INSIGHTS_SCHEMA_VERSION,
    sessionRef: 'sess_a',
    scope: 'session',
    revision: 4,
    generatedAt: '2026-09-05T08:00:00.000Z',
    freshness: 'fresh',
    coverage: { status: 'complete', knownRequests: 2 },
    source: { history: 'session_query', context: 'session_projections', cost: 'provider_settled' },
    totals: {
      buckets: { uncachedInputTokens: 6400, outputTokens: 1200, cacheReadTokens: 300, cacheWriteTokens: null },
      requestCount: 2,
      sumRequestDurationMs: 1500,
      wallClockMs: 900,
      cost: [{ kind: 'settled', amount: '0.0123', currency: 'CNY' }],
    },
    context: { status: 'available', used: 1200, limit: 10000, remaining: 8800 },
    byModel: {
      rows: [{ key: 'deepseek-chat', label: 'deepseek-chat', requestCount: 2, buckets: { uncachedInputTokens: 6400, outputTokens: 1200, cacheReadTokens: 300, cacheWriteTokens: null } }],
      truncated: true,
    },
    byProvider: {
      rows: [{ key: 'deepseek-official', label: 'deepseek-official', requestCount: 2, buckets: { uncachedInputTokens: 6400, outputTokens: 1200, cacheReadTokens: 300, cacheWriteTokens: null } }],
      truncated: false,
    },
    requests: [
      { attemptRef: 'att_1', requestRef: 'req_1', runRef: 'run_1', sessionRef: 'sess_a', eventRef: 'evt_1', happenedAt: '2026-09-05T07:59:00.000Z', buckets: { uncachedInputTokens: 3200, outputTokens: 600, cacheReadTokens: 300, cacheWriteTokens: null }, model: 'deepseek-chat', status: 'completed' },
      { attemptRef: 'att_2', sessionRef: 'sess_a', buckets: null, status: 'unknown' },
    ],
    nextCursor: 'cursor-2',
    truncated: true,
    ...overrides,
  }
}

function readyState(overrides: Partial<SessionInsightsBindingState> = {}): SessionInsightsBindingState {
  return {
    status: 'ready',
    snapshot: snapshot(),
    stale: false,
    subscription: false,
    staleCursor: false,
    loadingMore: false,
    ...overrides,
  }
}

const noTrajectory: SessionInsightsTrajectorySeam = { available: false, reason: en['insights.trajectory.unavailable'] }

describe('SessionInsightsPanel', () => {
  it('renders context bar, overview, composition, context, breakdowns, and the request list', () => {
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    expect(screen.getByText('Session statistics')).toBeTruthy()
    expect(screen.getByText('sess_a')).toBeTruthy()
    expect(screen.getByText(/complete coverage/)).toBeTruthy()
    expect(container.querySelector('[data-insights-overview]')?.textContent).toContain(en['insights.metric.requests'])
    expect(screen.getByText('deepseek-chat')).toBeTruthy()
    expect(screen.getByText(en['insights.breakdownTruncated'])).toBeTruthy() // max-50 truncation visible
    expect(screen.getByText(en['insights.section.context'])).toBeTruthy()
    expect(screen.getByRole('button', { name: en['insights.refresh'] })).toBeTruthy()
    expect(screen.getByRole('button', { name: en['insights.loadMore'] })).toBeTruthy()
  })

  it('shows unknown buckets as — and never zero-fills', () => {
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    const cacheWrite = screen.getByText(en['insights.bucket.cacheWrite']).closest('li')
    expect(cacheWrite?.textContent).toContain('—')
  })

  it('renders context without a percentage when the limit is missing', () => {
    const noLimit = snapshot({ context: { status: 'available', used: 1200, remaining: 8800 } })
    const { container } = render(<SessionInsightsPanel state={readyState({ snapshot: noLimit })} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    const context = container.querySelector('[data-insights-context]')
    expect(context?.textContent).toContain('1200')
    expect(context?.textContent).toContain('8800')
    expect(context?.textContent).not.toContain('%')
  })

  it('shows the confirmed-empty zero only when coverage is complete with no requests', () => {
    const empty = snapshot({
      totals: { buckets: { uncachedInputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 }, requestCount: 0, sumRequestDurationMs: 0, wallClockMs: 0 },
      requests: [],
      nextCursor: undefined,
      truncated: false,
    })
    render(<SessionInsightsPanel state={readyState({ snapshot: empty })} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    expect(screen.getAllByText(en['insights.empty.confirmed']).length).toBeGreaterThan(0)
  })

  it('labels partial coverage and stale freshness honestly', () => {
    const partial = snapshot({
      freshness: 'stale',
      coverage: { status: 'partial', knownRequests: 2, missingUsageRequests: 3, missingReason: 'three requests lack owner usage' },
    })
    render(<SessionInsightsPanel state={readyState({ snapshot: partial })} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    expect(screen.getByText('three requests lack owner usage')).toBeTruthy()
    expect(screen.getByText(new RegExp(en['insights.freshness.stale']))).toBeTruthy()
  })

  it('keeps the old value with a compact error strip and explicit retry', () => {
    const onRefresh = vi.fn()
    render(<SessionInsightsPanel
      state={readyState({ status: 'error', message: 'history read failed', stale: true })}
      t={t} onRefresh={onRefresh} trajectory={noTrajectory} />)
    expect(screen.getByText('history read failed')).toBeTruthy()
    expect(screen.getByText('deepseek-chat')).toBeTruthy() // old content kept
    fireEvent.click(screen.getByRole('button', { name: en['usage.error.retry'] }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('shows the loading skeleton on the first read', () => {
    const { container } = render(<SessionInsightsPanel
      state={{ status: 'loading', stale: false, subscription: false, staleCursor: false, loadingMore: false }}
      t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    expect(container.querySelector('[data-insights-loading]')).toBeTruthy()
  })

  it('prompts an explicit first-page re-read on a stale cursor', () => {
    const onRefresh = vi.fn()
    const { container } = render(<SessionInsightsPanel
      state={readyState({ staleCursor: true, message: 'cursor invalidated' })}
      t={t} onRefresh={onRefresh} trajectory={noTrajectory} />)
    expect(container.querySelector('[data-insights-stale-cursor]')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['insights.rereadFirstPage'] }))
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('paginates explicitly via load more', () => {
    const onLoadMore = vi.fn()
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} onLoadMore={onLoadMore} trajectory={noTrajectory} />)
    fireEvent.click(screen.getByRole('button', { name: en['insights.loadMore'] }))
    expect(onLoadMore).toHaveBeenCalledTimes(1)
  })

  it('disables the trajectory action with the reason when the locator seam is missing', () => {
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    const buttons = screen.getAllByRole('button', { name: en['insights.trajectory.locate'] })
    expect(buttons.length).toBe(2)
    for (const button of buttons) {
      expect((button as HTMLButtonElement).disabled).toBe(true)
      expect(button.getAttribute('title')).toBe(en['insights.trajectory.unavailable'])
    }
    // The statistics view stays put.
    expect(screen.getByText('Session statistics')).toBeTruthy()
  })

  it('routes the trajectory locator with opaque same-session refs only', () => {
    const locate = vi.fn()
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}}
      trajectory={{ available: true, locate }} />)
    fireEvent.click(screen.getAllByRole('button', { name: en['insights.trajectory.locate'] })[0]!)
    expect(locate).toHaveBeenCalledWith({
      sessionRef: 'sess_a', attemptRef: 'att_1', requestRef: 'req_1', runRef: 'run_1', eventRef: 'evt_1',
    })
    expect(JSON.stringify(locate.mock.calls[0])).not.toMatch(/\/home\/|https?:\/\//)
  })

  it('announces manual refresh when the host has no subscription seam', () => {
    render(<SessionInsightsPanel state={readyState({ subscription: false })} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    expect(screen.getByText(new RegExp('refresh manually'))).toBeTruthy()
  })

  it('switches scope explicitly through the nav', () => {
    const onScopeChange = vi.fn()
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} onScopeChange={onScopeChange} trajectory={noTrajectory} />)
    // The current scope is session: apply stays disabled (no implicit change).
    expect((screen.getByRole('button', { name: en['insights.scope.apply'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['insights.scope.run'] }))
    // run scope requires a runRef — apply remains disabled until provided.
    expect((screen.getByRole('button', { name: en['insights.scope.apply'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(en['insights.scope.runRef']), { target: { value: 'run_9' } })
    fireEvent.click(screen.getByRole('button', { name: en['insights.scope.apply'] }))
    expect(onScopeChange).toHaveBeenCalledWith({ scope: 'run', runRef: 'run_9' })
  })

  it('keeps the account block collapsed with its own idle/error/stale states', () => {
    const balanceIdle: TokenBalanceSlice = { status: 'idle' }
    const onRefresh = vi.fn()
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      account={{ slice: balanceIdle, onRefresh }} />)
    expect(screen.getByText(en['insights.section.account'])).toBeTruthy()
    // Cost basis stays with the account block, not the primary visuals.
    fireEvent.click(screen.getByText(new RegExp(en['balance.title'])))
    expect(screen.getByText(en['balance.idle'])).toBeTruthy()
    expect(screen.getByText('CNY 0.0123 (settled)')).toBeTruthy()
  })

  it('shows the balance error reason and keeps the stale value with an explicit refresh', () => {
    const onRefresh = vi.fn()
    const slice: TokenBalanceSlice = {
      status: 'error',
      message: 'network failed',
      previous: {
        schemaVersion: 'token.balance.snapshot.v1alpha1',
        status: 'ready', freshness: 'fresh', generatedAt: '2026-09-05T08:00:00.000Z',
        safeMessage: 'DeepSeek balance.', isAvailable: true,
        infos: [{ currency: 'CNY', totalBalance: '110.00', grantedBalance: '10.00', toppedUpBalance: '100.00' }],
      },
    }
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      account={{ slice, onRefresh }} />)
    fireEvent.click(screen.getByText(new RegExp(en['balance.title'])))
    expect(screen.getByText('network failed')).toBeTruthy()
    expect(screen.getByText('110.00')).toBeTruthy() // stale value kept
    fireEvent.click(container.querySelector('[data-dsh-token-usage-refresh]')!)
    expect(onRefresh).toHaveBeenCalledTimes(1)
  })

  it('explains an unsupported account without a dead refresh button', () => {
    const slice: TokenBalanceSlice = {
      status: 'ready',
      balance: {
        schemaVersion: 'token.balance.snapshot.v1alpha1',
        status: 'unsupported', freshness: 'unknown', generatedAt: '2026-09-05T08:00:00.000Z',
        reasonCode: 'provider_not_deepseek',
        safeMessage: 'Balance is available for the DeepSeek official route only.',
      },
    }
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      account={{ slice, onRefresh: () => {} }} />)
    fireEvent.click(screen.getByText(new RegExp(en['balance.title'])))
    expect(screen.getByText('Balance is available for the DeepSeek official route only.')).toBeTruthy()
    expect(container.querySelector('[data-dsh-token-usage-refresh]')).toBeNull()
  })

  it('provides a text equivalent for the composition chart', () => {
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    const bar = container.querySelector('[data-insights-composition-bar]')
    expect(bar?.getAttribute('role')).toBe('img')
    expect(bar?.getAttribute('aria-label')).toContain('6400')
    expect(container.querySelector('[data-insights-composition]')?.textContent).toContain('6400')
  })

  it('scopes all styles and keeps the a11y/responsive guards', () => {
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory} />)
    const css = [...container.querySelectorAll('style')]
      .map(node => node.textContent ?? '')
      .find(text => text.includes('[data-dsh-token-usage-insights]')) ?? ''
    expect(css.length).toBeGreaterThan(0)
    // Adjacent-plugin isolation: every rule selector carries the scope attribute.
    const stripped = css.replace(/@(container|media|supports|keyframes)[^{]*\{/g, '')
    const selectors = [...stripped.matchAll(/([^\s{}][^{}]*)\{/g)].map(match => match[1]!.trim())
    expect(selectors.length).toBeGreaterThan(0)
    for (const selector of selectors) {
      expect(selector).toContain('[data-dsh-token-usage-insights]')
    }
    // Container-based responsive layout (not viewport), 360/560/960 covered by surface + panel queries.
    expect(css).toContain('@container yeisme-surface (max-width:420px)')
    // 44px coarse-pointer targets, reduced motion, visible focus.
    expect(css).toContain('@media(pointer:coarse)')
    expect(css).toContain('min-height:44px')
    expect(css).toContain('@media(prefers-reduced-motion:reduce)')
    expect(css).toContain(':focus-visible')
    // No hardcoded color literals outside tokens.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
  })

  it('keeps keyboard focus reachable on every action at 360px', () => {
    render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={{ available: true, locate: () => {} }} />)
    const actions = screen.getAllByRole('button')
    expect(actions.length).toBeGreaterThan(3)
    for (const action of actions) {
      expect(action.tabIndex).not.toBe(-1)
    }
  })
})

function directoryEntries(count: number): SessionDirectoryEntryV1[] {
  return Array.from({ length: count }, (_, i) => ({
    sessionRef: `sess_d${String(i + 1).padStart(2, '0')}`,
    label: `Directory session ${i + 1}`,
    running: false,
    archived: false,
  }))
}

function directoryProbe(entries: readonly SessionDirectoryEntryV1[]): Extract<SessionDirectoryProbe, { available: true }> {
  return { available: true, source: { listSessions: vi.fn(async () => entries) } }
}

describe('SessionInsightsPanel target switcher', () => {
  it('lists official directory sessions with bounded client-side pagination', async () => {
    const directory = directoryProbe(directoryEntries(SESSION_DIRECTORY_PAGE_SIZE * 2 + 5))
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      directory={directory} targetRef="sess_a" onTargetChange={() => {}} />)
    // Pinned by default: the directory never opens or switches on its own.
    expect(container.querySelector('[data-insights-directory]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.switch'] }))
    await waitFor(() => {
      expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(SESSION_DIRECTORY_PAGE_SIZE)
    })
    expect(directory.source.listSessions).toHaveBeenCalledTimes(1)
    expect(screen.getByText(`${en['insights.target.directory.pageOf']} 1/3`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.directory.next'] }))
    expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(SESSION_DIRECTORY_PAGE_SIZE)
    expect(screen.getByText(`${en['insights.target.directory.pageOf']} 2/3`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.directory.next'] }))
    expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(5)
    expect(screen.getByText(`${en['insights.target.directory.pageOf']} 3/3`)).toBeTruthy()
    expect((screen.getByRole('button', { name: en['insights.target.directory.next'] }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.directory.prev'] }))
    expect(screen.getByText(`${en['insights.target.directory.pageOf']} 2/3`)).toBeTruthy()
  })

  it('switches the target only on an explicit directory selection', async () => {
    const onTargetChange = vi.fn()
    const directory = directoryProbe(directoryEntries(3))
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      directory={directory} targetRef="sess_a" onTargetChange={onTargetChange} />)
    expect(onTargetChange).not.toHaveBeenCalled() // no auto-follow of directory order
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.switch'] }))
    await waitFor(() => { expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(3) })
    const row = [...container.querySelectorAll('[data-insights-directory-row]')]
      .find(candidate => candidate.textContent?.includes('Directory session 2'))
    expect(row).toBeDefined()
    fireEvent.click(within(row as HTMLElement).getByRole('button', { name: en['insights.target.directory.use'] }))
    expect(onTargetChange).toHaveBeenCalledWith('sess_d02')
    // The directory closes after the explicit selection.
    expect(container.querySelector('[data-insights-directory]')).toBeNull()
  })

  it('marks the bound session as the current target without a switch action', async () => {
    const directory = directoryProbe([
      { sessionRef: 'sess_a', label: 'Alpha', running: true, archived: false },
      { sessionRef: 'sess_b', label: 'Beta', running: false, archived: false },
    ])
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      directory={directory} targetRef="sess_a" onTargetChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.switch'] }))
    await waitFor(() => { expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(2) })
    const current = container.querySelector('[data-insights-directory-row][data-current="true"]') as HTMLElement
    expect(current.textContent).toContain('Alpha')
    expect(current.textContent).toContain(en['insights.target.directory.running'])
    expect(current.querySelector('[aria-current="true"]')?.textContent).toBe(en['insights.target.directory.bound'])
    expect(within(current).queryByRole('button', { name: en['insights.target.directory.use'] })).toBeNull()
  })

  it('disables the switcher with the probe reason when the official directory seam is absent', () => {
    const onTargetChange = vi.fn()
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      directory={{ available: false, reason: en['insights.target.directory.unavailable'] }}
      targetRef="sess_a" onTargetChange={onTargetChange} />)
    const button = screen.getByRole('button', { name: en['insights.target.switch'] }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('title')).toBe(en['insights.target.directory.unavailable'])
    fireEvent.click(button)
    // No directory renders; the legacy bySession top-20 is never a fallback.
    expect(container.querySelector('[data-insights-directory]')).toBeNull()
    expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(0)
    expect(onTargetChange).not.toHaveBeenCalled()
    // The bound statistics view stays put.
    expect(screen.getByText('sess_a')).toBeTruthy()
  })

  it('shows the directory error state with an explicit retry', async () => {
    const listSessions = vi.fn(async () => { throw new Error('directory read failed') })
    const { container } = render(<SessionInsightsPanel state={readyState()} t={t} onRefresh={() => {}} trajectory={noTrajectory}
      directory={{ available: true, source: { listSessions } }} targetRef="sess_a" onTargetChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: en['insights.target.switch'] }))
    await waitFor(() => { expect(container.querySelector('[data-insights-directory-error]')).toBeTruthy() })
    listSessions.mockImplementation(async () => directoryEntries(1))
    fireEvent.click(screen.getByRole('button', { name: en['usage.error.retry'] }))
    await waitFor(() => { expect(container.querySelectorAll('[data-insights-directory-row]')).toHaveLength(1) })
  })
})
