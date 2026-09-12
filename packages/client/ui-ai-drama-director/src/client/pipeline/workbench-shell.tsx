/**
 * Pipeline workbench shell (dsh-creative-pipeline-visual-workbench-v1, D2).
 *
 * Surface kind="workspace" with a single SurfaceContextBar (project dropdown,
 * section navigation, Agent ⇄ Workbench capsule), an icon rail with the
 * Productions card, the embedded ui-pane-domain ProjectCanvasView host, an
 * Inspector/Versions/Comments tab container, and a read-only bottom run strip.
 *
 * The shell is fully controlled: projections and callbacks arrive via props.
 * It never fetches data, dispatches owner actions, or resets project,
 * selection, run, or permission state; unknown/stale/blocked/needs_contract
 * stay display-only here. Local state is limited to tab selection and the
 * compact detail overlay, which is the official Modal primitive (no custom
 * focus trap).
 */

import { useState, type ReactNode } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { buildPanelStyles } from '@yeisme/dsh-client-ui-visual-kit'
import { ProjectCanvasView } from '@yeisme/dsh-client-ui-pane-domain'
import { WorkSurfaceCapsule } from './capsule.js'
import { PipelineWorkbenchNav } from './workbench-nav.js'
import { BottomRunStrip } from './bottom-run-strip.js'
import type {
  PipelineInspectorTabs,
  PipelineObjectListItem,
  PipelineRailNavItem,
  PipelineWorkbenchShellProps,
} from './types.js'

const INSPECTOR_TABS = [
  { id: 'inspector', label: 'Inspector' },
  { id: 'versions', label: 'Versions' },
  { id: 'comments', label: 'Comments' },
] as const
type InspectorTabId = (typeof INSPECTOR_TABS)[number]['id']

const DEFAULT_RAIL_ITEMS: readonly PipelineRailNavItem[] = [
  { id: 'asset', marker: 'A', label: 'Assets' },
  { id: 'character', marker: 'C', label: 'Characters' },
  { id: 'scene', marker: 'S', label: 'Scenes' },
  { id: 'shot', marker: 'H', label: 'Shots' },
  { id: 'candidate', marker: 'D', label: 'Candidates' },
]

