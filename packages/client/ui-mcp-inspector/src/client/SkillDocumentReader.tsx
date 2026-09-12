import { useEffect, useRef, useState } from 'react'
import type { ToolsTranslator } from './McpInspectorView.tsx'
import type { ToolHubItemV1 } from './wire.ts'
import type { SkillDocumentAnswer, SkillDocumentInput, SkillDocumentPage } from './skill-document-remote.ts'

/** One bounded source-text page; rendering never follows links or executes Markdown. */
export function SkillDocumentReader(props: {
  item: ToolHubItemV1
  installed: boolean
  read: (input: SkillDocumentInput, signal: AbortSignal) => Promise<SkillDocumentAnswer>
  t: ToolsTranslator
}) {
  const [state, setState] = useState<SkillDocumentAnswer | { status: 'idle' | 'loading' }>({ status: 'idle' })
  const [position, setPosition] = useState(0)
  const cursors = useRef<(string | undefined)[]>([undefined])
  const revision = useRef<string>()
  const resource = useRef<string>()
  const pending = useRef<AbortController>()
  const epoch = useRef(0)
  const opener = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)
  useEffect(() => { if (state.status === 'idle' && restoreFocus.current) { restoreFocus.current = false; opener.current?.focus() } }, [state.status])
  useEffect(() => () => { epoch.current += 1; pending.current?.abort() }, [])
  const page = 'content' in state ? state : undefined
  const reset = () => { cursors.current = [undefined]; revision.current = undefined; resource.current = undefined; setPosition(0) }
  const close = () => {
    epoch.current += 1; pending.current?.abort(); pending.current = undefined
    reset(); restoreFocus.current = true; setState({ status: 'idle' })
  }
  const load = async (index: number, refresh = false) => {
    if (pending.current || !props.installed) return
    if (refresh) reset()
    const current = ++epoch.current, abort = new AbortController()
    pending.current = abort
    const cursor = refresh ? undefined : cursors.current[index]
    setState({ status: 'loading' })
    const answer = await props.read({ itemId: props.item.id, source: props.item.source, scope: 'profile',
      ...(revision.current === undefined ? {} : { expectedRevision: revision.current }),
      ...(cursor === undefined ? {} : { cursor }),
    }, abort.signal).catch((): SkillDocumentAnswer => ({ status: 'error' }))
    if (current !== epoch.current || abort.signal.aborted) return
    pending.current = undefined
    if ('content' in answer) {
      if ((revision.current !== undefined && answer.revision !== revision.current)
        || (resource.current !== undefined && answer.resourceRef !== resource.current)) { reset(); setState({ status: 'stale' }); return }
      if (answer.nextCursor !== undefined && cursors.current.slice(0, index + 1).includes(answer.nextCursor)) { reset(); setState({ status: 'error' }); return }
      revision.current = answer.revision; resource.current = answer.resourceRef
      setPosition(refresh ? 0 : index)
    } else { reset() }
    setState(answer)
  }
  const next = (current: SkillDocumentPage) => {
    if (!current.nextCursor || pending.current) return
    cursors.current = [...cursors.current.slice(0, position + 1), current.nextCursor]
    let index = position + 1
    if (cursors.current.length > 50) { cursors.current.shift(); index -= 1 }
    void load(index)
  }
  return <section className="tools-skill-reader" aria-label={props.t('reader.title')} onKeyDown={event => {
    if (event.key === 'Escape' && state.status !== 'idle') { event.preventDefault(); event.stopPropagation(); close() }
  }}>
    <button ref={opener} type="button" className="vk-btn" disabled={!props.installed || state.status === 'loading'} onClick={() => void load(0, true)}>{props.t(state.status === 'idle' ? 'reader.open' : 'reader.refresh')}</button>
    {!props.installed && <p>{props.t('reader.sessionUnavailable')}</p>}
    {state.status !== 'idle' && <button type="button" className="vk-btn" onClick={close}>{props.t('reader.close')}</button>}
    {state.status !== 'idle' && page === undefined && <p role="status">{props.t(`reader.${state.status}` as 'reader.loading' | 'reader.disabled' | 'reader.denied' | 'reader.stale' | 'reader.error')}</p>}
    {page && <>
      <p>{props.t('reader.version')}: <code>{page.revision}</code></p>
      <p>{props.t('reader.startLine')}: {page.startLine}{page.continuedLine ? ` · ${props.t('reader.continuedLine')}` : ''}</p>
      <pre tabIndex={0} className="tools-skill-reader-text" aria-label={props.t('reader.sourceText')}>{page.content}</pre>
      <button type="button" className="vk-btn" disabled={position === 0} onClick={() => void load(position - 1)}>{props.t('reader.previous')}</button>
      {page.nextCursor !== undefined && <button type="button" className="vk-btn" onClick={() => next(page)}>{props.t('reader.more')}</button>}
    </>}
    <style>{`.tools-skill-reader{min-width:0;overflow-wrap:anywhere}.tools-skill-reader-text{white-space:pre-wrap;overflow-wrap:anywhere;max-height:50vh;overflow:auto;font:var(--vk-font-small) monospace;padding:var(--vk-gap-md);background:var(--vk-bg-layer-1);border:1px solid var(--vk-border-l1)}.tools-skill-reader button:focus-visible,.tools-skill-reader pre:focus-visible{outline:2px solid var(--vk-border-focus);outline-offset:2px}@media(pointer:coarse){.tools-skill-reader button{min-height:44px}}`}</style>
  </section>
}
