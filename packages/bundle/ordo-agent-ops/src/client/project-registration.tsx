import type { ProjectSessionsFace } from './project-session-agents.tsx'
import { useSyncExternalStore } from 'react'
import { ProjectPicker, projectZh, projectEn } from './project-pane.tsx'
import type { ProjectRemote } from '../project-contract.ts'

const NS = 'ordoProjectOps'
interface Pane { views?: { has(kind: string): boolean }; registerView(value: unknown): () => void; openView(value: unknown): void; registerCommand?(value: unknown): () => void }
interface Context { get(key: string): unknown; on?(event: string, listener: (...args: unknown[]) => void): () => void }
export function registerProjectCommandPane(ctx: Context): () => void {
  const get = (key: string): unknown => { try { return ctx.get(key) } catch { return undefined } }
  const locale = get('locale') as { register?(ns: string, dictionaries: unknown): () => void; bind?(ns: string): (key: string) => string; subscribe?(fn: () => void): () => void; getSnapshot?(): unknown } | undefined
  const offLocale = locale?.register?.(NS, { zh: projectZh, en: projectEn })
  const translate = locale?.bind?.(NS)
  const t = (key: keyof typeof projectZh): string => translate?.(key) ?? projectZh[key]
  let pane: Pane | undefined; let offs: (() => void)[] = []
  const mount = () => {
    const next = get('paneWorkbench') as Pane | undefined
    if (next === pane) return
    for (const off of offs.reverse()) off(); offs = []; pane = next
    if (!next?.registerView) return
    function Bound(props: { view?: { resourceKey?: string; metadata?: { selectedTaskRef?: string } }; restoreState?: unknown; onRestoreStateChange?: (state: unknown) => boolean }) {
      useSyncExternalStore(listener => locale?.subscribe?.(listener) ?? (() => {}), () => locale?.getSnapshot?.() ?? null)
      const remote = get('remote.ordoAgentOps') as ProjectRemote | undefined
      if (!remote || typeof remote.projects !== 'function' || typeof remote.projectSnapshot !== 'function') return <p role="status">{t('unavailable')}</p>
      return <ProjectPicker remote={remote} t={t} subscribeReset={fn => ctx.on?.('connection/reset', fn) ?? (() => {})} restore={props.restoreState ?? (props.view?.resourceKey?.startsWith('ordo-project:project.') ? { projectRef: props.view.resourceKey.slice('ordo-project:'.length), ...(props.view.metadata?.selectedTaskRef ? { selectedRef: props.view.metadata.selectedTaskRef } : {}) } : undefined)} onRestore={props.onRestoreStateChange} sessions={get('sessions') as ProjectSessionsFace | undefined} openSession={next?.views?.has('dsh-side-chat.session') ? ref => next.openView({ kind: 'dsh-side-chat.session', resourceKey: `side-chat:${ref}`, role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false, title: 'Agent' }) : undefined} />
    }
    offs.push(next.registerView({ descriptor: { kind: 'agents.hub', label: t('title'), componentKey: 'ordo-project-command', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: false },
      i18n: { namespace: NS, labelKey: 'title' }, restore: { state: true, rendition: false }, component: Bound }))
    if (next.registerCommand) for (const [id, name] of [['ordo.project.open', 'ordo-project'], ['ordo.team.open', 'agent-team']]) offs.push(next.registerCommand({ descriptor: { id, label: t('title'), presentation: { launcher: name === 'agent-team' }, slash: { name, category: 'pane' } }, execute: () => next.openView({ kind: 'agents.hub', resourceKey: 'ordo-project:picker', role: 'content', preferredRegion: 'right', retention: 'keep-alive', singleton: true, title: t('title') }) }))
  }
  mount()
  const offService = ctx.on?.('internal/service', mount)
  return () => { offService?.(); for (const off of offs.reverse()) off(); offLocale?.() }
}
