// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { GitPane } from '../src/client/git-pane.tsx'

afterEach(cleanup)

describe('GitPane', () => {
  it('renders porcelain status files', async () => {
    render(<GitPane host={{
      async status() {
        return {
          branch: 'main',
          files: [{ path: 'README.md', index: ' ', worktree: 'M' }],
        }
      },
    }} />)
    expect(await screen.findByText('main')).toBeTruthy()
    expect(screen.getByText('README.md')).toBeTruthy()
    expect(screen.getByText('已修改')).toBeTruthy()
    expect(screen.getByText(/GitTypedActionsCapabilityV1/)).toBeTruthy()
  })

  it('stages a changed file through typed actions', async () => {
    const staged: string[] = []
    render(<GitPane host={{
      capabilities: ['GitTypedActionsCapabilityV1'],
      async status() {
        return {
          branch: 'main',
          files: [{ path: 'README.md', index: ' ', worktree: 'M' }],
        }
      },
      async stage(path) {
        staged.push(path)
        return { status: 'ok', actionId: 'stage' }
      },
      async unstage() { return { status: 'ok', actionId: 'unstage' } },
      async commit() { return { status: 'ok', actionId: 'commit' } },
    }} />)
    expect(await screen.findByText('README.md')).toBeTruthy()
    screen.getByRole('button', { name: '暂存' }).click()
    await waitFor(() => { expect(staged).toEqual(['README.md']) })
  })
})