export const pipelineWorkbenchStyles = buildPanelStyles({
  scope: 'pipeline-workbench',
  extra: `
[data-pipeline-workbench]{display:flex;flex-direction:column;height:100%;min-height:0;container-type:inline-size;outline:none}
[data-pipeline-workbench]:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:-2px}
[data-pipeline-workbench] .plw-nav{display:flex;align-items:center;gap:var(--vk-gap-sm);min-width:0;flex-wrap:wrap}
[data-pipeline-workbench] .plw-project-trigger{max-width:180px}
[data-pipeline-workbench] .plw-project-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pipeline-workbench] .plw-sections{display:flex;align-items:center;gap:var(--vk-gap-xs);min-width:0;flex-wrap:wrap}
[data-pipeline-workbench] .plw-section[data-active='true']{color:var(--vk-text-primary);background:var(--vk-fill-selected);border-color:color-mix(in srgb,var(--vk-accent) 45%,var(--vk-border-l2))}
[data-pipeline-workbench] .plw-capsule{display:flex;align-items:center;gap:var(--vk-gap-sm);min-height:34px;padding:2px 6px;background:var(--vk-bg-elevated);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
[data-pipeline-workbench] .plw-capsule-segments{display:flex;align-items:center;gap:2px}
[data-pipeline-workbench] .plw-capsule-segment{min-height:28px;padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:1px solid transparent;border-radius:var(--vk-radius-md);cursor:pointer;font-size:var(--vk-font-small)}
[data-pipeline-workbench] .plw-capsule-segment:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-pipeline-workbench] .plw-capsule-segment[data-active='true']{color:var(--vk-text-primary);background:color-mix(in srgb,var(--vk-accent) 18%,transparent);border-color:color-mix(in srgb,var(--vk-accent) 50%,var(--vk-border-l2))}
[data-pipeline-workbench] .plw-capsule-divider{color:var(--vk-text-quaternary);font-size:var(--vk-font-small)}
[data-pipeline-workbench] .plw-capsule-dot{width:7px;height:7px;border-radius:50%;background:var(--vk-tone-warn)}
[data-pipeline-workbench] .plw-capsule-badge{padding:1px 7px;border-radius:999px;background:color-mix(in srgb,var(--vk-tone-warn) 16%,transparent);color:var(--vk-tone-warn);font-size:10px;white-space:nowrap}
[data-pipeline-workbench] .plw-capsule-run{display:inline-flex;align-items:center;gap:var(--vk-gap-xs);font-size:var(--vk-font-small);color:var(--vk-text-secondary);white-space:nowrap}
[data-pipeline-workbench] .plw-capsule-menu-trigger{display:grid;place-items:center;min-width:24px;min-height:24px;padding:0;color:var(--vk-text-tertiary);background:transparent;border:0;border-radius:var(--vk-radius-sm);cursor:pointer}
[data-pipeline-workbench] .plw-capsule-menu-trigger:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-pipeline-workbench] .plw-layout{display:flex;flex:1;min-height:0;min-width:0}
[data-pipeline-workbench] .plw-rail{display:flex;flex-direction:column;gap:var(--vk-gap-md);width:176px;flex:none;padding:var(--vk-gap-md);border-right:1px solid var(--vk-border-l1);overflow:auto}
[data-pipeline-workbench] .plw-rail-nav{display:grid;gap:2px}
[data-pipeline-workbench] .plw-rail-item{display:flex;align-items:center;gap:var(--vk-gap-sm);min-height:var(--vk-ctrl-button);padding:0 6px;color:var(--vk-text-secondary);background:transparent;border:0;border-radius:var(--vk-radius-md);cursor:pointer;text-align:left;font-size:var(--vk-font-small)}
[data-pipeline-workbench] .plw-rail-item:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-pipeline-workbench] .plw-rail-item[data-active='true']{color:var(--vk-text-primary);background:var(--vk-fill-selected)}
[data-pipeline-workbench] .plw-rail-marker{display:grid;place-items:center;width:22px;height:22px;flex:none;border-radius:var(--vk-radius-sm);background:var(--vk-bg-layer-2);color:var(--vk-text-tertiary);font-size:10px;font-weight:650}
[data-pipeline-workbench] .plw-rail-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pipeline-workbench] .plw-productions{display:grid;gap:var(--vk-gap-sm);padding:var(--vk-gap-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l2);border-radius:var(--vk-radius-lg)}
[data-pipeline-workbench] .plw-productions-title{margin:0;font-size:var(--vk-font-strong);font-weight:650}
[data-pipeline-workbench] .plw-production{display:grid;gap:1px;padding:6px;border:0;border-radius:var(--vk-radius-md);background:transparent;color:var(--vk-text-primary);cursor:pointer;text-align:left;font:inherit}
[data-pipeline-workbench] .plw-production:hover{background:var(--vk-fill-hover)}
[data-pipeline-workbench] .plw-production small{color:var(--vk-text-tertiary);font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pipeline-workbench] .plw-canvas-region{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column;position:relative}
[data-pipeline-workbench] .plw-canvas-notice{margin:var(--vk-gap-sm) var(--vk-gap-md) 0;padding:6px 8px;border:1px solid color-mix(in srgb,var(--vk-tone-warn) 35%,var(--vk-border-subtle));border-radius:var(--vk-radius-md);color:var(--vk-tone-warn);font-size:var(--vk-font-small)}
[data-pipeline-workbench] .plw-canvas-host{flex:1;min-height:0;min-width:0;display:flex;flex-direction:column}
[data-pipeline-workbench] .plw-canvas-host>[data-project-canvas]{flex:1;min-height:0}
[data-pipeline-workbench] .plw-object-list{display:none}
[data-pipeline-workbench] .plw-inspector{width:264px;max-width:40%;flex:none;display:flex;flex-direction:column;min-height:0;border-left:1px solid var(--vk-border-l1);overflow:auto}
[data-pipeline-workbench] .plw-tabs{display:flex;gap:2px;padding:var(--vk-gap-sm);border-bottom:1px solid var(--vk-border-l1)}
[data-pipeline-workbench] .plw-tab{min-height:28px;padding:0 10px;color:var(--vk-text-secondary);background:transparent;border:0;border-bottom:2px solid transparent;border-radius:var(--vk-radius-sm);cursor:pointer;font-size:var(--vk-font-small)}
[data-pipeline-workbench] .plw-tab:hover{color:var(--vk-text-primary);background:var(--vk-fill-hover)}
[data-pipeline-workbench] .plw-tab[aria-selected='true']{color:var(--vk-text-primary);border-bottom-color:var(--vk-accent)}
[data-pipeline-workbench] .plw-tab-panel{flex:1;min-height:0;overflow:auto;padding:var(--vk-gap-md)}
[data-pipeline-workbench] .plw-details-toggle{display:none}
[data-pipeline-workbench] .plw-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:var(--vk-gap-md);padding:var(--vk-gap-md);border-top:1px solid var(--vk-border-l1);max-height:180px;overflow:auto}
[data-pipeline-workbench] .plw-strip-section{display:grid;gap:var(--vk-gap-sm);align-content:start;min-width:0}
[data-pipeline-workbench] .plw-strip-title{margin:0;font-size:var(--vk-font-small);font-weight:650;color:var(--vk-text-secondary)}
[data-pipeline-workbench] .plw-strip-empty{margin:0}
[data-pipeline-workbench] .plw-strip-list{display:grid;gap:2px;margin:0;padding:0;list-style:none}
[data-pipeline-workbench] .plw-edge-list{display:grid;gap:2px;margin:0;padding:0;list-style:none}
[data-pipeline-workbench] .plw-strip-entry{display:flex;align-items:baseline;gap:var(--vk-gap-sm);min-width:0;padding:3px 0;font-size:var(--vk-font-small);color:var(--vk-text-secondary)}
[data-pipeline-workbench] .plw-strip-entry .vk-dot{align-self:center}
[data-pipeline-workbench] .plw-strip-text{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pipeline-workbench] .plw-strip-status{color:var(--vk-text-tertiary);font-size:10px;white-space:nowrap}
[data-pipeline-workbench] .plw-strip-meta{margin-left:auto;color:var(--vk-text-quaternary);font-size:10px;white-space:nowrap}
[data-pipeline-workbench] .plw-object-rows{display:grid;gap:2px;margin:0;padding:var(--vk-gap-md);list-style:none;overflow:auto}
[data-pipeline-workbench] .plw-object-row{display:flex;align-items:center;gap:var(--vk-gap-sm);width:100%;min-height:var(--vk-ctrl-button);padding:0 8px;background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);color:var(--vk-text-primary);cursor:pointer;text-align:left;font:inherit}
[data-pipeline-workbench] .plw-object-row[data-selected='true']{border-color:var(--vk-border-focus)}
[data-pipeline-workbench] .plw-object-kind{flex:none;color:var(--vk-text-quaternary);font-size:10px;text-transform:uppercase;letter-spacing:.04em}
[data-pipeline-workbench] .plw-object-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-pipeline-workbench] .plw-object-status{margin-left:auto;color:var(--vk-text-tertiary);font-size:10px}
@media(pointer:coarse){[data-pipeline-workbench] .plw-capsule-segment,[data-pipeline-workbench] .plw-capsule-menu-trigger,[data-pipeline-workbench] .plw-rail-item,[data-pipeline-workbench] .plw-tab{min-height:var(--vk-ctrl-touch);min-width:var(--vk-ctrl-touch)}}
@container(max-width:720px){
  [data-pipeline-workbench] .plw-rail{width:48px;padding:var(--vk-gap-sm) 4px}
  [data-pipeline-workbench] .plw-rail-label,[data-pipeline-workbench] .plw-productions small{display:none}
  [data-pipeline-workbench] .plw-productions{padding:4px}
  [data-pipeline-workbench] .plw-productions-title{font-size:10px}
  [data-pipeline-workbench] .plw-inspector{display:none}
  [data-pipeline-workbench] .plw-details-toggle{display:inline-flex;position:absolute;right:var(--vk-gap-md);bottom:var(--vk-gap-md);z-index:2}
  [data-pipeline-workbench] .plw-strip{grid-template-columns:1fr;max-height:140px}
}
@container(max-width:420px){
  [data-pipeline-workbench] .plw-rail{display:none}
  [data-pipeline-workbench] .plw-canvas-host{display:none}
  [data-pipeline-workbench] .plw-object-list{display:flex;flex:1;min-height:0;flex-direction:column}
  [data-pipeline-workbench] .plw-project-trigger{max-width:120px}
}
`,
})

