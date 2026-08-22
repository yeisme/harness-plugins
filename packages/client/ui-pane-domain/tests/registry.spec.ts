import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DOMAIN_OWNERS, DOMAIN_PANE_KINDS, SUBAGENT_BADGE } from '../src/owners.ts'
import { registerDomainPaneViews } from '../src/registry.ts'
import { DomainPaneView } from '../src/view.ts'
import type { DomainSnapshotV1 } from '../src/snapshot.ts'

describe('registerDomainPaneViews', () => {
  it('registers every domain owner once and disposes all of them', () => {
    const registered: string[] = []
    const dispose = registerDomainPaneViews({
      registerView(input) {
        const kind = (input as { descriptor: { kind: string } }).descriptor.kind
        registered.push(kind)
        return () => {
          const index = registered.indexOf(kind)
          if (index >= 0) registered.splice(index, 1)
        }
      },
    }, {
      getSnapshot: owner => ({
        owner,
        status: 'offline',
        freshness: 'unknown',
        items: [],
        allowedActions: [],
      }),
    })
    expect(registered).toEqual(DOMAIN_OWNERS.map(owner => DOMAIN_PANE_KINDS[owner]))
    dispose()
    expect(registered).toEqual([])
  })
})

describe('DomainPaneView', () => {
  it('keeps Ordo visually distinct from Session Subagent and virtualizes long lists', () => {
    const items = Array.from({ length: 120 }, (_, index) => ({
      ref: `task:${index + 1}`,
      title: `Task ${index + 1}`,
      version: '1',
      kind: 'task',
      status: 'ready',
    }))
    const snapshot: DomainSnapshotV1 = {
      owner: 'ordo',
      status: 'ready',
      freshness: 'fresh',
      items,
      allowedActions: [
        { id: 'ordo.reconcile.request', gated: true },
        { id: 'run.launch', gated: false },
      ],
    }
    const html = renderToStaticMarkup(createElement(DomainPaneView, { snapshot }))
    expect(html).toContain('data-badge="Ordo"')
    expect(html).toContain(`Not ${SUBAGENT_BADGE}`)
    expect(html).toContain('aria-rowcount="120"')
    expect(html).toContain('data-virtualized')
    expect(html).not.toContain('Task 120')
    expect(html).toContain('disabled')
    expect(html).toMatch(/disabled="" aria-label="run.launch"/)
  })

  it('does not present Anatomia partial as complete', () => {
    const html = renderToStaticMarkup(createElement(DomainPaneView, {
      snapshot: {
        owner: 'anatomia',
        status: 'running',
        freshness: 'fresh',
        items: [{ ref: 'shot:1', title: 'Shot 1', version: '1', kind: 'shot', status: 'running', partial: true }],
        allowedActions: [],
      },
    }))
    expect(html).toContain('partial')
    expect(html).not.toContain('complete')
  })
})
