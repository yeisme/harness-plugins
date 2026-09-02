import { useEffect, useRef, useState } from 'react'
import {
  Button,
  IconAgentPresetOutline16,
  IconCheckOutline16,
  IconRefreshOutline16,
  IconWarningOutline16,
  StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import {
  Surface,
  SurfaceActionBar,
  SurfaceContextBar,
  SurfaceSection,
  SurfaceState,
} from '@yeisme/dsh-client-ui-surface'
import type { OrdoAgentOpsActionDescriptor, OrdoAgentOpsSnapshot } from './contracts.ts'
import type { OrdoAgentOpsKey } from './locales.ts'
import type { OrdoAgentOpsPanelFace } from './slots.ts'

export type OrdoAgentOpsSidebarProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<OrdoAgentOpsPanelFace> & PropsLocale<'ordoAgentOps'>

const STATE_LABELS: Record<OrdoAgentOpsSnapshot['state'], OrdoAgentOpsKey> = {
  needs_contract: 'panel.needsContract',
  ready: 'panel.ready',
  stale: 'panel.stale',
  offline: 'panel.offline',
  permission_denied: 'panel.permissionDenied',
  contract_mismatch: 'panel.contractMismatch',
}

const ACTION_TYPE_LABELS: Record<string, OrdoAgentOpsKey> = {
  'ordo.reconcile.request': 'panel.actionReconcile',
  'ordo.agent.approve': 'panel.actionApprove',
  'ordo.agent.launch': 'panel.actionLaunch',
}

const ORDO_STYLES = `
[data-ordo-agent-ops-sidebar]{position:relative;display:inline-grid;width:auto;min-height:0;overflow:visible}
[data-ordo-agent-ops-sidebar] .oao-panel{position:absolute;right:0;bottom:calc(100% + 6px);z-index:20;width:min(360px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 32px));box-shadow:0 16px 48px color-mix(in srgb,#000 44%,transparent)}
[data-ordo-agent-ops-sidebar] .oao-panel-body{gap:10px}
[data-ordo-agent-ops-sidebar] .oao-status{display:flex;align-items:center;gap:6px}
[data-ordo-agent-ops-sidebar] .oao-detail{display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0;overflow-wrap:anywhere}
[data-ordo-agent-ops-sidebar] .oao-detail>span:first-child{min-width:0}
[data-ordo-agent-ops-sidebar] .oao-drawer{display:grid;gap:7px;padding:9px;border:1px solid var(--vk-border-l1);border-radius:var(--vk-radius-md);background:var(--vk-bg-layer-2)}
[data-ordo-agent-ops-sidebar] .oao-drawer-title{display:flex;align-items:center;gap:4px;font-weight:650}
[data-ordo-agent-ops-sidebar] .oao-drawer-item{display:grid;gap:3px;font-size:11px}
[data-ordo-agent-ops-sidebar] .oao-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:4px}
[data-ordo-agent-ops-sidebar] .oao-muted{color:var(--vk-text-tertiary);font-size:10px}
[data-ordo-agent-ops-sidebar] .oao-trigger{display:inline-flex;width:32px;min-width:32px;height:32px;min-height:32px;align-items:center;justify-content:center;padding:0;border-radius:8px}
[data-ordo-agent-ops-sidebar] .oao-badge{font-size:10px;color:var(--vk-text-tertiary)}
@container yeisme-surface (max-width:420px){[data-ordo-agent-ops-sidebar] .oao-panel{position:fixed;inset:auto 8px 56px 8px;width:auto}}
`

function ActionDrawerItem({ action, t }: { action: OrdoAgentOpsActionDescriptor; t: (key: OrdoAgentOpsKey) => string }) {
  const isExpired = Date.parse(action.expiresAt) <= Date.now()
  const actionLabel = ACTION_TYPE_LABELS[action.actionType] ?? 'panel.actionUnknown'

  return (
    <div
      className="oao-drawer-item"
      data-ordo-agent-ops-action-item={action.actionType}
      role="listitem"
      aria-label={`${t(actionLabel)}: ${action.safeEffect}`}
    >
      <div className="oao-drawer-head">
        <strong>{t(actionLabel)}</strong>
        {isExpired && <span className="oao-badge">({t('panel.actionExpired')})</span>}
      </div>
      <div>{action.safeEffect}</div>
      <div className="oao-muted" aria-live="polite">
        {t('panel.actionTarget')} {action.targetRef} • {t('panel.actionExpires')} {action.expiresAt}
      </div>
    </div>
  )
}

/**
 * 官方 sidebar slot 中的紧凑值班摘要。它只展示 Host 安全投影，不读取 Web Shell
 * DOM、不修改 grid，也不创建浏览器侧 Ordo domain store。
 */
export function OrdoAgentOpsSidebar({ wide, useState: useAgentOpsState, refresh, openAgentsPane, t }: OrdoAgentOpsSidebarProps) {
  const state = useAgentOpsState(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.querySelector('button')?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  useEffect(() => {
    if (!open) return
    const firstFocusable = panelRef.current?.querySelector('button') as HTMLButtonElement | null
    firstFocusable?.focus()
  }, [open])

  const projectionState = state.snapshot?.state
  const statusLabel = projectionState === undefined
    ? state.phase === 'loading' ? t('panel.loading') : t('panel.cold')
    : t(STATE_LABELS[projectionState])
  const dotState = projectionState === 'ready'
    ? 'ongoing'
    : projectionState === 'permission_denied' || state.phase === 'error' ? 'error' : 'warning'
  const availableActions = state.snapshot?.actions?.filter(action => Date.parse(action.expiresAt) > Date.now()) ?? []
  const hasPendingActions = availableActions.length > 0

  return (
    <Surface kind="micro" className="oao-layer" data-ordo-agent-ops-sidebar data-wide={String(wide)}>
      <style data-ordo-agent-ops-styles>{ORDO_STYLES}</style>
      {open && (
        <Surface kind="inspector" className="oao-panel" aria-label={t('panel.aria')} aria-live="polite">
          <div ref={panelRef}>
            <SurfaceContextBar
              title={t('panel.title')}
              status={<span className="oao-status" role="status" aria-live="polite">
                <StateDot state={dotState} aria-hidden="true" />
                <span data-ordo-agent-ops-status>{statusLabel}</span>
              </span>}
              actions={<Button
                type="button"
                onClick={() => { void refresh() }}
                disabled={state.phase === 'loading'}
                aria-label={t('panel.refresh')}
              >
                <IconRefreshOutline16 size={14} aria-hidden="true" />
                {t('panel.refresh')}
              </Button>}
            />
            <div className="ys-body oao-panel-body">
              {state.phase === 'loading' && state.snapshot === undefined
                ? <SurfaceState phase="loading" title={t('panel.loading')} />
                : null}
              {state.snapshot?.state === 'needs_contract' && (
                <SurfaceState
                  phase="disabled"
                  title={t('panel.needsContract')}
                  description={<span data-ordo-agent-ops-needs-contract><IconWarningOutline16 size={14} aria-hidden="true" /> {t('panel.needsContractDetail')}</span>}
                />
              )}
              {state.snapshot?.state === 'offline' && (
                <SurfaceState
                  phase="disabled"
                  title={t('panel.offline')}
                  description={<span data-ordo-agent-ops-offline><IconWarningOutline16 size={14} aria-hidden="true" /> {state.snapshot.safeMessage}</span>}
                />
              )}
              {state.snapshot?.run === undefined && state.phase === 'ready' && state.snapshot?.state === 'ready' && (
                <div className="oao-detail" role="note">{t('panel.noRun')}</div>
              )}
              {state.snapshot?.run !== undefined && (
                <div className="oao-detail" role="note">
                  <span>{state.snapshot.run.safeTitle}</span>
                  <span>{`${state.snapshot.run.completedTaskCount}/${state.snapshot.run.taskCount}`}</span>
                </div>
              )}
              {state.snapshot?.capacity !== undefined && (
                <div className="oao-detail" role="note">
                  <span>{t('panel.capacity', {
                    observed: state.snapshot.capacity.observedOrRetained,
                    policy: state.snapshot.capacity.policyCap,
                  })}</span>
                  <span>{state.snapshot.capacity.reservationState === 'not_reserved'
                    ? t('panel.capacityUnreserved')
                    : state.snapshot.capacity.reservationState}</span>
                </div>
              )}
              {state.errorCode !== null && (
                <SurfaceState phase="error" title={t('panel.error', { code: state.errorCode })} />
              )}
              {hasPendingActions && (
                <SurfaceSection title={t('panel.actionsTitle')}>
                  <div className="oao-drawer" data-ordo-agent-ops-actions-drawer role="list" aria-label={t('panel.actionsTitle')}>
                    <div className="oao-drawer-title">
                      <IconCheckOutline16 size={14} aria-hidden="true" />
                      <span>{t('panel.actionsTitle')}</span>
                    </div>
                    {availableActions.map(action => <ActionDrawerItem key={action.decisionRef} action={action} t={t} />)}
                    <Button type="button" disabled={state.phase === 'loading'} aria-label={t('panel.viewAllActions')}>
                      {t('panel.viewAllActions')}
                    </Button>
                  </div>
                </SurfaceSection>
              )}
            </div>
            <SurfaceActionBar>
              <Button type="button" disabled title={t('panel.openStudioUnavailable')} aria-label={t('panel.openStudioUnavailable')}>
                {t('panel.openStudio')}
              </Button>
            </SurfaceActionBar>
          </div>
        </Surface>
      )}
      <div ref={triggerRef}>
        <Button
          type="button"
          className="oao-trigger"
          data-active={open || undefined}
          data-ordo-agent-ops-trigger
          aria-label={t('panel.aria')}
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => {
            if (openAgentsPane?.() === true) {
              setOpen(false)
              return
            }
            setOpen(value => !value)
          }}
        >
          <IconAgentPresetOutline16 size={18} aria-hidden="true" />
        </Button>
      </div>
    </Surface>
  )
}
