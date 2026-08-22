import { describe, expect, it } from 'vitest'
import { escapeHtml, isMarkdownEntry, renderMarkdown } from '../src/client/file-markdown.ts'

describe('file markdown preview', () => {
  it('detects markdown entries by media type or extension', () => {
    expect(isMarkdownEntry({ name: 'README.md', mediaType: 'text/markdown' })).toBe(true)
    expect(isMarkdownEntry({ name: 'notes.markdown' })).toBe(true)
    expect(isMarkdownEntry({ name: 'app.ts', mediaType: 'text/plain' })).toBe(false)
  })

  it('renders headings, lists, and code fences from escaped source', () => {
    const html = renderMarkdown('# Title\n\n- item\n\n```ts\nconst n = 1\n```')
    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<li>item</li>')
    expect(html).toContain('<pre><code>const n = 1\n</code></pre>')
  })

  it('escapes raw HTML and rejects non-http links', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;')
    const html = renderMarkdown('see [x](javascript:alert(1)) and [ok](https://example.com)')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('href="https://example.com"')
  })
})
