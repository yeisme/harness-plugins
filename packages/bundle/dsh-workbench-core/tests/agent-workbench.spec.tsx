// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { AgentWorkbench } from '../src/client/agent-workbench.tsx'
import { WorkbenchContextController } from '../src/context.ts'

afterEach(cleanup)

describe('AgentWorkbench', () => {
  it('switches context and agent role while keeping the project ref visible', () => {
    const controller = new WorkbenchContextController({ projectRef: 'project:one', initial: { pendingAction: '审阅候选' } })
    render(<AgentWorkbench controller={controller} renderWorkspace={context => <div data-testid="workspace">{context}</div>} />)
    expect(screen.getByText('project:one')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '3D' }))
    fireEvent.click(screen.getByRole('button', { name: '建模师' }))
    expect(screen.getByTestId('workspace').textContent).toBe('three-d')
    expect(screen.getByRole('button', { name: '3D' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '建模师' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText('审阅候选')).toBeTruthy()
  })

  it('allows an agent panel projection without granting execution', () => {
    const controller = new WorkbenchContextController({ projectRef: 'project:one' })
    render(<AgentWorkbench controller={controller} renderWorkspace={() => <div />} />)
    expect(screen.getByText('等待 Agent 建议')).toBeTruthy()
    expect(screen.getByText(/执行仍需明确确认/)).toBeTruthy()
  })
})
