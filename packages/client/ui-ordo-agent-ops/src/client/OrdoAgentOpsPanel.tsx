import { useEffect, useState } from 'react'
import {
  IconAgentPresetOutline16, IconRefreshOutline16, IconWarningOutline16, StateDot,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale, PropsRuntime, InjectFace } from '@deepseek-ai/dsh-client-ui-slots'
import type { OrdoAgentOpsSnapshot } from '@deepseek-ai/dsh-api-remotes/client'
import type { OrdoAgentOpsPanelFace } from './slots.ts'
import type { OrdoAgentOpsKey } from './locales.ts'
import css from './OrdoAgentOpsPanel.module.css'

/** Full props composed by the sidebar footer-action slot. */
export type OrdoAgentOpsPanelProps =
  PropsRuntime<'sidebar.footer.action'> & InjectFace<OrdoAgentOpsPanelFace> & PropsLocale<'ordoAgentOps'>

const STATE_LABELS: Record<OrdoAgentOpsSnapshot['state'], OrdoAgentOpsKey> = {
  needs_contract: 'panel.needsContract',
  ready: 'panel.ready',
  stale: 'panel.stale',
  offline: 'panel.offline',
  permission_denied: 'panel.permissionDenied',
  contract_mismatch: 'panel.contractMismatch',
}

/** Render one compact, read-only Agent Ops duty panel. */
export function OrdoAgentOpsPanel({ wide, useState: useAgentOpsState, refresh, t }: OrdoAgentOpsPanelProps) {
  const state = useAgentOpsState(snapshot => snapshot)
  const [open, setOpen] = useState(false)

  useEffect(() => { void refresh() }, [refresh])

  const projectionState = state.snapshot?.state
  const statusLabel = projectionState === undefined
    ? state.phase === 'loading' ? t('panel.loading') : t('panel.cold')
    : t(STATE_LABELS[projectionState])
  const dotState = projectionState === 'ready'
    ? 'ongoing'
    : projectionState === 'permission_denied' || state.phase === 'error' ? 'error' : 'warning'

  return (
    <div className={wide ? css.layer : `${css.layer} ${css.rail}`}>
      {open && (
        <section className={css.panel} data-ordo-agent-ops-panel aria-label={t('panel.aria')}>
          <header className={css.header}>
            <IconAgentPresetOutline16 size={16} />
            <span className={css.title}>{t('panel.title')}</span>
          </header>
          <div className={css.body}>
            <div className={css.status}>
              <StateDot state={dotState} />
              <span className={css.statusText} data-ordo-agent-ops-status>{statusLabel}</span>
            </div>
            {state.snapshot?.state === 'needs_contract' && (
              <div className={css.detail} data-ordo-agent-ops-needs-contract>
                <IconWarningOutline16 size={14} />
                <span>{t('panel.needsContractDetail')}</span>
              </div>
            )}
            {state.snapshot?.run === undefined && state.phase === 'ready' && (
              <div className={css.detail}>{t('panel.noRun')}</div>
            )}
            {state.snapshot?.run !== undefined && (
              <div className={css.detail}>
                <span>{state.snapshot.run.safeTitle}</span>
                <span>{`${state.snapshot.run.completedTaskCount}/${state.snapshot.run.taskCount}`}</span>
              </div>
            )}
            {state.snapshot?.capacity !== undefined && (
              <div className={css.detail}>
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
              <div className={`${css.detail} ${css.error}`} role="alert">
                {t('panel.error', { code: state.errorCode })}
              </div>
            )}
            <div className={css.actions}>
              <button type="button" className={css.action} onClick={() => { void refresh() }} disabled={state.phase === 'loading'}>
                <IconRefreshOutline16 size={14} />
                {t('panel.refresh')}
              </button>
              <button type="button" className={css.action} disabled title={t('panel.openStudioUnavailable')}>
                {t('panel.openStudio')}
              </button>
            </div>
          </div>
        </section>
      )}
      <button
        type="button"
        className={css.button}
        data-active={open || undefined}
        data-ordo-agent-ops-trigger
        aria-label={t('panel.aria')}
        aria-expanded={open}
        onClick={() => { setOpen(value => !value) }}
      >
        <IconAgentPresetOutline16 size={wide ? 16 : 18} />
        {wide && <span className={css.label}>{t('panel.trigger')}</span>}
        {wide && projectionState === 'needs_contract' && <span className={css.badge}>needs_contract</span>}
      </button>
    </div>
  )
}