function InspectorTabs({ tabs, idPrefix }: { readonly tabs: PipelineInspectorTabs | undefined; readonly idPrefix: string }): ReactNode {
  const [active, setActive] = useState<InspectorTabId>('inspector')
  const onKeyDown = (event: { readonly key: string; preventDefault(): void; target: unknown }): void => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const index = INSPECTOR_TABS.findIndex(tab => tab.id === active)
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? INSPECTOR_TABS.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % INSPECTOR_TABS.length : (index + INSPECTOR_TABS.length - 1) % INSPECTOR_TABS.length
    const tab = INSPECTOR_TABS[next]
    if (tab === undefined) return
    setActive(tab.id)
    if (event.target instanceof HTMLElement) {
      event.target.closest('[role=tablist]')?.querySelectorAll<HTMLElement>('[role=tab]')[next]?.focus()
    }
  }
  const content = tabs?.[active]
  return (
    <div className="plw-inspector-tabs" data-testid={`${idPrefix}-tabs`}>
      <div className="plw-tabs" role="tablist" aria-label="Pipeline detail tabs" onKeyDown={onKeyDown}>
        {INSPECTOR_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`${idPrefix}-tab-${tab.id}`}
            className="plw-tab"
            aria-selected={active === tab.id}
            aria-controls={`${idPrefix}-panel-${tab.id}`}
            tabIndex={active === tab.id ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {INSPECTOR_TABS.map(tab =>
        tab.id === active ? (
          <div key={tab.id} role="tabpanel" id={`${idPrefix}-panel-${tab.id}`} aria-labelledby={`${idPrefix}-tab-${tab.id}`} className="plw-tab-panel">
            {content ?? <SurfaceState phase="empty" title={`No ${tab.label.toLowerCase()} content`} description="Select a node or execution edge on the canvas." />}
          </div>
        ) : null,
      )}
    </div>
  )
}

