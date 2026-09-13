import { describe, expect, it, vi } from 'vitest'
import { registerProjectCommandPane } from '../src/client/project-registration.tsx'

describe('user workspace Team navigation', () => {
  it('opens a stable user pane without requiring a current session and retains the old command', () => {
    const disposeView = vi.fn(); const disposeCommand = vi.fn()
    const pane = { registerView: vi.fn(() => disposeView), registerCommand: vi.fn(() => disposeCommand), openView: vi.fn() }
    const get = vi.fn((name: string) => name === 'paneWorkbench' ? pane : undefined)
    const dispose = registerProjectCommandPane({ get })
    const commands = pane.registerCommand.mock.calls.map(call => (call as unknown as [{ descriptor: { slash: { name: string } }; execute(): void }])[0])
    expect(commands.map(command => command.descriptor.slash.name)).toEqual(['ordo-project', 'agent-team'])
    commands[1]!.execute()
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'agents.hub', resourceKey: 'ordo-project:picker', singleton: true }))
    expect(get).not.toHaveBeenCalledWith('sessions')
    dispose(); expect(disposeView).toHaveBeenCalledOnce(); expect(disposeCommand).toHaveBeenCalledTimes(2)
  })
})
