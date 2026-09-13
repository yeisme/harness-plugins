import { useEffect, useState } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'

interface Link { projectRef: string; title: string; taskRefs: string[] }
interface Port { projectSessionLinks(sessionRef: string): Promise<{ links: Link[] }> }
export function SessionProjectLinks({ sessionRef, remote, open, available = true }: { sessionRef?: string | undefined; remote?: Port | undefined; available?: boolean; open: (projectRef: string, taskRef?: string) => void }) {
  const [links, setLinks] = useState<Link[]>([]); const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true; setLinks([]); setFailed(false)
    if (sessionRef && remote?.projectSessionLinks) void remote.projectSessionLinks(sessionRef).then(result => { if (active) setLinks(result.links) }).catch(() => { if (active) setFailed(true) })
    return () => { active = false }
  }, [sessionRef, remote])
  if (!links.length && !failed) return null
  return <SurfaceSection title="Agent Team · Ordo">
    {failed && <SurfaceState phase="partial" title="Ordo association unavailable" />}
    {links.map(link => <SurfaceSection key={link.projectRef} title={link.title}>
      <Button className="vk-btn" disabled={!available} title={!available ? "Agent Team Pane unavailable" : undefined} onClick={() => open(link.projectRef)}>Ordo · {link.title}</Button>
      {link.taskRefs.map(ref => <Button className="vk-btn" disabled={!available} title={!available ? "Agent Team Pane unavailable" : undefined} key={ref} onClick={() => open(link.projectRef, ref)}>{ref}</Button>)}
    </SurfaceSection>)}
  </SurfaceSection>
}