function ObjectList({ objects, onSelect }: { readonly objects: readonly PipelineObjectListItem[]; readonly onSelect: (id: string) => void }): ReactNode {
  if (objects.length === 0) {
    return (
      <div className="plw-object-list">
        <SurfaceState phase="empty" title="No objects" description="This project has no pipeline objects yet." />
      </div>
    )
  }
  return (
    <div className="plw-object-list">
      <ul className="plw-object-rows" aria-label="Pipeline objects">
        {objects.map(object => (
          <li key={object.id}>
            <button type="button" className="plw-object-row" data-selected={object.selected === true} onClick={() => onSelect(object.id)}>
              <span className="plw-object-kind">{object.kind}</span>
              <span className="plw-object-title">{object.title}</span>
              {object.status === undefined ? null : <span className="plw-object-status">{object.status}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PipelineWorkbenchShell(props: PipelineWorkbenchShellProps): ReactNode {
  const {
    title = 'Pipeline',
    project,
    projects,
    onSelectProject,
    section,
    onSelectSection,
    capsule,
    onSwitchSurface,
    railItems = DEFAULT_RAIL_ITEMS,
    onSelectRailItem,
    productions,
    onOpenProduction,
    canvas,
    canvasPlaceholder,
    onCanvasDrop,
    onCanvasDragOver,
    canvasNotice,
    objects,
    onSelectObject,
    inspectorTabs,
    runStrip,
    ariaLabel,
  } = props
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [overlayObject, setOverlayObject] = useState<string>()
  const overlayObjectTitle = objects?.find(object => object.id === overlayObject)?.title

  const selectObject = (id: string): void => {
    onSelectObject?.(id)
    setOverlayObject(id)
    setOverlayOpen(true)
  }

  return (
    <Surface kind="workspace" className="plw-root" data-pipeline-workbench="true" aria-label={ariaLabel ?? title}>
      <style>{pipelineWorkbenchStyles}</style>
      <SurfaceContextBar
        title={title}
        context={project.label}
        nav={
          <PipelineWorkbenchNav
            project={project}
            {...(projects === undefined ? {} : { projects })}
            {...(onSelectProject === undefined ? {} : { onSelectProject })}
            section={section}
            onSelectSection={onSelectSection}
          />
        }
        actions={<WorkSurfaceCapsule capsule={capsule} onSwitchSurface={onSwitchSurface} />}
      />
      <div className="plw-layout">
        <aside className="plw-rail" aria-label="Assets and productions">
          <div className="plw-rail-nav" role="group" aria-label="Asset navigation">
            {railItems.map(item => (
              <button
                key={item.id}
                type="button"
                className="plw-rail-item"
                data-active={item.active === true}
                aria-pressed={item.active === true}
                aria-label={item.label}
                title={item.label}
                onClick={() => onSelectRailItem?.(item.id)}
              >
                <span className="plw-rail-marker" aria-hidden="true">
                  {item.marker}
                </span>
                <span className="plw-rail-label">{item.label}</span>
              </button>
            ))}
          </div>
          <div className="plw-productions">
            <h3 className="plw-productions-title">Productions</h3>
            {productions === undefined || productions.length === 0 ? (
              <p className="vk-muted" role="status">
                No productions
              </p>
            ) : (
              productions.map(entry => (
                <button key={entry.ref} type="button" className="plw-production" onClick={() => onOpenProduction?.(entry.ref)}>
                  <span>{entry.title}</span>
                  {entry.meta === undefined ? null : <small>{entry.meta}</small>}
                </button>
              ))
            )}
          </div>
        </aside>
        <div
          className="plw-canvas-region"
          {...(onCanvasDrop === undefined ? {} : { onDrop: onCanvasDrop })}
          {...(onCanvasDragOver === undefined ? {} : { onDragOver: onCanvasDragOver })}
        >
          {canvasNotice === undefined ? null : (
            <p className="plw-canvas-notice" role="status">
              {canvasNotice}
            </p>
          )}
          <div className="plw-canvas-host">
            {canvas === undefined ? (
              <SurfaceState
                phase={canvasPlaceholder?.phase ?? 'empty'}
                title={canvasPlaceholder?.title ?? 'Canvas is not connected'}
                {...(canvasPlaceholder?.description === undefined ? {} : { description: canvasPlaceholder.description })}
              />
            ) : (
              <ProjectCanvasView {...canvas} />
            )}
          </div>
          <ObjectList objects={objects ?? []} onSelect={selectObject} />
          <button
            type="button"
            className="vk-btn plw-details-toggle"
            onClick={() => {
              setOverlayObject(undefined)
              setOverlayOpen(true)
            }}
          >
            Inspector
          </button>
        </div>
        <aside className="plw-inspector" aria-label="Pipeline details">
          <InspectorTabs tabs={inspectorTabs} idPrefix="plw-side" />
        </aside>
      </div>
      {runStrip === undefined ? null : <BottomRunStrip {...runStrip} />}
      <Modal
        open={overlayOpen}
        onClose={() => {
          setOverlayOpen(false)
          setOverlayObject(undefined)
        }}
        title={overlayObjectTitle ?? 'Pipeline details'}
        closeLabel="Close"
      >
        <InspectorTabs tabs={inspectorTabs} idPrefix="plw-overlay" />
      </Modal>
    </Surface>
  )
}
