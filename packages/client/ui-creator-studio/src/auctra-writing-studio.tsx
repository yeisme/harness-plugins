import { useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CreatorStudioTranslator } from './locales.ts'

const pages = ['structure', 'candidates', 'versions', 'export'] as const
type Page = typeof pages[number]

/** Independent Auctra text studio pages over the shared editor, without canvas or other studios. */
export function AuctraWritingStudioPages({ structure, candidates, versions, exportPage, t, recovery }: {
  structure: ReactNode; candidates: ReactNode; versions: ReactNode; exportPage: ReactNode; t: CreatorStudioTranslator; recovery?: ReactNode
}): ReactNode {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Page>('structure')
  const [visited, setVisited] = useState<ReadonlySet<Page>>(() => new Set(['structure']))
  const select = (page: Page) => {
    if (page === active) return
    setVisited(current => new Set([...current, page]))
    setActive(page)
  }
  const content = { structure: <>{recovery}{structure}</>, candidates, versions, export: exportPage }
  return <div ref={root} data-auctra-writing-studio>
    <div role="tablist" aria-label={t('auctra.pages')} className="cs-eikona-tabs">
      {pages.map((page, index) => <Button key={page} id={`${id}-${page}`} type="button" role="tab"
        className="cs-button vk-btn" aria-selected={active === page} aria-controls={`${id}-${page}-panel`}
        tabIndex={active === page ? 0 : -1} onClick={() => select(page)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % pages.length : event.key === 'ArrowLeft' ? (index + pages.length - 1) % pages.length : event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : undefined
          if (next === undefined) return
          event.preventDefault()
          select(pages[next]!)
          root.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
        }}>{t(`auctra.${page}`)}</Button>)}
    </div>
    {pages.map(page => <div key={page} id={`${id}-${page}-panel`} role="tabpanel" aria-labelledby={`${id}-${page}`}
      hidden={active !== page} tabIndex={0}>{visited.has(page) ? content[page] : null}</div>)}
  </div>
}

export { auctraStudioScopeKey, auctraStudioAcceptsResponse } from './auctra-studio-scope.ts'
