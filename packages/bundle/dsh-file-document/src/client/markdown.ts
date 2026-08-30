/**
 * Escape-first bounded Markdown renderer (V3 4.5 default).
 *
 * Every source fragment is HTML-escaped before any tag is emitted; link
 * hrefs are restricted to https/mailto without whitespace or quotes.
 * Output is a small legacy subset — the composition layer may inject a
 * richer owner renderer via `renderMarkdown`, which then takes precedence.
 *
 * @module @yeisme/dsh-file-document/client
 */

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function safeHref(href: string): string | undefined {
  const trimmed = href.trim()
  if (/^(https?:|mailto:)/i.test(trimmed) && !/[\s<>"']/.test(trimmed)) return trimmed
  return undefined
}

function inlineMarkdown(value: string): string {
  const escaped = escapeHtml(value)
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      const safe = safeHref(href)
      return safe === undefined ? label : `<a href="${escapeHtml(safe)}" rel="noreferrer" target="_blank">${label}</a>`
    })
}

const MAX_SOURCE = 256 * 1024

/** Renders bounded markdown to a sanitized-HTML subset; source escaped first. */
export function renderSafeMarkdown(source: string): string {
  const bounded = source.length > MAX_SOURCE ? source.slice(0, MAX_SOURCE) : source
  return bounded
    .split(/\n{2,}/)
    .slice(0, 2_000)
    .map(block => {
      const trimmed = block.trimEnd()
      if (trimmed === '') return ''
      if (/^---+$/.test(trimmed.trim())) return '<hr />'
      const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
      if (heading !== null) {
        const level = heading[1]!.length
        return `<h${level}>${inlineMarkdown(heading[2]!)}</h${level}>`
      }
      if (trimmed.startsWith('> ')) {
        const body = trimmed.split('\n').map(line => line.replace(/^>\s?/, '')).join('\n')
        return `<blockquote>${inlineMarkdown(body)}</blockquote>`
      }
      const lines = trimmed.split('\n')
      if (lines.every(line => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map(line => `<li>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ''))}</li>`).join('')}</ul>`
      }
      if (lines.every(line => /^\s*\d+\.\s+/.test(line))) {
        return `<ol>${lines.map(line => `<li>${inlineMarkdown(line.replace(/^\s*\d+\.\s+/, ''))}</li>`).join('')}</ol>`
      }
      return `<p>${lines.map(line => inlineMarkdown(line)).join('<br />')}</p>`
    })
    .join('')
}
