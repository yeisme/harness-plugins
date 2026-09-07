import { useEffect, useMemo, useState, useSyncExternalStore, type JSX } from 'react'
import type { ClientContext, ISessions, SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveToolActivity, type ActivityRunningCall, type ActivityToolResultNode } from './activity.ts'
import { ToolsInspectorContent, type ToolsTranslator } from './McpInspectorView.tsx'
import { createToolsHubController, type ToolsHubController } from './controller.ts'
import { resolveToolHubRemote } from './remote.ts'

const EMPTY_ACTIVITY = deriveToolActivity([], [])
const idleSubscribe = () => () => {}
const emptySnapshot = () => undefined
interface ActivityFields {
  readonly nodes?: readonly { readonly kind: string }[]
  readonly runningCalls?: readonly ActivityRunningCall[]
}
interface ActivitySource {
  subscribe(listener: () => void): () => void
  getSnapshot(): ActivityFields | { readonly legacy: ActivityFields } | undefined
}

/** New hosts keep chat projections separate from session lifecycle; older hosts expose them on session. */
function activitySource(ctx: ClientContext, current: string | undefined, session: SessionFace | undefined): ActivitySource | undefined {
  if (current !== undefined && session !== undefined) {
    let ui: { binding(id: string): { target(name: string): ActivitySource } } | undefined
    try { ui = typeof ctx.get === 'function' ? ctx.get('uiConversation' as never) as unknown as typeof ui : undefined } catch { /* Optional on older hosts. */ }
    if (typeof ui?.binding === 'function') {
      const binding = ui.binding(current)
      if (typeof binding.target === 'function') return binding.target('chat')
    }
  }
  return session as unknown as ActivitySource | undefined
}

/** The host remains the session owner; the pane only subscribes while mounted. */
export function ToolsPane({ ctx, sessions, t }: {
  readonly ctx: ClientContext
  readonly sessions: ISessions
  readonly t: ToolsTranslator
}): JSX.Element {
  const subscribe = useMemo(() => sessions.list.subscribe.bind(sessions.list), [sessions])
  const read = useMemo(() => () => sessions.list.getSnapshot().current, [sessions])
  const current = useSyncExternalStore(subscribe, read, read)
  const session = current === undefined ? undefined : sessions.binding(current)?.session
  const source = useMemo(() => activitySource(ctx, current, session), [ctx, current, session])
  // Keying by session drops the old selection, pending UI and snapshot together.
  return <ToolsPaneSession key={current ?? 'no-session'} ctx={ctx} source={source} t={t}
    sessionNotice={current === undefined ? t('session.none') : session === undefined ? t('session.unavailable') : undefined} />
}

function ToolsPaneSession({ ctx, source, t, sessionNotice }: {
  readonly ctx: ClientContext
  readonly source?: ActivitySource | undefined
  readonly t: ToolsTranslator
  readonly sessionNotice?: string | undefined
}): JSX.Element {
  const subscribe = useMemo(() => source?.subscribe.bind(source) ?? idleSubscribe, [source])
  const read = useMemo(() => source?.getSnapshot.bind(source) ?? emptySnapshot, [source])
  const snapshot = useSyncExternalStore(subscribe, read, read)
  const activity = useMemo(() => {
    if (snapshot === undefined) return EMPTY_ACTIVITY
    const fields = 'legacy' in snapshot ? snapshot.legacy : snapshot
    return deriveToolActivity(
      (fields.nodes ?? []).filter(node => node.kind === 'tool-result') as unknown as ActivityToolResultNode[],
      fields.runningCalls ?? [],
    )
  }, [snapshot])
  const [controller, setController] = useState<ToolsHubController>()
  useEffect(() => {
    let disposed = false
    let owned: ToolsHubController | undefined
    void resolveToolHubRemote(ctx).then(remote => {
      if (disposed || remote === undefined) return
      owned = createToolsHubController(remote)
      setController(owned)
    }, () => { /* Invalid optional host projection leaves the catalog unavailable. */ })
    return () => { disposed = true; owned?.dispose() }
  }, [ctx])
  return <ToolsInspectorContent activity={activity} controller={controller} t={t} initialFamily="mcp" sessionNotice={sessionNotice} />
}
