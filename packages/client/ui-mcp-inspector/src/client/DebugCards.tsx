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
import type { JSX } from 'react'
import type { McpInspectorKey } from './locales.ts'
import { decodeToolFailure, resolveFailurePresentation, retryAfterHint, type ToolFailureSignal } from './failure-decode.ts'

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
