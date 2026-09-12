import type { CreatorArtifactContentV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import type { ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import { defaultCreatorStudioTranslator, type CreatorStudioTranslator, type CreatorStudioKey } from './locales.ts'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { AuctraRecoveryDrafts, type AuctraRecoveryDraftRow } from './auctra-recovery-drafts.tsx'
import type { CreatorStudioRuntimeV1 } from './runtime.ts'

export function AuctraRecoveryLoader({ runtime, artifact, blocked, base, content, canSave = false, onRestore, t = defaultCreatorStudioTranslator }: {
 runtime: Pick<CreatorStudioRuntimeV1, 'listAuctraRecoveryDrafts' | 'readAuctraRecoveryDraft' | 'saveAuctraRecoveryDraft'>
 base?: CreatorArtifactContentV1; content?: string; canSave?: boolean; artifact: ArtifactRefV1; t?: CreatorStudioTranslator; blocked: boolean; onRestore(draft: AuctraRecoveryDraftRow, content: string): void
}) {
 const [drafts, setDrafts] = useState<AuctraRecoveryDraftRow[]>([])
 const [message, setMessage] = useState<CreatorStudioKey | undefined>()
 const [loading, setLoading] = useState(false)
 const [cursor, setCursor] = useState<string>()
 const [previous, setPrevious] = useState<AuctraRecoveryDraftRow>()
 const [uncertain, setUncertain] = useState(false)
 const alive = useRef(true), flight = useRef(false)
 useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
 const load = async (next?: string) => {
  if (blocked || flight.current || !runtime.listAuctraRecoveryDrafts) return
  flight.current = true; setLoading(true); setMessage(undefined)
  try {
   const result = await runtime.listAuctraRecoveryDrafts({ artifact, limit: 50, ...(next === undefined ? {} : { cursor: next }) })
   if (!alive.current) return
   if (result.status === 'ready') { setDrafts(result.value.drafts); setCursor(result.value.nextCursor) }
   else {
    if (result.status === 'permission_denied' || result.status === 'needs_contract') { setDrafts([]); setCursor(undefined); setPrevious(undefined); setUncertain(true) }
    setMessage('auctra.recovery.unavailable')
   }
  } catch { if (alive.current) setMessage('auctra.recovery.loadError') }
  finally { flight.current = false; if (alive.current) setLoading(false) }
 }
 const save = async () => {
  if (!base || content === undefined || blocked || !canSave || uncertain || flight.current || !runtime.saveAuctraRecoveryDraft) return
  flight.current = true; setLoading(true)
  try {
   const result = await runtime.saveAuctraRecoveryDraft({ base, content, ...(previous === undefined ? {} : { previous }) })
   if (!alive.current) return
   if (result.status === 'ready') { setPrevious(result.value.draft); setMessage('auctra.recovery.saved') }
   else { setUncertain(true); setMessage('auctra.recovery.saveUnknown') }
  } catch { if (alive.current) { setUncertain(true); setMessage('auctra.recovery.saveUnknown') } }
  finally { flight.current = false; if (alive.current) setLoading(false) }
 }
 if (!runtime.listAuctraRecoveryDrafts || !runtime.readAuctraRecoveryDraft) return null
 return <div data-auctra-recovery-loader>
  {runtime.saveAuctraRecoveryDraft && <Button className="cs-button vk-btn" type="button" disabled={blocked || loading || !canSave || !base || content === undefined || uncertain} onClick={() => void save()}>{t(loading ? 'auctra.recovery.saving' : 'auctra.recovery.save')}</Button>}
  <Button className="cs-button vk-btn" type="button" disabled={blocked || loading} onClick={() => void load()}>{t('auctra.recovery.find')}</Button>
  {cursor && <Button className="cs-button vk-btn" type="button" disabled={blocked || loading} onClick={() => void load(cursor)}>{t('auctra.recovery.next')}</Button>}
  {message && <p role="status">{t(message)}</p>}
  <AuctraRecoveryDrafts t={t} drafts={drafts} busy={blocked || loading} onRead={async draft => {
   const result = await runtime.readAuctraRecoveryDraft!(draft)
   if (alive.current && result.status === 'ready' && result.value.draft.baseVersion === artifact.version) { setPrevious(result.value.draft); setUncertain(false) }
   return alive.current && result.status === 'ready' ? result.value : undefined
  }} onRestore={onRestore} />
 </div>
}
