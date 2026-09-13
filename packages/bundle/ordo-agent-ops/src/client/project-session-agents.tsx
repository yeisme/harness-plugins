import { useSyncExternalStore } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import { projectSubagentPane, type SubagentProjectionSource } from '@yeisme/dsh-client-ui-pane-subagent'
import type { ProjectTranslate } from './project-pane.tsx'

export interface ProjectSessionsFace {
  list: { subscribe(listener: () => void): () => void; getSnapshot(): { byId: SubagentProjectionSource['summaries']; subagentsByParent: SubagentProjectionSource['catalogs'] } }
}
export function ProjectSessionAgents({ roots, sessions, open, t }: { roots: readonly string[]; sessions?: ProjectSessionsFace | undefined; open?: ((ref: string) => void) | undefined; t: ProjectTranslate }) {
  const source = useSyncExternalStore(listener => sessions?.list.subscribe(listener) ?? (() => {}), () => sessions?.list.getSnapshot() ?? null)
  return <SurfaceSection title={t('nativeAgents')}>
    {!roots.length && <SurfaceState phase="empty" title={t('noSessionLink')} />}
    {roots.map(root => {
      if (!source?.subagentsByParent[root]) return <SurfaceState key={root} phase="partial" title={t('sessionUnavailable')} description={root} />
      const projection = projectSubagentPane({ rootSessionId: root, catalogs: source.subagentsByParent, summaries: source.byId, freshness: 'fresh', generation: 0 })
      return <SurfaceSection key={root} title={root}><div className="ops-list">{projection.nodes.map(node => <div key={node.ref} className="ops-row"><span>{node.label} · {node.status}{node.timingMs === undefined ? '' : ` · ${Math.round(node.timingMs / 1000)}s`}{node.tokenUsage === undefined ? '' : ` · ${node.tokenUsage.input + node.tokenUsage.output} tokens`}</span><Button className="vk-btn" disabled={!open} title={!open ? t('sessionUnavailable') : undefined} onClick={() => open?.(node.ref)}>{t('alongside')}</Button></div>)}</div></SurfaceSection>
    })}
  </SurfaceSection>
}
