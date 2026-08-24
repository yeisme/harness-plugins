import { useEffect, useState, useRef, type CSSProperties } from 'react'
import {
  IconAgentPresetOutline16, IconRefreshOutline16, IconWarningOutline16, IconCheckOutline16, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { OrdoAgentOpsKey } from './locales.ts'
import type { OrdoAgentOpsPanelFace } from './slots.ts'
import type { OrdoAgentOpsSnapshot, OrdoAgentOpsActionDescriptor } from './contracts.ts'

/** sidebar footer action 拼合后的完整 props。 */
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

const styles: Record<'layer' | 'panel' | 'header' | 'body' | 'status' | 'detail' | 'actions' | 'button' | 'action' | 'badge' | 'drawer' | 'drawerItem' | 'expires', CSSProperties> = {
  layer: { position: 'relative', display: 'grid', gap: 6, width: '100%', padding: 4 },
  panel: { display: 'grid', gap: 8, padding: 10, borderRadius: 8, border: '1px solid var(--dsh-color-border, #3d4550)', background: 'var(--dsh-color-layer, #18202b)' },
  header: { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 },
  body: { display: 'grid', gap: 8, fontSize: 12 },
  status: { display: 'flex', alignItems: 'center', gap: 6 },
  detail: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, overflowWrap: 'anywhere' },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  button: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minHeight: 32 },
  action: { display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 28 },
  badge: { fontSize: 10, opacity: 0.72 },
  drawer: { display: 'grid', gap: 4, padding: 8, borderRadius: 6, background: 'var(--dsh-color-layer-secondary, #1a2530)' },
  drawerItem: { display: 'grid', gap: 2, fontSize: 11 },
  expires: { fontSize: 10, opacity: 0.8, fontStyle: 'italic' },
}

/**
 * 渲染操作描述符的抽屉项，包含完整的 a11y 支持。
 */
function ActionDrawerItem({ action, t }: { action: OrdoAgentOpsActionDescriptor; t: (key: OrdoAgentOpsKey) => string }) {
  const isExpired = Date.parse(action.expiresAt) <= Date.now()
  const actionLabel = ACTION_TYPE_LABELS[action.actionType] ?? 'panel.actionUnknown'

  return (
    <div
      style={styles.drawerItem}
      data-ordo-agent-ops-action-item={action.actionType}
      role="listitem"
      aria-label={`${t(actionLabel)}: ${action.safeEffect}`}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
        <strong>{t(actionLabel)}</strong>
        {isExpired && <span style={styles.badge}>({t('panel.actionExpired')})</span>}
      </div>
      <div>{action.safeEffect}</div>
      <div style={styles.expires} aria-live="polite">
        {t('panel.actionTarget')} {action.targetRef} • {t('panel.actionExpires')} {action.expiresAt}
      </div>
    </div>
  )
}

/**
 * 官方 sidebar slot 中的紧凑值班摘要。它只展示 Host 安全投影，不读取 Web Shell
 * DOM、不修改 grid，也不创建浏览器侧 Ordo domain store。
 */
