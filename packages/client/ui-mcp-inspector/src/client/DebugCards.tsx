/**
 * Read-only MCP failure decode cards for the tools inspector pane.
 *
 * Renders the frozen consumer taxonomy decoded by `decodeToolFailure` through
 * the shared locale vocabulary. Pure presentation: no timers, no retry
 * scheduling, no host calls, and no distinguishing field for the merged
 * `permission_denied_or_unknown_action` state. Empty signal lists render
 * nothing (cards that earn existence). Cards are persistent summaries, not
 * live announcements, so they carry no alert role (reserved for banners).
 *
 * @module @yeisme/dsh-client-ui-mcp-inspector/client
 */
import { useEffect, useSyncExternalStore, type JSX } from 'react'
import type { McpInspectorKey } from './locales.ts'
import { decodeToolFailure, resolveFailurePresentation, retryAfterHint, type ToolFailureSignal } from './failure-decode.ts'
import { ConnectDocController, type ConnectDocDisabledCode, type ConnectDocNotice } from './connect-doc.ts'

type FailureText = (key: McpInspectorKey, params?: Readonly<Record<string, string | number>>) => string

interface FailureCardModel {
  readonly taxonomyCode: string | undefined
  readonly title: string
  readonly rawSignal: string | undefined
  readonly likelyCauses: readonly string[]
  readonly nextActions: readonly string[]
  readonly retryHint: ReturnType<typeof retryAfterHint>
}

function decodeCards(signals: readonly ToolFailureSignal[], text: FailureText): readonly FailureCardModel[] {
  const cards = new Map<string, FailureCardModel>()
  for (const signal of signals) {
    const decoded = decodeToolFailure(signal)
    if (decoded.taxonomyCode === 'undecoded') {
      const key = `undecoded:${decoded.rawSignal ?? ''}`
      if (cards.has(key)) continue
      cards.set(key, {
        taxonomyCode: undefined,
        title: text('failure.undecoded.title'),
        rawSignal: decoded.rawSignal,
        likelyCauses: [],
        nextActions: [],
        retryHint: undefined,
      })
      continue
    }
    // One card per taxonomy code; the merged state cannot be split by construction.
    if (cards.has(decoded.taxonomyCode)) continue
    const presentation = resolveFailurePresentation(decoded.taxonomyCode, localeKey => text(localeKey as McpInspectorKey))
    cards.set(decoded.taxonomyCode, {
      taxonomyCode: decoded.taxonomyCode,
      title: presentation.title,
      rawSignal: undefined,
      likelyCauses: presentation.likelyCauses,
      nextActions: presentation.nextActions,
      retryHint: retryAfterHint(decoded.retryAfterSeconds),
    })
  }
  return [...cards.values()]
}

export interface FailureDecodeCardProps {
  readonly signals: readonly ToolFailureSignal[]
  readonly text: FailureText
}

/** Fails closed to `null`: no signals, no card. */
export function FailureDecodeCard({ signals, text }: FailureDecodeCardProps): JSX.Element | null {
  const cards = decodeCards(signals, text)
  if (cards.length === 0) return null
  return (
    <section className="tools-failure-cards" data-failure-cards="" aria-label={text('failure.section.aria')}>
      {cards.map(card => (
        <article key={card.taxonomyCode ?? `undecoded:${card.rawSignal ?? ''}`} className="vk-alert tools-failure-card" data-tone="warn" data-failure-code={card.taxonomyCode}>
          <strong className="tools-failure-title">{card.title}{card.taxonomyCode === undefined ? null : <code>{card.taxonomyCode}</code>}</strong>
          {card.taxonomyCode === undefined ? <p>{text('failure.undecoded.hint')}</p> : null}
          {card.rawSignal === undefined ? null : (
            <p className="tools-failure-raw"><span>{text('failure.undecoded.raw')}</span><code>{card.rawSignal}</code></p>
          )}
          {card.nextActions.length > 0 ? (
            <div className="tools-failure-actions"><span>{text('failure.nextActions')}</span><ul>{card.nextActions.map(action => <li key={action}>{action}</li>)}</ul></div>
          ) : null}
          {card.likelyCauses.length > 0 ? (
            <details className="tools-failure-causes">
              <summary>{text('failure.likelyCauses')}</summary>
              <ul>{card.likelyCauses.map(cause => <li key={cause}>{cause}</li>)}</ul>
            </details>
          ) : null}
          {card.retryHint === undefined ? null : (
            <p className="tools-failure-retry">{card.retryHint.kind === 'exact' ? text('failure.retryAfter.exact', { seconds: card.retryHint.seconds }) : text('failure.retryAfter.qualitative')}</p>
          )}
        </article>
      ))}
    </section>
  )
}

export interface CapabilityMapCardProps {
  readonly controller: ConnectDocController
  readonly text: FailureText
}

/**
 * Capability map card: faces + digest + observedAt from the host connect-doc
 * projection, with an explicit stale banner on digest drift and a single
 * user-triggered re-discovery action. Degrades disabled-with-reason; never
 * renders fallback capability data or stale docs as fresh.
 */
