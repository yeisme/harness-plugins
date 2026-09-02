/**
 * Visual tokens for Slash Assist, Palette, receipt, Popover, Sheet, and Pane.
 * Reuses ui-visual-kit; no new design-system dependency.
 */

import { PANEL_SCALE, PANEL_TOKENS, statusTone, type StatusTone } from '@yeisme/dsh-client-ui-visual-kit'

export const COMMAND_SHELL_RADIUS = {
  control: PANEL_SCALE.radius.sm,
  overlay: PANEL_SCALE.radius.lg,
} as const

export const COMMAND_SHELL_SPACING = [4, 8, 12, 16, 24] as const

export function commandTone(kind: 'neutral' | 'warning' | 'critical'): StatusTone {
  if (kind === 'warning') return statusTone('stale')
  if (kind === 'critical') return statusTone('error')
  return statusTone('neutral')
}

export function commandShellTokens(): {
  readonly background: string
  readonly border: string
  readonly text: string
  readonly radius: typeof COMMAND_SHELL_RADIUS
  readonly spacing: typeof COMMAND_SHELL_SPACING
} {
  return {
    background: PANEL_TOKENS['bg-elevated'],
    border: PANEL_TOKENS['border-l1'],
    text: PANEL_TOKENS['text-primary'],
    radius: COMMAND_SHELL_RADIUS,
    spacing: COMMAND_SHELL_SPACING,
  }
}
