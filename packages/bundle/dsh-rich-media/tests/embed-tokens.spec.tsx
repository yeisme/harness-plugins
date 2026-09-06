import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { HOST_THEME_ALIASES, PANEL_TOKENS } from '@yeisme/dsh-client-ui-visual-kit'
import { RICH_MEDIA_EMBED_TOKENS } from '../src/client/embed-tokens.ts'
import { MediaCompareView, MediaZoomOverlay } from '../src/client/media-gallery.tsx'
import { RichMediaCard } from '../src/client/media-card.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

const ROOT_SELECTORS = [
  '[data-dsh-rich-media-kind]',
  '[data-dsh-rich-media-compare]',
  '[data-dsh-rich-media-zoom]',
  '[data-dsh-rich-media-workbench]',
  '[data-dsh-media-preview-pane]',
]

/** Retired local fallbacks and the foreign `--dsh-color-*` vocabulary. */
const LEGACY_VOCABULARY = ['--dsh-color-', '#3d4550', '#18202b', '#4f8cff', '#1e1e20', '#29292c', '#202022', '#141416']

const imageRef: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  width: 100,
  height: 80,
  title: 'Example image',
  capabilities: ['preview'],
}

describe('rich-media embed token declaration', () => {
  it('declares every canonical token per embed root through the visual-kit fallback chain', () => {
    for (const root of ROOT_SELECTORS) {
      expect(RICH_MEDIA_EMBED_TOKENS).toContain(`${root}{`)
    }
    for (const [name, fallback] of Object.entries(PANEL_TOKENS)) {
      const alias = HOST_THEME_ALIASES[name]
      const value = alias === undefined ? fallback : `var(--dsw-alias-${alias},${fallback})`
      expect(RICH_MEDIA_EMBED_TOKENS).toContain(`--vk-${name}:var(--dsw-alias-${name},${value})`)
    }
    expect(RICH_MEDIA_EMBED_TOKENS).toContain('--vk-radius-sm:6px')
    expect(RICH_MEDIA_EMBED_TOKENS).toContain('--vk-ctrl-input:34px')
  })

  it('stays free of the retired local vocabulary', () => {
    for (const legacy of LEGACY_VOCABULARY) {
      expect(RICH_MEDIA_EMBED_TOKENS).not.toContain(legacy)
    }
  })

  it('adds one scoped focus ring using the canonical focus token', () => {
    expect(RICH_MEDIA_EMBED_TOKENS).toContain('button:focus-visible')
    expect(RICH_MEDIA_EMBED_TOKENS).toContain('{outline:2px solid var(--vk-border-focus);outline-offset:2px}')
  })

  it('mounts the declaration inside the card root', () => {
    const html = renderToStaticMarkup(<RichMediaCard media={imageRef} src={undefined} />)
    expect(html).toContain('data-dsh-rich-media-kind="image"')
    expect(html).toContain('--vk-accent:var(--dsw-alias-accent,var(--dsw-alias-state-business-primary,#79b8ff))')
  })

  it('mounts the declaration inside the compare and zoom roots', () => {
    const items = [{ key: 'a', media: imageRef }, { key: 'b', media: imageRef }]
    const compare = renderToStaticMarkup(
      <MediaCompareView items={items} texts={{ aria: 'compare', empty: 'empty' }} />,
    )
    expect(compare).toContain('data-dsh-rich-media-compare="ready"')
    expect(compare).toContain('--vk-border-l2:var(--dsw-alias-border-l2,')
    const zoom = renderToStaticMarkup(
      <MediaZoomOverlay item={items[0]} scale={2} onZoomIn={() => {}} onZoomOut={() => {}} onClose={() => {}} texts={{ aria: 'zoom', zoomIn: 'in', zoomOut: 'out', close: 'close' }} />,
    )
    expect(zoom).toContain('data-dsh-rich-media-zoom')
    expect(zoom).toContain('background:var(--vk-bg-layer-1)')
  })

  it('keeps client sources free of the retired vocabulary', () => {
    for (const file of ['media-card.tsx', 'media-gallery.tsx', 'workbench.tsx', 'media-preview-pane.tsx']) {
      const source = readFileSync(fileURLToPath(new URL(`../src/client/${file}`, import.meta.url)), 'utf8')
      for (const legacy of LEGACY_VOCABULARY) {
        expect(source, `${file} still contains ${legacy}`).not.toContain(legacy)
      }
    }
  })
})
