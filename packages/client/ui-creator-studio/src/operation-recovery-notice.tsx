import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { CreatorOperationRecoveryPageV1, CreatorOwnerProjectionV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioRuntimeV1 } from './runtime.ts'
import type { CreatorStudioTranslator } from './locales.ts'

export function OperationRecoveryNotice({ owner, runtime, receiptRevision, t }: {
  readonly owner: CreatorOwnerProjectionV1
  readonly runtime: Pick<CreatorStudioRuntimeV1, 'listOperationRecoveries' | 'reconcileStoredOperation'>
  readonly receiptRevision: string
  readonly t: CreatorStudioTranslator
}) {
  const [page, setPage] = useState<CreatorOperationRecoveryPageV1>()
  const [loading, setLoading] = useState(false), [querying, setQuerying] = useState(false), [message, setMessage] = useState('')
  const generation = useRef(0), alive = useRef(true), busy = useRef(false)
  async function refresh() {
    const current = ++generation.current
    setLoading(true)
    try {
      const result = await runtime.listOperationRecoveries?.()
      if (alive.current && current === generation.current) setPage(result ?? { schemaVersion: 'creator.operation-recovery-page.v1alpha1', status: 'unavailable' })
    } catch { if (alive.current && current === generation.current) setPage({ schemaVersion: 'creator.operation-recovery-page.v1alpha1', status: 'unavailable' }) }
    finally { if (alive.current && current === generation.current) setLoading(false) }
  }
  useEffect(() => { alive.current = true; if (runtime.listOperationRecoveries && runtime.reconcileStoredOperation) void refresh(); return () => { alive.current = false; generation.current++ } }, [receiptRevision, runtime.listOperationRecoveries, runtime.reconcileStoredOperation])
  if (!runtime.listOperationRecoveries || !runtime.reconcileStoredOperation) return null
  const operations = page?.status === 'ready' ? page.operations.filter(item => item.request.owner === owner.owner) : []
  async function query(operation: (Extract<CreatorOperationRecoveryPageV1, { status: 'ready' }>['operations'])[number]) {
    if (busy.current) return
    busy.current = true; setQuerying(true)
    try {
      const result = await runtime.reconcileStoredOperation!(operation.request)
      if (!alive.current) return
      setMessage(t(result.status === 'completed' ? 'workspace.recovery.confirmed' : result.status === 'failed' ? 'workspace.recovery.failed' : 'workspace.recovery.uncertain'))
      await refresh()
    } catch { if (alive.current) setMessage(t('workspace.recovery.uncertain')) }
    finally { busy.current = false; if (alive.current) setQuerying(false) }
  }
  if (page?.status === 'ready' && operations.length === 0 && !loading) return message ? <p role="status" className="cs-muted">{message}</p> : null
  return <div data-creator-operation-recovery role="region" aria-label={t('workspace.recovery.title')} aria-busy={loading || querying}>
    <p className="cs-muted">{t('workspace.recovery.title')}</p>
    {page?.status === 'unavailable' && <SurfaceState phase="disabled" title={t('workspace.recovery.unavailable')} />}
    {loading && <span role="status">{t('workspace.recovery.loading')}</span>}
    {operations.map(operation => {
      const action = owner.actions.find(item => item.actionId === operation.request.actionId && item.targetRef === operation.request.expectedTargetRef)
      const artifact = owner.artifactWorkspace?.artifacts.find(item => item.artifact.ref === operation.request.expectedTargetRef)
      const eikonaTarget = operation.request.owner === 'eikona'
        ? /^eikona:\/\/artifacts\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})\/([A-Za-z0-9][A-Za-z0-9._-]{0,159})$/u.exec(operation.request.expectedTargetRef) : null
      const title = artifact?.artifact.title ?? (eikonaTarget ? `${eikonaTarget[1]} / ${eikonaTarget[2]}` : t('workspace.recovery.target'))
      const label = action?.label ?? (eikonaTarget && operation.request.actionId === 'candidate.adopt' ? t('workspace.recovery.adoptCandidate') : t('workspace.recovery.operation'))
      return <div className="cs-actions" key={operation.request.idempotencyKey}>
        <span className="cs-wrapping-content">{title} · {label}</span>
        <Button className="vk-btn" disabled={querying || loading} onClick={() => { void query(operation) }}>{t('workspace.recovery.query')}</Button>
      </div>
    })}
    <Button className="vk-btn" disabled={loading || querying} onClick={() => { void refresh() }}>{t('workspace.recovery.refresh')}</Button>
    {message && <p role="status" className="cs-muted">{message}</p>}
  </div>
}
