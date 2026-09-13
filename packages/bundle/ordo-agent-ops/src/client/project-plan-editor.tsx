import { useEffect, useState } from 'react'
import { Button, Input } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceActionBar, SurfaceSection, SurfaceState } from '@yeisme/dsh-client-ui-surface'
import type { ProjectController } from './project-controller.ts'
import type { ProjectDraft } from '../project-contract.ts'
import type { ProjectTranslate } from './project-pane.tsx'

/** Edits become a new owner proposal, never a rewrite of an executing plan. */
export function ProjectPlanEditor({ controller, targetRef, t, onChange, restored }: { controller: ProjectController; targetRef: string; t: ProjectTranslate; onChange: (draft: string | undefined) => void; restored?: ProjectDraft | undefined }) {
  const [draft, setDraft] = useState<ProjectDraft>(); const [error, setError] = useState(false)
  const [current, setCurrent] = useState<ProjectDraft>()
  const [taskRef, setTaskRef] = useState('')
  useEffect(() => { let alive = true; onChange(undefined); void controller.draft(targetRef).then(value => {
    if (!alive) return
    if (restored && (restored.planRef !== value.planRef || restored.revision !== value.revision)) { setDraft(restored); setCurrent(value); return }
    setDraft(restored ?? value); onChange(JSON.stringify(restored ?? value))
  }).catch(() => { if (alive) setError(true) }); return () => { alive = false } }, [controller, targetRef])
  const edit = (next: ProjectDraft) => { setDraft(next); onChange(JSON.stringify(next)) }
  if (!draft) return <SurfaceState phase={error ? 'disabled' : 'loading'} title={t(error ? 'unavailable' : 'loading')} />
  return <SurfaceSection title={t('editPlan')} description={t('newRevision')}>
    {current && <SurfaceState phase="stale" title={t('draftConflict')} action={<Button className="vk-btn" onClick={() => { edit(current); setCurrent(undefined) }}>{t('useCurrent')}</Button>} />}
    <fieldset disabled={Boolean(current)}>
    <label className="ys-field">{t('budget')}<Input value={draft.budgetRef} onChange={event => edit({ ...draft, budgetRef: event.target.value })} /></label>
    <label className="ys-field">{t('minutes')}<Input type="number" min={1} value={draft.maxWallClockMinutes} onChange={event => edit({ ...draft, maxWallClockMinutes: Number(event.target.value) })} /></label>
    {draft.roles.map((role, index) => <label key={role.ref} className="ys-field">{role.role} · {t('model')}<Input value={role.modelRef} onChange={event => edit({ ...draft, roles: draft.roles.map((value, i) => i === index ? { ...value, modelRef: event.target.value } : value) })} /></label>)}
    <label className="ys-field">{t('tasks')}<select value={taskRef || draft.tasks[0]?.ref || ''} onChange={event => setTaskRef(event.target.value)}>{draft.tasks.map(task => <option key={task.ref} value={task.ref}>{task.ref}</option>)}</select></label>
    {draft.tasks.filter(task => task.ref === (taskRef || draft.tasks[0]?.ref)).map(task => <SurfaceSection key={task.ref} title={task.ref} description={t('dependencies')}><SurfaceActionBar>{draft.tasks.filter(candidate => candidate.ref !== task.ref).map(candidate => <Button className="vk-btn" key={candidate.ref} aria-pressed={task.dependencies.includes(candidate.ref)} onClick={() => edit({ ...draft, tasks: draft.tasks.map(value => value.ref !== task.ref ? value : { ...value, dependencies: value.dependencies.includes(candidate.ref) ? value.dependencies.filter(ref => ref !== candidate.ref) : [...value.dependencies, candidate.ref] }) })}>{candidate.ref}</Button>)}</SurfaceActionBar></SurfaceSection>)}
    </fieldset>
  </SurfaceSection>
}
