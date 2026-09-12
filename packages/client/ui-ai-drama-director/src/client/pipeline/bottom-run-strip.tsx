/**
 * Bottom read-only run strip: Log / Validation / Render Queue.
 * Entries arrive via props; the strip renders no interactive controls and
 * never fetches or mutates run state.
 */

import type { ReactNode } from 'react'
import { statusTone } from '@yeisme/dsh-client-ui-visual-kit'
import type { BottomRunStripProps, PipelineRunStripEntry } from './types.js'

function StripSection({ title, entries, label }: { readonly title: string; readonly entries: readonly PipelineRunStripEntry[]; readonly label: string }): ReactNode {
  return (
    <section className="plw-strip-section" aria-label={label}>
      <h3 className="plw-strip-title">{title}</h3>
      {entries.length === 0 ? (
        <p className="plw-strip-empty vk-muted" role="status">
          Nothing to show
        </p>
      ) : (
        <ul className="plw-strip-list">
          {entries.map(entry => (
            <li key={entry.id} className="plw-strip-entry">
              {entry.status === undefined ? null : (
                <span className="vk-dot" data-tone={statusTone(entry.status)} aria-hidden="true" />
              )}
              <span className="plw-strip-text">{entry.text}</span>
              {entry.status === undefined ? null : <span className="plw-strip-status">{entry.status}</span>}
              {entry.meta === undefined ? null : <span className="plw-strip-meta vk-muted">{entry.meta}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function BottomRunStrip({ log, validation, queue }: BottomRunStripProps): ReactNode {
  return (
    <div className="plw-strip" data-testid="plw-run-strip" aria-label="Run activity">
      <StripSection title="Log" label="Log" entries={log} />
      <StripSection title="Validation" label="Validation" entries={validation} />
      <StripSection title="Render Queue" label="Render queue" entries={queue} />
    </div>
  )
}
