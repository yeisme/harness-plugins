import { useEffect, useState, type CSSProperties } from 'react'
import {
  IconAgentPresetOutline16, IconRefreshOutline16, IconWarningOutline16, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { OrdoAgentOpsKey } from './locales.ts'
import type { OrdoAgentOpsPanelFace } from './slots.ts'
import type { OrdoAgentOpsSnapshot } from './contracts.ts'

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

const styles: Record<'layer' | 'panel' | 'header' | 'body' | 'status' | 'detail' | 'actions' | 'button' | 'action' | 'badge', CSSProperties> = {
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
}

/**
 * 官方 sidebar slot 中的紧凑值班摘要。它只展示 Host 安全投影，不读取 Web Shell
 * DOM、不修改 grid，也不创建浏览器侧 Ordo domain store。
 */
export function OrdoAgentOpsSidebar({ wide, useState: useAgentOpsState, refresh, t }: OrdoAgentOpsSidebarProps) {
  const state = useAgentOpsState(snapshot => snapshot)
  const [open, setOpen] = useState(false)

  useEffect(() => { void refresh() }, [refresh])

  const projectionState = state.snapshot?.state
  const statusLabel = projectionState === undefined
    ? state.phase === 'loading' ? t('panel.loading') : t('panel.cold')
    : t(STATE_LABELS[projectionState]!)
  const dotState = projectionState === 'ready'
    ? 'ongoing'
    : projectionState === 'permission_denied' || state.phase === 'error' ? 'error' : 'warning'

  return (
    <div style={styles.layer} data-ordo-agent-ops-sidebar>
      {open && (
        <section style={styles.panel} aria-label={t('panel.aria')}>
          <header style={styles.header}>
            <IconAgentPresetOutline16 size={16} />
            <span>{t('panel.title')}</span>
          </header>
          <div style={styles.body}>
            <div style={styles.status} aria-live="polite">
              <StateDot state={dotState} />
              <span data-ordo-agent-ops-status>{statusLabel}</span>
            </div>
            {state.snapshot?.state === 'needs_contract' && (
              <div style={styles.detail} data-ordo-agent-ops-needs-contract>
                <IconWarningOutline16 size={14} />
                <span>{t('panel.needsContractDetail')}</span>
              </div>
            )}
            {state.snapshot?.run === undefined && state.phase === 'ready' && <div style={styles.detail}>{t('panel.noRun')}</div>}
            {state.snapshot?.run !== undefined && (
              <div style={styles.detail}>
                <span>{state.snapshot.run.safeTitle}</span>
                <span>{`${state.snapshot.run.completedTaskCount}/${state.snapshot.run.taskCount}`}</span>
              </div>
            )}
            {state.snapshot?.capacity !== undefined && (
              <div style={styles.detail}>
                <span>{t('panel.capacity', {
                  observed: state.snapshot.capacity.observedOrRetained,
                  policy: state.snapshot.capacity.policyCap,
                })}</span>
                <span>{state.snapshot.capacity.reservationState === 'not_reserved'
                  ? t('panel.capacityUnreserved')
                  : state.snapshot.capacity.reservationState}</span>
              </div>
            )}
            {state.errorCode !== null && <div style={styles.detail} role="alert">{t('panel.error', { code: state.errorCode })}</div>}
            <div style={styles.actions}>
              <button type="button" style={styles.action} onClick={() => { void refresh() }} disabled={state.phase === 'loading'}>
                <IconRefreshOutline16 size={14} />
                {t('panel.refresh')}
              </button>
              <button type="button" style={styles.action} disabled title={t('panel.openStudioUnavailable')}>
                {t('panel.openStudio')}
              </button>
            </div>
          </div>
        </section>
      )}
      <button
        type="button"
        style={styles.button}
        data-active={open || undefined}
        data-ordo-agent-ops-trigger
        aria-label={t('panel.aria')}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <IconAgentPresetOutline16 size={wide ? 16 : 18} />
        {wide && <span>{t('panel.trigger')}</span>}
        {wide && projectionState === 'needs_contract' && <span style={styles.badge}>needs_contract</span>}
      </button>
    </div>
  )
}
