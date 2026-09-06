/**
 * Single-point token declaration for Rich Media roots that render outside a
 * `Surface` (chat media cards, gallery compare, zoom overlay, legacy
 * workbench). `Surface` roots already declare the same variables through
 * `@yeisme/dsh-client-ui-surface`; this module repeats only the declaration
 * block so embed renderers resolve the identical `--vk-*` vocabulary.
 *
 * The string is a byte-stable constant: duplicate injection is idempotent by
 * construction, matching `buildPanelStyles` semantics in the visual kit
 * (dsh-unified-panel-visual-system §2.2 — one scoped declaration, no
 * package-local fallback literals at consumption sites).
 *
 * @module @yeisme/dsh-rich-media/client
 */

import { PANEL_SCALE, PANEL_TOKENS, panelVar, type PanelTokenName } from '@yeisme/dsh-client-ui-visual-kit'

/** Roots that must resolve `--vk-*` without a `Surface` ancestor. */
const EMBED_ROOTS = [
  '[data-dsh-rich-media-kind]',
  '[data-dsh-rich-media-compare]',
  '[data-dsh-rich-media-zoom]',
  '[data-dsh-rich-media-workbench]',
  '[data-dsh-media-preview-pane]',
] as const

const TOKEN_NAMES = Object.keys(PANEL_TOKENS) as PanelTokenName[]

function declarations(): string {
  const tokens = TOKEN_NAMES.map(name => `--vk-${name}:${panelVar(name)}`).join(';')
  const scale = [
    `--vk-radius-sm:${PANEL_SCALE.radius.sm}`,
    `--vk-radius-md:${PANEL_SCALE.radius.md}`,
    `--vk-radius-lg:${PANEL_SCALE.radius.lg}`,
    `--vk-radius-xl:${PANEL_SCALE.radius.xl}`,
    `--vk-ctrl-icon:${PANEL_SCALE.control.icon}`,
    `--vk-ctrl-button:${PANEL_SCALE.control.button}`,
    `--vk-ctrl-input:${PANEL_SCALE.control.input}`,
    `--vk-font-micro:${PANEL_SCALE.font.micro}`,
    `--vk-font-small:${PANEL_SCALE.font.small}`,
    `--vk-font-body:${PANEL_SCALE.font.body}`,
    `--vk-font-strong:${PANEL_SCALE.font.strong}`,
    `--vk-font-heading:${PANEL_SCALE.font.heading}`,
    `--vk-font-title:${PANEL_SCALE.font.title}`,
  ].join(';')
  return `${tokens};${scale}`
}

const focusRing = `${EMBED_ROOTS.map(root => `${root} button:focus-visible,${root} a:focus-visible`).join(',')}{outline:2px solid var(--vk-border-focus);outline-offset:2px}`

/** Scoped `--vk-*` declaration block shared by every embed root. */
export const RICH_MEDIA_EMBED_TOKENS = `${EMBED_ROOTS.map(root => `${root}{${declarations()}}`).join('\n')}\n${focusRing}\n`