export function OrdoAgentOpsSidebar({ wide, useState: useAgentOpsState, refresh, t }: OrdoAgentOpsSidebarProps) {
  const state = useAgentOpsState(snapshot => snapshot)
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => { void refresh() }, [refresh])

  // 键盘导航：Escape 关闭面板
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // 面板打开时聚焦第一个可交互元素
  useEffect(() => {
    if (open && panelRef.current) {
      const firstFocusable = panelRef.current.querySelector('button') as HTMLButtonElement | null
      firstFocusable?.focus()
    }
  }, [open])

  const projectionState = state.snapshot?.state
  const statusLabel = projectionState === undefined
    ? state.phase === 'loading' ? t('panel.loading') : t('panel.cold')
    : t(STATE_LABELS[projectionState]!)
  const dotState = projectionState === 'ready'
    ? 'ongoing'
    : projectionState === 'permission_denied' || state.phase === 'error' ? 'error' : 'warning'

  const availableActions = state.snapshot?.actions?.filter(
    action => Date.parse(action.expiresAt) > Date.now()
  ) ?? []
  const hasPendingActions = availableActions.length > 0

  return (
    <div style={styles.layer} data-ordo-agent-ops-sidebar>
      {open && (
        <section
          ref={panelRef}
          style={styles.panel}
          aria-label={t('panel.aria')}
          role="region"
          aria-live="polite"
        >
          <header style={styles.header}>
            <IconAgentPresetOutline16 size={16} aria-hidden="true" />
            <span>{t('panel.title')}</span>
          </header>
          <div style={styles.body}>
            <div style={styles.status} aria-live="polite" role="status">
              <StateDot state={dotState} aria-hidden="true" />
              <span data-ordo-agent-ops-status>{statusLabel}</span>
            </div>
            {state.snapshot?.state === 'needs_contract' && (
              <div style={styles.detail} data-ordo-agent-ops-needs-contract role="alert">
                <IconWarningOutline16 size={14} aria-hidden="true" />
                <span>{t('panel.needsContractDetail')}</span>
              </div>
            )}
            {state.snapshot?.run === undefined && state.phase === 'ready' && (
              <div style={styles.detail} role="note">{t('panel.noRun')}</div>
            )}
            {state.snapshot?.run !== undefined && (
              <div style={styles.detail} role="note">
                <span>{state.snapshot.run.safeTitle}</span>
                <span>{`${state.snapshot.run.completedTaskCount}/${state.snapshot.run.taskCount}`}</span>
              </div>
            )}
            {state.snapshot?.capacity !== undefined && (
              <div style={styles.detail} role="note">
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
              <div style={styles.detail} role="alert" aria-live="assertive">
                {t('panel.error', { code: state.errorCode })}
              </div>
            )}

            {/* Pending actions drawer */}
            {hasPendingActions && (
              <div
                style={styles.drawer}
                data-ordo-agent-ops-actions-drawer
                role="list"
                aria-label={t('panel.actionsTitle')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600 }}>
                  <IconCheckOutline16 size={14} aria-hidden="true" />
                  <span>{t('panel.actionsTitle')}</span>
                </div>
                {availableActions.map(action => (
                  <ActionDrawerItem key={action.decisionRef} action={action} t={t} />
                ))}
                <button
                  type="button"
                  style={Object.assign({}, styles.action, { width: '100%', marginTop: 4 })}
                  disabled={state.phase === 'loading'}
                  aria-label={t('panel.viewAllActions')}
                >
                  {t('panel.viewAllActions')}
                </button>
              </div>
            )}

            <div style={styles.actions} role="toolbar" aria-label={t('panel.title')}>
              <button
                type="button"
                style={styles.action}
                onClick={() => { void refresh() }}
                disabled={state.phase === 'loading'}
                aria-label={t('panel.refresh')}
              >
                <IconRefreshOutline16 size={14} aria-hidden="true" />
                {t('panel.refresh')}
              </button>
              <button
                type="button"
                style={styles.action}
                disabled
                title={t('panel.openStudioUnavailable')}
                aria-label={t('panel.openStudioUnavailable')}
              >
                {t('panel.openStudio')}
              </button>
            </div>
          </div>
        </section>
      )}
      <button
        ref={triggerRef}
        type="button"
        style={styles.button}
        data-active={open || undefined}
        data-ordo-agent-ops-trigger
        aria-label={t('panel.aria')}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => { setOpen(value => !value) }}
      >
        <IconAgentPresetOutline16 size={wide ? 16 : 18} aria-hidden="true" />
        {wide && <span>{t('panel.trigger')}</span>}
        {wide && projectionState === 'needs_contract' && <span style={styles.badge}>needs_contract</span>}
        {wide && hasPendingActions && <span style={styles.badge}>{availableActions.length}</span>}
      </button>
    </div>
  )
}
