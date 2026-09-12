import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import type { CreatorResourceV1 } from '@yeisme/dsh-creator-studio-host/contracts'
import { useId, useRef, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { CreatorStudioTranslator } from './locales.ts'

const pages = ['configure', 'candidates', 'assets'] as const
type Page = typeof pages[number]

/** Domain pages compose the existing action and artifact workspaces, without copying their state. */
export function EikonaStudioPages({ configure, candidates, assets, t, professional = false }: {
  configure: ReactNode; candidates: ReactNode; assets: ReactNode; t: CreatorStudioTranslator; professional?: boolean
}): ReactNode {
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<Page>('configure')
  const [visited, setVisited] = useState<ReadonlySet<Page>>(() => new Set(['configure']))
  const select = (page: Page) => {
    if (page === active) return
    root.current?.querySelectorAll<HTMLMediaElement>('video,audio').forEach(media => media.pause())
    setVisited(current => new Set([...current, page]))
    setActive(page)
  }
  const content = { configure, candidates, assets }
  if (professional) return <div ref={root} data-eikona-studio data-professional-studio className="cs-professional-grid">
    <section className="cs-professional-stage" aria-label={t('eikona.assets')}>{assets}</section>
    <aside className="cs-professional-inspector" aria-label={t('eikona.configure')}>{configure}</aside>
    <section className="cs-professional-library" aria-label={t('eikona.candidates')}>{candidates}</section>
  </div>
  return <div ref={root} data-eikona-studio>
    <div role="tablist" aria-label={t('eikona.pages')} className="cs-eikona-tabs">
      {pages.map((page, index) => <Button key={page} id={`${id}-${page}`} type="button" role="tab"
        className="cs-button vk-btn" aria-selected={active === page} aria-controls={`${id}-${page}-panel`}
        tabIndex={active === page ? 0 : -1} onClick={() => select(page)} onKeyDown={event => {
          const next = event.key === 'ArrowRight' ? (index + 1) % pages.length : event.key === 'ArrowLeft' ? (index + pages.length - 1) % pages.length : event.key === 'Home' ? 0 : event.key === 'End' ? pages.length - 1 : undefined
          if (next === undefined) return
          event.preventDefault()
          select(pages[next]!)
          root.current?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus()
        }}>{t(`eikona.${page}`)}</Button>)}
    </div>
    {pages.map(page => <div key={page} id={`${id}-${page}-panel`} role="tabpanel" aria-labelledby={`${id}-${page}`}
      hidden={active !== page} tabIndex={0}>{visited.has(page) ? content[page] : null}</div>)}
  </div>
}

export function EikonaCapabilityNotice({ resources, t }: { resources: readonly CreatorResourceV1[]; t: CreatorStudioTranslator }): ReactNode {
  if (resources.length === 0) return null
  return <SurfaceSection className="cs-section" title={t('eikona.capabilities')} description={t('eikona.connectionRequired')}>
    <ul className="cs-list ys-list">{resources.map(resource => <li className="ys-row" key={resource.ref}>
      <span className="ys-row-main"><strong>{resource.title === 'eikona.generation.submit' ? t('eikona.generate') : resource.title === 'eikona.review.decide' ? t('eikona.review') : resource.title === 'eikona.handoff.prepare' ? t('eikona.handoff') : t('eikona.otherCapability')}</strong>
      <small>{resource.status === 'requires_authorization' ? t('eikona.authorizationRequired') : t('eikona.ownerNotReady')}</small></span>
    </li>)}</ul>
  </SurfaceSection>
}
