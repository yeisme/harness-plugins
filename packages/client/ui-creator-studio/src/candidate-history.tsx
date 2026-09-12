import { useEffect, useRef, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ArtifactRefV1 } from '@yeisme/dsh-pane-protocol'
import { creatorCandidatePageSchema, type CreatorCandidatePageV1, type CreatorCandidateQueryV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioTranslator } from './locales.ts'

type ReadyPage = Extract<CreatorCandidatePageV1, { status: 'ready' }>
/** Ephemeral navigation only. Parent mounts a new instance for each context and artifact version. */
export function CandidateHistory({ artifact, read, onPage, t, disabled = false }: {
  readonly disabled?: boolean
  readonly artifact: ArtifactRefV1
  readonly read: (query: CreatorCandidateQueryV1) => Promise<CreatorCandidatePageV1>
  readonly onPage: (page: ReadyPage) => void
  readonly t: CreatorStudioTranslator
}) {
  const [page, setPage] = useState<ReadyPage>()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)
  const busy = useRef(false), alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  async function load(cursor?: string) {
    if (busy.current || disabled) return
    busy.current = true; setPending(true); setError(false)
    try {
      const result = creatorCandidatePageSchema.safeParse(await read({ schemaVersion: 'creator.candidate-query.v1alpha1', artifact, limit: 50,
        ...(cursor === undefined ? {} : { cursor }) }))
      if (!alive.current) return
      if (!result.success || result.data.status !== 'ready' || result.data.artifact.ref !== artifact.ref
        || result.data.artifact.owner !== artifact.owner || result.data.artifact.version !== artifact.version
        || result.data.candidates.length > 50 || (cursor !== undefined && result.data.nextCursor === cursor)) { setError(true); return }
      setPage(result.data); onPage(result.data)
    } catch { if (alive.current) setError(true) }
    finally { busy.current = false; if (alive.current) setPending(false) }
  }
  return <div data-creator-candidate-history aria-busy={pending}>
    <Button className="vk-btn" disabled={disabled || pending} onClick={() => { void load() }}>{t(page ? 'workspace.history.first' : 'workspace.history.load')}</Button>
    <Button className="vk-btn" disabled={disabled || pending || page?.nextCursor === undefined} onClick={() => { void load(page?.nextCursor) }}>{t('workspace.history.next')}</Button>
    <span role="status">{pending ? t('workspace.history.loading') : error ? t('workspace.history.error') : page ? t('workspace.history.count', { count: page.candidates.length }) : ''}</span>
  </div>
}
