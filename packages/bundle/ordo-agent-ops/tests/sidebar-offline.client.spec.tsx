// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { OrdoAgentOpsSidebar } from '../src/client/sidebar.tsx'
import { zh } from '../src/client/locales.ts'
import type { OrdoAgentOpsSnapshot } from '../src/client/contracts.ts'
import type { OrdoAgentOpsViewState } from '../src/client/controller.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => import('./browser-runtime.mock.ts'))

afterEach(cleanup)

const t = (key: string): string => (zh as Record<string, string>)[key] ?? key

function view(snapshot: OrdoAgentOpsSnapshot): OrdoAgentOpsViewState {
  return { phase: 'ready', snapshot, errorCode: null }
}

describe('OrdoAgentOpsSidebar true-data empty/offline states', () => {
  it('shows the CLI-unavailable reason and no demo run rows', () => {
    const snapshot: OrdoAgentOpsSnapshot = {
      schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
      snapshotRef: 'ordo-cli:offline' as OrdoAgentOpsSnapshot['snapshotRef'],
      snapshotVersion: 0,
      generatedAt: '2026-09-01T12:00:00.000Z',
      state: 'offline',
      freshness: 'offline',
      reasonCode: 'owner_projection_unavailable',
      source: 'owner-gated',
      safeMessage: 'Local ordo CLI is not available.',
    }
    render(<OrdoAgentOpsSidebar
      wide
      useState={() => view(snapshot)}
      refresh={vi.fn().mockResolvedValue(undefined)}
      t={t}
    />)
    fireEvent.click(screen.getByRole('button', { name: zh['panel.aria'] }))
    expect(screen.getByText('Local ordo CLI is not available.')).toBeTruthy()
    expect(document.querySelector('[data-ordo-agent-ops-offline]')).toBeTruthy()
    expect(screen.queryByText(zh['panel.noRun'])).toBeNull()
  })

  it('renders a live run summary from the owner snapshot', () => {
    const snapshot: OrdoAgentOpsSnapshot = {
      schemaVersion: 'ordo.agent_ops.snapshot.v1alpha1',
      snapshotRef: 'team.demo' as OrdoAgentOpsSnapshot['snapshotRef'],
      snapshotVersion: 1,
      generatedAt: '2026-09-01T12:00:00.000Z',
      state: 'ready',
      freshness: 'fresh',
      reasonCode: 'owner_snapshot',
      source: 'owner',
      safeMessage: 'Owner team projection.',
      run: {
        runRef: 'team.demo' as never,
        state: 'active',
        safeTitle: 'Review delivery',
        taskCount: 3,
        completedTaskCount: 1,
        attentionCount: 0,
      },
    }
    render(<OrdoAgentOpsSidebar
      wide
      useState={() => view(snapshot)}
      refresh={vi.fn().mockResolvedValue(undefined)}
      t={t}
    />)
    fireEvent.click(screen.getByRole('button', { name: zh['panel.aria'] }))
    expect(screen.getByText('Review delivery')).toBeTruthy()
    expect(screen.getByText('1/3')).toBeTruthy()
    expect(document.querySelector('[data-ordo-agent-ops-offline]')).toBeNull()
  })
})
