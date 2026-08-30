/**
 * Semantic icon controls for the pane chrome (V3 2.2).
 *
 * Every icon-only control goes through `WorkbenchIconButton`: the label is
 * required once and drives BOTH the accessible name and the visual tooltip,
 * so a control can never ship a bare glyph (`+`, `×`, a first letter) without
 * an aria-label. Status is semantic (`data-status`), never color-only.
 *
 * @module @yeisme/dsh-client-ui-pane-workbench/chrome
 */
import { createElement, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { WorkbenchIcon, isWorkbenchIconName, type WorkbenchIconName } from '../icon.js'

export type WorkbenchControlStatus = 'default' | 'active' | 'critical'

export interface WorkbenchIconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'children'> {
  /** Semantic icon from the frozen set; required for icon-only controls. */
  readonly icon: WorkbenchIconName
  /** Accessible label AND tooltip text — the single source of control meaning. */
  readonly label: string
  /** Semantic status variant; styling maps tone, never color alone. */
  readonly status?: WorkbenchControlStatus
  /** Optional non-text badge (count dot) rendered beside the glyph. */
  readonly badge?: ReactNode
}

/** Icon-only control: one required label drives aria-label + tooltip + status. */
export function WorkbenchIconButton(props: WorkbenchIconButtonProps): ReactNode {
  const { icon, label, status = 'default', badge, disabled, ...rest } = props
  if (!isWorkbenchIconName(icon)) {
    throw new Error(`WorkbenchIconButton icon must be a frozen semantic name, got: ${String(icon)}`)
  }
  return createElement(
    'span',
    { className: 'pwr-tip', 'data-tip': label },
    createElement(
      'button',
      {
        ...rest,
        type: 'button',
        className: `pwr-icon${rest.className === undefined ? '' : ` ${rest.className}`}`,
        'aria-label': label,
        'aria-disabled': disabled === true || undefined,
        'data-status': status === 'default' ? undefined : status,
        disabled,
      },
      createElement(WorkbenchIcon, { name: icon }),
      badge === undefined ? null : createElement('span', { className: 'pwr-icon-badge', 'aria-hidden': 'true' }, badge),
    ),
  )
}

/** Text-bearing control with the same tooltip contract (toolbar buttons with labels). */
export function WorkbenchTextButton(props: {
  readonly label: string
  readonly children: ReactNode
  readonly status?: WorkbenchControlStatus
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'children'>): ReactNode {
  const { label, status = 'default', children, ...rest } = props
  return createElement(
    'span',
    { className: 'pwr-tip', 'data-tip': label },
    createElement(
      'button',
      {
        ...rest,
        type: 'button',
        'aria-label': label,
        'data-status': status === 'default' ? undefined : status,
      },
      children,
    ),
  )
}
