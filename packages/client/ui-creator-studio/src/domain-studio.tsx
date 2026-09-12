import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { Surface, SurfaceContextBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { CreatorOwnerProjectionV1, ScaenaTableResult } from '@yeisme/dsh-creator-studio-host/contracts'
import { CreatorActionComposer } from './projection-components.tsx'
import { CreatorMediaView, WorkspaceView, type CreatorStudioViewProps } from './views.tsx'
import { defaultCreatorStudioTranslator } from './locales.ts'
import { creatorStudioStyles } from './styles.ts'
import { OperationRecoveryNotice } from './operation-recovery-notice.tsx'

/** Domain workspaces share commands and media, but never the cross-domain navigation shell. */
export function DomainStudioView(props: CreatorStudioViewProps & { owner: 'eikona' | 'scaena' }): ReactNode {
  const { controller, owner: ownerId, t = defaultCreatorStudioTranslator } = props
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot, controller.store.getSnapshot)
  const snapshot = state.snapshot
  const [dirty, setDirty] = useState(false)
  const onDirty = useCallback((value: boolean) => { setDirty(value); props.onDirty?.(value) }, [props.onDirty])
  const owner = snapshot?.owners.find(item => item.owner === ownerId)
  const disconnected = state.errorCode === 'gateway/service-unavailable' || snapshot?.reasonCode === 'context_unavailable'
  return <Surface kind="workspace" className="cs-shell cs-domain-studio" data-creator-studio data-domain-studio={ownerId} data-phase={state.phase}>
    <style>{creatorStudioStyles}</style>
    <SurfaceContextBar title={t(`studio.${ownerId}`)} context={snapshot?.context?.projectRef}
      actions={<Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" onClick={() => void controller.refresh()}>{t('state.refresh')}</Button>} />
    {state.phase === 'error' && snapshot !== null && <SurfaceState phase="stale" title={t('studio.connection')} description={t(state.errorCode === 'pane_binding_changed' ? 'studio.bindingChanged' : 'studio.unavailable')}
      {...(state.errorCode === 'pane_binding_changed' ? { action: <Button className="cs-button vk-btn" type="button" disabled={dirty} title={dirty ? t('studio.saveBeforeSwitch') : undefined} onClick={() => { controller.reset(); void controller.refresh() }}>{t('studio.rebind')}</Button> } : {})} />}
    {snapshot === null || owner === undefined || snapshot.context === undefined
      ? <SurfaceState phase={state.phase === 'loading' ? 'loading' : 'empty'} title={t(state.phase === 'loading' ? 'studio.loading' : 'studio.connection')}
          description={t(disconnected ? 'studio.contextMissing' : 'studio.unavailable')}
          action={<Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" onClick={() => void controller.refresh()}>{t('state.retry')}</Button>} />
      : ownerId === 'eikona'
        ? <WorkspaceView key={JSON.stringify(snapshot.context)} professional meta={{ titleKey: 'mode.visual', descriptionKey: 'mode.visual.description', owner: 'eikona', task: 'image' }}
            owner={owner} snapshot={snapshot} state={state} controller={controller} pane={props.pane} t={t}
            onDirty={onDirty}
            {...(props.composerBridge === undefined ? {} : { composerBridge: props.composerBridge })} />
        : <ScaenaWorkspace key={JSON.stringify(snapshot.context)} {...props} onDirty={onDirty} owner={owner} />}
  </Surface>
}

function ScaenaWorkspace({ owner, controller, t = defaultCreatorStudioTranslator, onDirty }: CreatorStudioViewProps & { owner: CreatorOwnerProjectionV1 }): ReactNode {
  const state = useSyncExternalStore(controller.store.subscribe, controller.store.getSnapshot, controller.store.getSnapshot)
  const [dirty, setDirty] = useState(false)
  const reportDirty = useCallback((value: boolean) => { setDirty(value); onDirty?.(value) }, [onDirty])
  const snapshot = state.snapshot!
  const [selected, setSelected] = useState<string>()
  const [packageRef, setPackageRef] = useState(''), [opening, setOpening] = useState(false), [openFailed, setOpenFailed] = useState(false)
  const [cursors, setCursors] = useState<Array<string | undefined>>([undefined])
  const [sourceKind, setSourceKind] = useState<'package' | 'table'>('package')
  const [table, setTable] = useState<Extract<ScaenaTableResult, { status: 'ready' }>['view']>()
  const inputId = useId(), live = useRef(true), inFlight = useRef(false)
  useEffect(() => { live.current = true; return () => { live.current = false } }, [])
  const resources = owner.resources.filter(item => !item.kind.endsWith('capability'))
  const resource = resources.find(item => item.ref === selected)
  const currentOwner = { ...owner, actions: owner.actions.filter(action => resource === undefined || action.targetRef === resource.ref || action.targetRef === snapshot.context?.projectRef || action.targetRef === table?.breakdown_ref) }
  const lastRefresh = useRef<string>()
  useEffect(() => {
    const receipt = state.lastReceipt
    if (!table || !receipt || receipt.status !== 'completed' || lastRefresh.current === receipt.receiptRef || !receipt.actionId?.startsWith('scaena.table.')) return
    lastRefresh.current = receipt.receiptRef
    void controller.readScaenaTable({ breakdownRef: table.breakdown_ref, ...(selected ? { shotRef: selected } : {}) }).then(result => {
      if (live.current && result.status === 'ready') setTable(result.view)
    })
  }, [state.lastReceipt, table, selected, controller])
  return <div className="cs-scaena-grid" data-scaena-workspace>
    <SurfaceSection className="cs-scaena-tree" title={t('studio.shots')}>
      <form onSubmit={async event => {
        event.preventDefault()
        if (dirty || inFlight.current || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(packageRef)) return
        inFlight.current = true; setOpening(true); setOpenFailed(false)
        const result = sourceKind === 'package' ? await controller.selectScaenaPackage({ packageRef }) : await controller.readScaenaTable({ breakdownRef: packageRef })
        inFlight.current = false
        if (live.current) { setOpening(false); setOpenFailed(result.status !== 'ready'); if (result.status === 'ready') { setSelected(undefined); setCursors([undefined]); setTable('view' in result ? result.view : undefined) } }
      }}>
        <label className="cs-field ys-field" htmlFor={`${inputId}-kind`}>{t('studio.sourceKind')}<select id={`${inputId}-kind`} value={sourceKind} disabled={opening || dirty} onChange={event => setSourceKind(event.target.value as 'package' | 'table')}><option value="package">{t('studio.productionPackage')}</option><option value="table">{t('studio.storyboardTable')}</option></select></label>
        <label className="cs-field ys-field" htmlFor={inputId}>{t(sourceKind === 'package' ? 'studio.packageRef' : 'studio.breakdownRef')}<Input id={inputId} value={packageRef} maxLength={256} disabled={opening || dirty} onChange={event => setPackageRef(event.target.value)} /></label>
        <Button className="cs-button vk-btn" type="submit" size="sm" variant="toolbar" disabled={opening || dirty || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/u.test(packageRef)}>{t(sourceKind === 'package' ? 'studio.openPackage' : 'studio.openTable')}</Button>
        {openFailed && <p role="status">{t('studio.packageUnavailable')}</p>}
      </form>
      {resources.length === 0 && <SurfaceState phase="empty" title={t('studio.emptyShots')} description={owner.summary} />}
      <div className="cs-shot-list">{resources.map(item => <Button className="cs-button vk-btn" key={item.ref} type="button" size="sm" variant="toolbar" data-kind={item.kind} disabled={opening || dirty} aria-pressed={selected === item.ref} onClick={async () => {
        if (!table || item.kind !== 'shot') { setSelected(item.ref); return }
        setOpening(true)
        const result = await controller.readScaenaTable({ breakdownRef: table.breakdown_ref, shotRef: item.ref, ...(cursors.at(-1) ? { continuation: cursors.at(-1)! } : {}) })
        if (live.current) { setOpening(false); if (result.status === 'ready') { setTable(result.view); setSelected(item.ref) } else setOpenFailed(true) }
      }}>
        <span>{item.title}</span><small>{item.status}</small>
      </Button>)}</div>
    </SurfaceSection>
    <SurfaceSection className="cs-professional-stage" title={resource?.title ?? t('studio.preview')}>
      {table ? <div className="cs-scaena-table"><table><thead><tr><th>{t('studio.shots')}</th>{table.columns.slice(0, 4).map(column => <th key={column.field}>{column.label ?? column.field}</th>)}</tr></thead><tbody>{table.shots.filter(row => !selected || row.shot_ref === selected).map(row => <tr key={row.shot_ref}><th>{row.shot_ref}</th>{table.columns.slice(0, 4).map(column => <td key={column.field}>{row.cells[column.field] ?? '—'}</td>)}</tr>)}</tbody></table>
        {table.truncated && <p>{t('studio.moreShots')}</p>}
        <div className="cs-actions">{(cursors.length > 1 || table.continuation) && <>
          <Button className="cs-button vk-btn" type="button" disabled={opening || dirty || cursors.length <= 1} onClick={async () => {
            const next = cursors.slice(0, -1), continuation = next.at(-1)
            setOpening(true)
            const result = await controller.readScaenaTable({ breakdownRef: table.breakdown_ref, ...(continuation ? { continuation } : {}) })
            if (live.current) { setOpening(false); if (result.status === 'ready') { setCursors(next); setTable(result.view); setSelected(undefined) } else setOpenFailed(true) }
          }}>{t('eikona.previousAssets')}</Button>
          <Button className="cs-button vk-btn" type="button" disabled={opening || dirty || !table.continuation} onClick={async () => {
            if (!table.continuation || cursors.includes(table.continuation)) return
            const continuation = table.continuation
            setOpening(true)
            const result = await controller.readScaenaTable({ breakdownRef: table.breakdown_ref, continuation })
            if (live.current) { setOpening(false); if (result.status === 'ready') { setCursors([...cursors, continuation]); setTable(result.view); setSelected(undefined) } else setOpenFailed(true) }
          }}>{t('eikona.nextAssets')}</Button>
        </>}</div></div>
        : resource?.artifact === undefined ? <SurfaceState phase="empty" title={resource?.title ?? t('studio.selectShot')} description={resource?.summary} />
        : <CreatorMediaView artifact={resource.artifact} controller={controller} t={t} />}
    </SurfaceSection>
    <SurfaceSection className="cs-professional-inspector" title={t('studio.properties')}>
      <CreatorActionComposer owner={currentOwner} task="video" snapshot={snapshot} state={state} controller={controller} t={t}
        onDirty={reportDirty} />
      <OperationRecoveryNotice owner={owner} runtime={controller} receiptRevision={JSON.stringify(state.lastReceipt)} t={t} />
    </SurfaceSection>
    <SurfaceSection className="cs-professional-library" title={t('studio.sequence')}>
      {table && <ol className="cs-shot-sequence">{table.shots.map(shot => <li key={shot.shot_ref}><strong>{shot.shot_ref}</strong><span>{shot.planned_duration_micros === undefined ? '—' : `${shot.planned_duration_micros / 1000000}s`}</span></li>)}</ol>}
      {snapshot.production?.stages.map(stage => <div className="ys-row" key={stage.id}><strong>{stage.label}</strong><span>{stage.status}</span></div>)}
      <CreatorActionComposer owner={owner} task="video" presentationGroup="export" snapshot={snapshot} state={state} controller={controller} t={t} />
    </SurfaceSection>
  </div>
}
