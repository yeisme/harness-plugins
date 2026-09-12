import { useEffect, useState } from 'react'

/** Render-budget only. The caller retains the complete editable source. */
export const STATIC_HTML_MAX_LENGTH = 128 * 1024

const tags = ['article', 'section', 'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'blockquote', 'pre', 'code', 'strong', 'em', 'b', 'i',
  's', 'del', 'mark', 'small', 'sub', 'sup', 'hr', 'br', 'table', 'caption', 'thead', 'tbody',
  'tfoot', 'tr', 'th', 'td', 'figure', 'figcaption']

/** No executable elements, styles, URLs, IDs, names, or user-controlled classes. */
export async function sanitizeStaticHtml(source: string): Promise<string | undefined> {
  if (source.length > STATIC_HTML_MAX_LENGTH || typeof window === 'undefined') return undefined
  const { default: createPurifier } = await import('dompurify')
  // Do not share persistent config/hooks with another renderer in this bundle.
  const purify = createPurifier(window)
  return purify.sanitize(source, {
    ALLOWED_TAGS: tags,
    ALLOWED_ATTR: ['colspan', 'rowspan', 'scope', 'start', 'reversed'],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  })
}

export interface StaticHtmlPreviewLabels {
  readonly title: string
  readonly notice: string
  readonly loading: string
  readonly empty: string
  readonly unavailable: string
  readonly tooLarge: string
}

const defaults: StaticHtmlPreviewLabels = {
  title: 'Static HTML structure',
  notice: 'Scripts, styles, controls, and external resources are omitted. Use the development preview to run the page.',
  loading: 'Preparing static HTML preview.',
  empty: 'No static HTML content to display.',
  unavailable: 'Static preview failed. The source is preserved; edit it or reopen the preview.',
  tooLarge: 'The HTML exceeds the static preview limit. The complete source remains editable.',
}

/** Inert semantic projection, not an application runtime or iframe bridge. */
export function StaticHtmlPreview({ source, labels = defaults }: { source: string; labels?: StaticHtmlPreviewLabels }) {
  const [result, setResult] = useState<{ source: string; html?: string; failed?: boolean }>()
  useEffect(() => {
    let current = true
    if (source.length <= STATIC_HTML_MAX_LENGTH) {
      void sanitizeStaticHtml(source).then(html => {
        if (current) setResult({ source, ...(html === undefined ? { failed: true } : { html }) })
      }).catch(() => { if (current) setResult({ source, failed: true }) })
    }
    return () => { current = false }
  }, [source])
  const ready = result?.source === source ? result : undefined
  const phase = source.length > STATIC_HTML_MAX_LENGTH ? 'too-large' : ready === undefined ? 'loading'
    : ready.failed ? 'unavailable' : ready.html?.trim() ? 'ready' : 'empty'
  return <section data-static-html-preview data-static-html-state={phase} aria-label={labels.title}>
    <p role="status">{labels.notice}</p>
    {phase === 'ready'
      // The strict sanitizer admits semantic markup only, with no active attributes.
      ? <article data-static-html-content style={{ maxWidth: '100%', overflow: 'auto', overflowWrap: 'anywhere', maxHeight: 'min(68vh, 720px)' }} dangerouslySetInnerHTML={{ __html: ready!.html! }} />
      : <p role={phase === 'unavailable' || phase === 'too-large' ? 'alert' : 'status'}>{labels[phase === 'too-large' ? 'tooLarge' : phase]}</p>}
  </section>
}
