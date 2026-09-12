/**
 * Context-bar navigation: project dropdown + Workflow/Models/Assets/Render/Gallery
 * section switcher. Rendered inside the single SurfaceContextBar `nav` slot
 * (which already owns the <nav> landmark). Stateless apart from the local
 * dropdown open flag; selection is reported through props callbacks only.
 */

import { useState, type ReactNode } from 'react'
import { Menu, type MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PipelineWorkbenchNavProps, PipelineWorkbenchSection } from './types.js'
import { PIPELINE_WORKBENCH_SECTIONS } from './types.js'

export const PIPELINE_SECTION_LABELS: Readonly<Record<PipelineWorkbenchSection, string>> = {
  workflow: 'Workflow',
  models: 'Models',
  assets: 'Assets',
  render: 'Render',
  gallery: 'Gallery',
}

export function PipelineWorkbenchNav({
  project,
  projects,
  onSelectProject,
  section,
  onSelectSection,
  sectionLabels = PIPELINE_SECTION_LABELS,
}: PipelineWorkbenchNavProps): ReactNode {
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const projectItems: MenuEntry[] = (projects ?? [project]).map(option => ({
    id: option.ref,
    label: option.context === undefined ? option.label : `${option.label} · ${option.context}`,
  }))

  return (
    <div className="plw-nav" data-testid="plw-nav">
      <Menu
        open={projectMenuOpen}
        onClose={() => setProjectMenuOpen(false)}
        onSelect={ref => {
          onSelectProject?.(ref)
          setProjectMenuOpen(false)
        }}
        selectedId={project.ref}
        items={projectItems}
        align="start"
        portal
        anchor={
          <button
            type="button"
            className="vk-btn plw-project-trigger"
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
            aria-label={`Project: ${project.label}`}
            title={project.label}
            onClick={() => setProjectMenuOpen(open => !open)}
          >
            <span className="plw-project-label">{project.label}</span>
            <span aria-hidden="true">▾</span>
          </button>
        }
      />
      <div className="plw-sections" role="group" aria-label="Workbench sections">
        {PIPELINE_WORKBENCH_SECTIONS.map(item => (
          <button
            key={item}
            type="button"
            className="vk-btn plw-section"
            data-active={section === item}
            aria-pressed={section === item}
            onClick={() => onSelectSection(item)}
          >
            {sectionLabels[item]}
          </button>
        ))}
      </div>
    </div>
  )
}
