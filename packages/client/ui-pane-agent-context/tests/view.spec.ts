// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import { AgentContextController } from '../src/controller.js'
import { createAgentContextView, createTerminalProbeView } from '../src/view.js'

describe('agent context views', () => {
  it('renders three tabs without polling affordances', () => {
    const controller = new AgentContextController({
      getSnapshot: () => ({
        sessionRef: 'session:one',
        generation: 1,
        steps: [{ id: 'step:1', title: 'Outline', status: 'pending', requiredSkills: [], recommendedSkills: [] }],
        skills: [{ id: 'writer', label: 'Writer', source: 'local', version: '1', scope: 'session', state: 'active' }],
        invocations: [{ id: 'inv:1', skillId: 'writer', status: 'accepted', summary: 'ok' }],
      }),
      subscribe: () => () => {},
    })
    const View = createAgentContextView(controller)
    const html = renderToStaticMarkup(createElement(View))
    expect(html).toContain('data-pane-agent-context')
    expect(html).toContain('Plan')
    expect(html).toContain('Skills')
    expect(html).toContain('Invocations')
    expect(html).not.toContain('setInterval')
    expect(html).not.toContain('Refresh now')
  })

  it('renders terminal contract_mismatch without an input-enabled PTY', () => {
    const View = createTerminalProbeView(() => ({ available: true, capabilities: [] }))
    const html = renderToStaticMarkup(createElement(View))
    expect(html).toContain('data-status="contract_mismatch"')
    expect(html).toContain('disabled')
    expect(html).not.toContain('<xterm')
  })
})
