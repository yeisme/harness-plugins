/** Local Agent Context and Terminal probe views. */
import { createElement, useEffect, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  Surface,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import { AgentContextController } from './controller.js'
import type { AgentContextTab, InvocationRecordV1, PlanStepV1, SkillRecordV1 } from './projection.js'
import { probeTerminalCapability, type TerminalCapabilitySource, type TerminalProbeProjection } from './terminal-probe.js'

export function createAgentContextView(controller: AgentContextController) {
  return function AgentContextView(props?: { readonly view?: { readonly metadata?: { readonly tab?: unknown } } }): ReactNode {
    const requested = props?.view?.metadata?.tab
    useEffect(() => {
      if (requested === 'plan' || requested === 'skills' || requested === 'invocations') {
        controller.setTab(requested)
      }
    }, [controller, requested])
    const projection = useSyncExternalStore(controller.subscribe, () => controller.getSnapshot(), () => controller.getSnapshot())
    const highlighted = controller.highlightedSkillIds()
    const tab = controller.currentTab
    return createElement(Surface, { kind: 'workspace', 'data-pane-agent-context': true, 'data-tab': tab },
      createElement(SurfaceContextBar, {
        title: 'Agent Context',
        description: 'Owner-projected plan, skills and invocations.',
        nav: createElement('div', { role: 'tablist', 'aria-label': 'Agent Context' },
          tabButton(controller, 'plan', tab, 'Plan'),
          tabButton(controller, 'skills', tab, 'Skills'),
          tabButton(controller, 'invocations', tab, 'Invocations'),
        ),
      }),
      createElement('div', { className: 'ys-body' },
        tab === 'plan' ? planPanel(controller, projection.steps) : null,
        tab === 'skills' ? skillsPanel(projection.skills, highlighted) : null,
        tab === 'invocations' ? invocationsPanel(projection.invocations) : null,
      ),
    )
  }
}

function tabButton(controller: AgentContextController, id: AgentContextTab, current: AgentContextTab, label: string): ReactNode {
  return createElement(Button, {
    type: 'button',
    role: 'tab',
    'aria-selected': current === id,
    onClick: () => { controller.setTab(id) },
  }, label)
}

function planPanel(controller: AgentContextController, steps: readonly PlanStepV1[]): ReactNode {
  if (steps.length === 0) return createElement(SurfaceState, { phase: 'empty', title: 'No plan projection.' })
  return createElement(SurfaceSection, { title: 'Plan' }, createElement('ul', { className: 'ys-list', 'data-pane-agent-context-plan': true }, steps.map(step => createElement('li', { key: step.id, className: 'ys-row' },
    createElement(Button, {
      type: 'button',
      'data-step-id': step.id,
      'data-status': step.status,
      onClick: () => { controller.selectStep(step.id) },
    } as ComponentProps<typeof Button> & { readonly 'data-step-id': string; readonly 'data-status': string }, step.title),
    step.blocker === undefined ? null : createElement('span', { 'data-blocker': true }, step.blocker),
  ))))
}

function skillsPanel(skills: readonly SkillRecordV1[], highlighted: ReadonlySet<string>): ReactNode {
  if (skills.length === 0) return createElement(SurfaceState, { phase: 'empty', title: 'No skills projection.' })
  return createElement(SurfaceSection, { title: 'Skills' }, createElement('ul', { className: 'ys-list', 'data-pane-agent-context-skills': true }, skills.map(skill => createElement('li', {
    key: skill.id,
    className: 'ys-row',
    'data-skill-id': skill.id,
    'data-highlighted': highlighted.has(skill.id) || undefined,
    'data-state': skill.state,
  }, `${skill.label} · ${skill.scope}`))))
}

function invocationsPanel(invocations: readonly InvocationRecordV1[]): ReactNode {
  if (invocations.length === 0) return createElement(SurfaceState, { phase: 'empty', title: 'No invocations.' })
  return createElement(SurfaceSection, { title: 'Invocations' }, createElement('ol', { className: 'ys-list', 'data-pane-agent-context-invocations': true }, invocations.map(item => createElement('li', {
    key: item.id,
    className: 'ys-row',
    'data-invocation-id': item.id,
    'data-status': item.status,
  }, item.summary))))
}

export function createTerminalProbeView(getSource: () => TerminalCapabilitySource | undefined) {
  return function TerminalProbeView(): ReactNode {
    const projection: TerminalProbeProjection = probeTerminalCapability(getSource())
    return createElement(Surface, {
      kind: 'inspector',
      'data-pane-terminal-probe': true,
      'data-status': projection.status,
    },
      createElement(SurfaceContextBar, { title: 'Terminal probe', status: projection.status }),
      createElement('div', { className: 'ys-body' },
        createElement(SurfaceState, {
          phase: projection.status === 'ready' ? 'success' : projection.status === 'contract_mismatch' ? 'error' : 'disabled',
          title: projection.status,
          description: projection.reason,
        }),
        projection.sessions.length === 0 ? null : createElement('ul', { className: 'ys-list' }, projection.sessions.map(session => createElement('li', { key: session.id, className: 'ys-row' }, `${session.id} · ${session.status}`))),
        createElement('label', { className: 'ys-field' },
          createElement('span', null, 'Terminal input'),
          createElement('textarea', { disabled: !projection.inputEnabled, 'aria-label': 'Terminal input' }),
        ),
      ),
    )
  }
}
