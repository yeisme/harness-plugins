/** Local Agent Context and Terminal probe views. */
import { createElement, useSyncExternalStore, type ReactNode } from 'react'
import { AgentContextController } from './controller.js'
import type { AgentContextTab, InvocationRecordV1, PlanStepV1, SkillRecordV1 } from './projection.js'
import { probeTerminalCapability, type TerminalCapabilitySource, type TerminalProbeProjection } from './terminal-probe.js'

export function createAgentContextView(controller: AgentContextController) {
  return function AgentContextView(): ReactNode {
    const projection = useSyncExternalStore(controller.subscribe, () => controller.getSnapshot(), () => controller.getSnapshot())
    const highlighted = controller.highlightedSkillIds()
    const tab = controller.currentTab
    return createElement('section', { 'data-pane-agent-context': true, 'data-tab': tab },
      createElement('div', { role: 'tablist', 'aria-label': 'Agent Context' },
        tabButton(controller, 'plan', tab, 'Plan'),
        tabButton(controller, 'skills', tab, 'Skills'),
        tabButton(controller, 'invocations', tab, 'Invocations'),
      ),
      tab === 'plan' ? planPanel(controller, projection.steps) : null,
      tab === 'skills' ? skillsPanel(projection.skills, highlighted) : null,
      tab === 'invocations' ? invocationsPanel(projection.invocations) : null,
    )
  }
}

function tabButton(controller: AgentContextController, id: AgentContextTab, current: AgentContextTab, label: string): ReactNode {
  return createElement('button', {
    type: 'button',
    role: 'tab',
    'aria-selected': current === id,
    onClick: () => { controller.setTab(id) },
  }, label)
}

function planPanel(controller: AgentContextController, steps: readonly PlanStepV1[]): ReactNode {
  if (steps.length === 0) return createElement('p', null, 'No plan projection.')
  return createElement('ul', { 'data-pane-agent-context-plan': true }, steps.map(step => createElement('li', { key: step.id },
    createElement('button', {
      type: 'button',
      'data-step-id': step.id,
      'data-status': step.status,
      onClick: () => { controller.selectStep(step.id) },
    }, step.title),
    step.blocker === undefined ? null : createElement('span', { 'data-blocker': true }, step.blocker),
  )))
}

function skillsPanel(skills: readonly SkillRecordV1[], highlighted: ReadonlySet<string>): ReactNode {
  if (skills.length === 0) return createElement('p', null, 'No skills projection.')
  return createElement('ul', { 'data-pane-agent-context-skills': true }, skills.map(skill => createElement('li', {
    key: skill.id,
    'data-skill-id': skill.id,
    'data-highlighted': highlighted.has(skill.id) || undefined,
    'data-state': skill.state,
  }, `${skill.label} · ${skill.scope}`)))
}

function invocationsPanel(invocations: readonly InvocationRecordV1[]): ReactNode {
  if (invocations.length === 0) return createElement('p', null, 'No invocations.')
  return createElement('ol', { 'data-pane-agent-context-invocations': true }, invocations.map(item => createElement('li', {
    key: item.id,
    'data-invocation-id': item.id,
    'data-status': item.status,
  }, item.summary)))
}

export function createTerminalProbeView(getSource: () => TerminalCapabilitySource | undefined) {
  return function TerminalProbeView(): ReactNode {
    const projection: TerminalProbeProjection = probeTerminalCapability(getSource())
    return createElement('section', {
      'data-pane-terminal-probe': true,
      'data-status': projection.status,
    },
      createElement('p', { role: projection.status === 'contract_mismatch' ? 'alert' : 'status' }, projection.reason),
      projection.sessions.length === 0 ? null : createElement('ul', null, projection.sessions.map(session => createElement('li', { key: session.id }, `${session.id} · ${session.status}`))),
      createElement('textarea', { disabled: !projection.inputEnabled, 'aria-label': 'Terminal input' }),
    )
  }
}