export function CapabilityMapCard({ controller, text }: CapabilityMapCardProps): JSX.Element {
  const subscribe = controller.subscribe.bind(controller)
  const state = useSyncExternalStore(subscribe, controller.getSnapshot.bind(controller), controller.getSnapshot.bind(controller))
  const notice = useSyncExternalStore(subscribe, controller.noticeSnapshot.bind(controller), controller.noticeSnapshot.bind(controller))
  const rediscovering = useSyncExternalStore(subscribe, controller.rediscoveringSnapshot.bind(controller), controller.rediscoveringSnapshot.bind(controller))
  // First read only: drift is surfaced by later reads (recheck or re-discovery),
  // never by a timer or an automatic re-discovery.
  useEffect(() => { void controller.read() }, [controller])

  if (state.status === 'idle' || state.status === 'reading') {
    return (
      <section className="tools-capability-map" data-capability-map="" data-map-state="loading" aria-label={text('map.section.aria')} aria-busy="true">
        <div className="vk-skeleton" aria-hidden="true" />
        <p>{text('map.loading')}</p>
      </section>
    )
  }
  if (state.status === 'disabled') {
    return (
      <section className="tools-capability-map" data-capability-map="" data-map-state="disabled" aria-label={text('map.section.aria')}>
        <div className="vk-alert" data-tone="neutral"><strong>{text('map.disabled')}</strong><p>{disabledReasonText(state.reason, text)}</p></div>
      </section>
    )
  }
  if (state.status === 'error') {
    return (
      <section className="tools-capability-map" data-capability-map="" data-map-state="error" aria-label={text('map.section.aria')}>
        <div className="vk-alert" data-tone="warn"><strong>{text('map.error')}</strong><p>{text(`map.error.${state.code}` as McpInspectorKey)}</p><div><button type="button" className="vk-btn" data-map-reread="" onClick={() => { void controller.read() }}>{text('map.reread')}</button></div></div>
      </section>
    )
  }
  const stale = state.status === 'stale'
  const doc = state.doc
  return (
    <section className="tools-capability-map" data-capability-map="" data-map-state={stale ? 'stale' : 'ready'} data-map-digest={doc.docDigest} aria-label={text('map.section.aria')}>
      <header className="tools-map-header"><strong>{text('map.section.aria')}</strong>{stale ? <span className="vk-badge" data-map-stale="true">{text('map.staleBadge')}</span> : null}</header>
      {stale ? (
        <div className="vk-alert tools-map-mismatch" data-tone="warn" role="alert">
          <p>{text('map.stale', { rendered: doc.docDigest, current: state.currentDigest })}</p>
          <div><button type="button" className="vk-btn" data-map-rediscover="" disabled={rediscovering} onClick={() => { void controller.rediscover() }}>{rediscovering ? text('map.rediscovering') : text('map.rediscover')}</button></div>
        </div>
      ) : null}
      <dl>
        <div><dt>{text('map.digest')}</dt><dd><code className="tools-map-digest">{doc.docDigest}</code></dd></div>
        <div><dt>{text('map.observedAt')}</dt><dd><time dateTime={new Date(doc.observedAt).toISOString()} data-map-observed-at={doc.observedAt}>{new Date(doc.observedAt).toISOString()}</time></dd></div>
        <div><dt>{text('map.faces')}</dt><dd>{text('map.faceCount', { count: doc.faces.length })}</dd></div>
      </dl>
      <ul className="tools-map-faces">
        {doc.faces.map(face => (
          <li key={face.id} data-map-face={face.id}><span>{face.publicName}</span><span className="vk-badge">{face.kind}</span>{face.toolCount !== undefined ? <small>{text('map.toolCount', { count: face.toolCount })}</small> : null}</li>
        ))}
      </ul>
      {notice === undefined ? null : <p className="tools-notice" data-tone="warn" role="status">{text(notice.kind === 'rediscover-rejected' ? 'map.rediscoverUnavailable' : 'map.rediscoverFailed', { reason: noticeReasonText(notice, text) })}</p>}
    </section>
  )
}

function disabledReasonText(reason: { code: ConnectDocDisabledCode; ownerMessage?: string }, text: FailureText): string {
  if (reason.code === 'owner-unavailable') return reason.ownerMessage ?? text('map.reason.projectionMissing')
  return text(reason.code === 'projection-missing' ? 'map.reason.projectionMissing' : 'map.reason.methodUnexposed')
}

function noticeReasonText(notice: ConnectDocNotice, text: FailureText): string {
  if (notice.code === 'owner-unavailable') return notice.ownerMessage ?? text('map.rediscoverReason.transport')
  if (notice.code === 'transport') return text('map.rediscoverReason.transport')
  if (notice.code === 'malformed' || notice.code === 'validation') return text(`map.error.${notice.code}` as McpInspectorKey)
  return text(notice.code === 'projection-missing' ? 'map.rediscoverReason.projectionMissing' : 'map.rediscoverReason.methodUnexposed')
}

export type { ConnectDocNotice }
