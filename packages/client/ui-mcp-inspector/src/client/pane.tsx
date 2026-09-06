import { useEffect, useMemo, useState, useSyncExternalStore, type JSX } from 'react'
import type { ClientContext, ISessions, SessionFace } from '@deepseek-ai/dsh-client-runtime/client'
import { deriveToolActivity, type ActivityRunningCall, type ActivityToolResultNode } from './activity.ts'
import { ToolsInspectorContent, type ToolsTranslator } from './McpInspectorView.tsx'
import { createToolsHubController, type ToolsHubController } from './controller.ts'
import { resolveToolHubRemote } from './remote.ts'

const EMPTY_ACTIVITY = deriveToolActivity([], [])
const idleSubscribe = () => () => {}
const emptySnapshot = () => undefined

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
  // Keying by session drops the old selection, pending UI and snapshot together.
  return <ToolsPaneSession key={current ?? 'no-session'} ctx={ctx} session={session} t={t}
    sessionNotice={current === undefined ? t('session.none') : session === undefined ? t('session.unavailable') : undefined} />
}

function ToolsPaneSession({ ctx, session, t, sessionNotice }: {
  readonly ctx: ClientContext
  readonly session?: SessionFace | undefined
  readonly t: ToolsTranslator
  readonly sessionNotice?: string | undefined
}): JSX.Element {
  const subscribe = useMemo(() => session?.subscribe.bind(session) ?? idleSubscribe, [session])
  const read = useMemo(() => session?.getSnapshot.bind(session) ?? emptySnapshot, [session])
  const snapshot = useSyncExternalStore(subscribe, read, read)
  const activity = useMemo(() => snapshot === undefined ? EMPTY_ACTIVITY : deriveToolActivity(
    snapshot.nodes.filter(node => node.kind === 'tool-result') as unknown as ActivityToolResultNode[],
    snapshot.runningCalls as unknown as ActivityRunningCall[],
  ), [snapshot])
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
