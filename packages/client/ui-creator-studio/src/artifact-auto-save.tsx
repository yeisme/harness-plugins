import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CreatorStudioTranslator } from './locales.ts'

export const CREATOR_AUTO_SAVE_DELAY_MS = 800

/** Opt-in, view-local scheduling. The owner callback owns persistence and receipts. */
export function CreatorArtifactAutoSave({ available, blocked, dirty, revision, save, t }: {
  available: boolean; blocked: boolean; dirty: boolean; revision: string;
  save(): Promise<boolean>; t: CreatorStudioTranslator;
}) {
  const [enabled, setEnabled] = useState(false)
  const [paused, setPaused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cycle, setCycle] = useState(0)
  const busy = useRef(false)
  const mounted = useRef(true)
  const latestSave = useRef(save)
  latestSave.current = save
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useEffect(() => {
    if (!enabled || paused || !available || blocked || !dirty || busy.current) return
    const timer = window.setTimeout(() => {
      busy.current = true
      setSaving(true)
      void latestSave.current().then(confirmed => { if (mounted.current && !confirmed) setPaused(true) }).catch(() => { if (mounted.current) setPaused(true) }).finally(() => {
        busy.current = false
        if (mounted.current) { setSaving(false); setCycle(value => value + 1) }
      })
    }, CREATOR_AUTO_SAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [enabled, paused, available, blocked, dirty, revision, cycle])
  return <div className="cs-auto-save" data-creator-auto-save>
    <label className="cs-confirm"><input type="checkbox" checked={enabled} disabled={!available && !enabled} onChange={event => setEnabled(event.currentTarget.checked)} />{t('workspace.autoSave.enable')}</label>
    <small role="status">{t(!available ? 'workspace.autoSave.unavailable' : paused ? 'workspace.autoSave.paused' : saving ? 'workspace.autoSave.saving' : !enabled ? 'workspace.autoSave.off' : blocked ? 'workspace.autoSave.blocked' : dirty ? 'workspace.autoSave.waiting' : 'workspace.autoSave.clean')}</small>
    {paused && <Button type="button" size="sm" variant="toolbar" disabled={blocked || !available} onClick={() => setPaused(false)}>{t('workspace.autoSave.resume')}</Button>}
  </div>
}
