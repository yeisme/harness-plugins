import { createElement, type FunctionComponent } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { apply } from '../src/index.ts'

describe('apply', () => {
  it('projects the existing ordoAgentOps snapshot onto the Ordo Team pane', () => {
    const views = new Map<string, FunctionComponent>()
    const ctx = {
      get(name: string) {
        if (name === 'paneWorkbench') {
          return {
            registerView(input: { descriptor: { kind: string }; component: FunctionComponent }) {
              views.set(input.descriptor.kind, input.component)
              return () => { views.delete(input.descriptor.kind) }
            },
          }
        }
        if (name === 'ordoAgentOps') {
          return {
            snapshot: () => ({
              state: 'ready',
              freshness: 'fresh',
              run: {
                runRef: 'run:team-1',
                safeTitle: 'Team run',
                state: 'running',
                taskCount: 4,
                completedTaskCount: 1,
                attentionCount: 0,
              },
              actions: [{ actionType: 'ordo.reconcile.request' }, { actionType: 'run.launch' }],
            }),
          }
        }
        return undefined
      },
    }
    const dispose = apply(ctx as never)
    expect([...views.keys()]).toEqual([
      'workspace.eikona',
      'workspace.sonora',
      'workspace.auctra',
      'workspace.pinax',
      'workspace.anatomia',
      'workspace.ordo-team',
    ])
    const html = renderToStaticMarkup(createElement(views.get('workspace.ordo-team')!))
    expect(html).toContain('data-badge="Ordo"')
    expect(html).toContain('Not Session Subagent')
    expect(html).toContain('run:team-1')
    expect(html).toContain('ordo.reconcile.request')
    expect(html).not.toContain('run.launch')
    dispose()
    expect(views.size).toBe(0)
  })
})
