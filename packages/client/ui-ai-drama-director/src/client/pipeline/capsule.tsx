/**
 * Agent ⇄ Workbench capsule (WorkSurfaceCapsuleV1).
 *
 * Controlled component: switching surfaces only reports the requested surface
 * through `onSwitchSurface`; the capsule itself holds no project, selection,
 * run, or permission state. The expanded menu is the official Menu primitive
 * (focus trap, Escape and return focus stay host-owned).
 */

import { useState, type ReactNode } from 'react'
import { Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import { statusTone } from '@yeisme/dsh-client-ui-visual-kit'
import type { CreativeWorkSurfaceKindV1 } from '@yeisme/dsh-plugin-contracts'
import type { BoundedSummary, WorkSurfaceCapsuleProps } from './types.js'

const SURFACE_LABELS: Readonly<Record<CreativeWorkSurfaceKindV1, string>> = {
  agent: 'Agent',
  workbench: 'Workbench',
}

function summaryText(summary: BoundedSummary): string {
  return summary.truncated ? `${summary.text}…` : summary.text
}

export function WorkSurfaceCapsule({ capsule, onSwitchSurface }: WorkSurfaceCapsuleProps): ReactNode {
  const [menuOpen, setMenuOpen] = useState(false)
  const run = capsule.run

  const items: MenuEntry[] = [
    { type: 'label', id: 'menu:project', text: 'Project' },
    { id: 'project:value', label: summaryText(capsule.menu.project), disabled: true },
    { type: 'label', id: 'menu:surface', text: 'Surface' },
    { id: 'surface:agent', label: SURFACE_LABELS.agent },
    { id: 'surface:workbench', label: SURFACE_LABELS.workbench },
    { type: 'label', id: 'menu:context', text: 'Work context' },
    { id: 'context:value', label: summaryText(capsule.menu.work_context), disabled: true },
    { type: 'label', id: 'menu:run', text: 'Run' },
    { id: 'run:value', label: capsule.menu.run_state, disabled: true },
    { type: 'label', id: 'menu:next', text: 'Next' },
    { id: 'next:value', label: summaryText(capsule.menu.next_action), disabled: true },
  ]

  const select = (id: string): void => {
    if (id === 'surface:agent' || id === 'surface:workbench') {
      onSwitchSurface(id === 'surface:agent' ? 'agent' : 'workbench')
    }
    setMenuOpen(false)
  }

  return (
    <Menu
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      onSelect={select}
      selectedId={`surface:${capsule.surface}`}
      items={items}
      align="end"
      portal
      anchor={
        <div className="plw-capsule" data-surface={capsule.surface} data-testid="plw-capsule">
          <div className="plw-capsule-segments" role="group" aria-label="Work surface">
            <button
              type="button"
              className="plw-capsule-segment"
              data-active={capsule.surface === 'agent'}
              aria-pressed={capsule.surface === 'agent'}
              onClick={() => onSwitchSurface('agent')}
            >
              {SURFACE_LABELS.agent}
            </button>
            <span className="plw-capsule-divider" aria-hidden="true">
              ⇄
            </span>
            <button
              type="button"
              className="plw-capsule-segment"
              data-active={capsule.surface === 'workbench'}
              aria-pressed={capsule.surface === 'workbench'}
              onClick={() => onSwitchSurface('workbench')}
            >
              {SURFACE_LABELS.workbench}
            </button>
          </div>
          {capsule.unsaved_draft ? (
            <span className="plw-capsule-dot" data-kind="draft" role="img" aria-label="Unsaved draft" title="Unsaved draft" />
          ) : null}
          {capsule.pending_review ? <span className="plw-capsule-badge">Pending review</span> : null}
          {run === undefined ? null : (
            <span className="plw-capsule-run" role="status">
              <span className="vk-dot" data-tone={statusTone(run.state)} aria-hidden="true" />
              <span className="plw-capsule-run-text">
                {run.state}
                {run.progress === undefined ? '' : ` ${run.progress.completed}/${run.progress.total}`}
              </span>
            </span>
          )}
          <button
            type="button"
            className="plw-capsule-menu-trigger"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Work surface details"
            onClick={() => setMenuOpen(open => !open)}
          >
            ▾
          </button>
        </div>
      }
    />
  )
}
