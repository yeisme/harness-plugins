/**
 * Bounded Markdown preview for FileOpenPane.
 *
 * Escapes source text first, then emits a small safe HTML subset.
 * Links are limited to http(s)/mailto. No raw HTML, scripts, or images.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/client
 */

export function isMarkdownEntry(entry: { readonly name: string; readonly mediaType?: string }): boolean {
  return entry.mediaType === 'text/markdown' || /\.(?:md|markdown|mdx)$/i.test(entry.name)
}

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

function renderBlock(block: string): string {
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
}

/** Convert Markdown source into a small HTML subset. Source is escaped first. */
export function renderMarkdown(source: string): string {
  const parts: string[] = []
  const fence = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g
  let cursor = 0
  let match = fence.exec(source)
  while (match !== null) {
    parts.push(source.slice(cursor, match.index).split(/\n{2,}/).map(renderBlock).join(''))
    parts.push(`<pre><code>${escapeHtml(match[2] ?? '')}</code></pre>`)
    cursor = match.index + match[0].length
    match = fence.exec(source)
  }
  parts.push(source.slice(cursor).split(/\n{2,}/).map(renderBlock).join(''))
  return parts.join('')
}
