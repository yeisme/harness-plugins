// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from '../../../client/ui-browser-pane/node_modules/react-dom/client.js'
import { createFakeBrowserAutomationProvider } from '@yeisme/dsh-browser-host'
import { apply } from '../src/client/index.ts'
import { DSH_BROWSER_AUTOMATION_BINDING_CONTEXT_KEY, DSH_BROWSER_AUTOMATION_PROVIDER_CONTEXT_KEY } from '../src/registration.ts'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('browser pane client entry', () => {
  it('registers and mounts the real React component and opens it from the command', async () => {
    const views: any[] = []
    const commands: any[] = []
    const pane = {
      registerView: vi.fn(input => { views.push(input); return () => {} }),
      registerCommand: vi.fn(input => { commands.push(input); return () => {} }),
      openView: vi.fn(),
    }
    const provider = createFakeBrowserAutomationProvider({ pages: [{ pageRef: 'page:1', host: 'client.example', title: 'Client' }] })
    const services = new Map<string, unknown>([
      ['paneWorkbench', pane],
      [DSH_BROWSER_AUTOMATION_PROVIDER_CONTEXT_KEY, provider],
      [DSH_BROWSER_AUTOMATION_BINDING_CONTEXT_KEY, { tenantRef: 'tenant:one', workspaceRef: 'workspace:one', principalRef: 'principal:one', contextRevision: 1, sessionRef: 'fake-session:1' }],
    ])
    const dispose = await apply({ get: (key: string) => services.get(key) } as never)
    expect(views[0]?.descriptor.kind).toBe('dsh.browser')
    expect(views[0]?.component).toBeTypeOf('function')
    commands[0].execute()
    expect(pane.openView).toHaveBeenCalledWith(expect.objectContaining({ kind: 'dsh.browser' }))
    const container = document.createElement('div')
    const root = createRoot(container)
    await act(async () => { root.render(views[0].component()); await new Promise(resolve => setTimeout(resolve, 0)) })
    expect(container.querySelector('[data-dsh-browser-pane]')).not.toBeNull()
    expect(container.textContent).toContain('client.example')
    await act(async () => { root.unmount() })
    dispose()
  })
})
