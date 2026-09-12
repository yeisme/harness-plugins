// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { sanitizeStaticHtml, StaticHtmlPreview, STATIC_HTML_MAX_LENGTH } from '../src/client/preview/static-html.tsx'

afterEach(cleanup)

describe('inert HTML structure preview', () => {
  it('does not inherit another renderer persistent sanitizer policy', async () => {
    const { default: sharedPurifier } = await import('dompurify')
    sharedPurifier.setConfig({ ALLOWED_TAGS: ['img'], ALLOWED_ATTR: ['src'] })
    try {
      expect(await sanitizeStaticHtml('<h1>Heading</h1><img src="/unsafe-html-probe">')).toBe('<h1>Heading</h1>')
    } finally { sharedPurifier.clearConfig() }
  })

  it('renders headings, lists and tables while removing execution, network and clobbering surfaces', async () => {
    const source = `<script>globalThis.previewExecuted=true</script><style>body{display:none}</style>
      <meta http-equiv="refresh" content="0;url=/unsafe-html-probe"><base href="/unsafe-html-probe">
      <h1 id="location" class="host-primary" style="color:red" onclick="alert(1)">Report</h1>
      <ul><li>One</li></ul><table><tbody><tr><td colspan="2">Cell</td></tr></tbody></table>
      <img src="/unsafe-html-probe" srcset="/unsafe-html-probe 2x" onerror="alert(1)">
      <form name="document" action="/unsafe-html-probe"><input autofocus name="cookie"></form>
      <iframe srcdoc="<script>alert(1)</script>"></iframe><svg onload="alert(1)"><a href="/unsafe-html-probe">SVG</a></svg>
      <a href="javascript:alert(1)" ping="/unsafe-html-probe">Label</a><object data="/unsafe-html-probe"></object>`
    render(<StaticHtmlPreview source={source} />)
    await screen.findByRole('heading', { name: 'Report' })
    const content = document.querySelector('[data-static-html-content]')!
    expect(content.querySelector('td')?.getAttribute('colspan')).toBe('2')
    expect(content.querySelector('li')?.textContent).toBe('One')
    expect(content.querySelector('script,style,img,iframe,svg,math,form,input,object,embed,link,meta,base,a')).toBeNull()
    expect(content.querySelector('[id],[name],[class],[style],[src],[href],[srcset],[onclick],[onerror]')).toBeNull()
    expect(content.textContent).not.toContain('previewExecuted')
    expect(source).toContain('<script>')
  })

  it('never shows the prior projection while a replacement is being sanitized', async () => {
    const view = render(<StaticHtmlPreview source="<h1>Old source</h1>" />)
    await screen.findByRole('heading', { name: 'Old source' })
    view.rerender(<StaticHtmlPreview source="<h1>New source</h1>" />)
    expect(screen.queryByRole('heading', { name: 'Old source' })).toBeNull()
    await screen.findByRole('heading', { name: 'New source' })
  })

  it('reports limits and empty projections without truncating or executing source', async () => {
    const oversized = 'x'.repeat(STATIC_HTML_MAX_LENGTH + 1)
    expect(await sanitizeStaticHtml(oversized)).toBeUndefined()
    const view = render(<StaticHtmlPreview source={oversized} />)
    expect(screen.getByRole('alert').textContent).toContain('complete source')
    expect(document.querySelector('[data-static-html-content]')).toBeNull()
    view.rerender(<StaticHtmlPreview source="<script>alert(1)</script>" />)
    await waitFor(() => expect(document.querySelector('[data-static-html-state="empty"]')).not.toBeNull())
  })
})
