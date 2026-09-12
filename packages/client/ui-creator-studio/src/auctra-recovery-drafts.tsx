import { defaultCreatorStudioTranslator, type CreatorStudioTranslator } from './locales.ts'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'

export interface AuctraRecoveryDraftRow {
  readonly ref: string; readonly unitRef: string; readonly baseVersion: string; readonly revision: number
  readonly contentDigest: string; readonly byteLength: number; readonly updatedAt: string
}
export type AuctraRecoveryDraftResult = { readonly drafts: readonly AuctraRecoveryDraftRow[]; readonly nextCursor?: string }
export type AuctraRecoveryDraftRead = { readonly content: string; readonly sourceChanged: boolean; readonly currentSourceVersion: string }
export interface AuctraRecoveryDraftsProps {
  readonly drafts: AuctraRecoveryDraftRow[]
  readonly busy?: boolean
  readonly onRead: (draft: AuctraRecoveryDraftRow) => Promise<AuctraRecoveryDraftRead | undefined>
  readonly onRestore: (draft: AuctraRecoveryDraftRow, content: string) => void
  readonly scopeKey?: string
  readonly t?: CreatorStudioTranslator
  readonly label?: string
}

/** Metadata-first recovery surface. Reading and restoring are separate explicit actions. */
export function AuctraRecoveryDrafts(props: AuctraRecoveryDraftsProps): ReactNode {
  const key = JSON.stringify([props.scopeKey, props.drafts])
  return <RecoveryDraftList key={key} {...props} />
}

function RecoveryDraftList({ drafts, busy = false, onRead, onRestore, label, t = defaultCreatorStudioTranslator }: AuctraRecoveryDraftsProps): ReactNode {
  const mounted = useRef(true)
  const inFlight = useRef(false)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const [reading, setReading] = useState<string | undefined>()
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<{ draft: AuctraRecoveryDraftRow; read: AuctraRecoveryDraftRead } | undefined>()
  const read = async (draft: AuctraRecoveryDraftRow) => {
    if (busy || inFlight.current) return
    inFlight.current = true
    setSelected(undefined); setReading(draft.ref); setError(false)
    try {
      const result = await onRead(draft)
      if (!mounted.current) return
      if (result === undefined) setError(true)
      else setSelected({ draft, read: result })
    } catch { if (mounted.current) setError(true) } finally { inFlight.current = false; if (mounted.current) setReading(undefined) }
  }
  return <section className="cs-section" data-auctra-recovery-drafts aria-label={label ?? t('auctra.recovery.title')}>
    <header className="cs-section-header"><strong>{label ?? t('auctra.recovery.title')}</strong><span className="cs-badge">{drafts.length}</span></header>
    {drafts.length === 0 ? <p className="cs-muted">{t('auctra.recovery.empty')}</p> : <ul className="cs-list ys-list">
      {drafts.map(draft => <li className="ys-row" key={draft.ref} data-recovery-ref={draft.ref}>
        <span className="ys-row-main"><strong>{draft.unitRef}</strong><small>r{draft.revision} · {draft.byteLength} bytes · {draft.updatedAt}</small></span>
        <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={busy || reading !== undefined} onClick={() => void read(draft)}>{t(reading === draft.ref ? 'auctra.recovery.reading' : 'auctra.recovery.read')}</Button>
      </li>)}
    </ul>}
    {error && <p className="cs-error" role="alert">{t('auctra.recovery.readError')}</p>}
    {selected !== undefined && <div className="cs-recovery-preview" data-source-changed={selected.read.sourceChanged}>
      <p className="cs-muted">{t('auctra.recovery.source', { version: selected.read.currentSourceVersion })}{selected.read.sourceChanged ? t('auctra.recovery.changed') : ''}</p>
      <pre>{selected.read.content}</pre>
      <Button className="cs-button vk-btn" type="button" size="sm" variant="toolbar" disabled={busy || reading !== undefined} onClick={() => onRestore(selected.draft, selected.read.content)}>{t('auctra.recovery.restore')}</Button>
    </div>}
  </section>
}
