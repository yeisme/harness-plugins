/**
 * Fixture stand-in for `@deepseek-ai/dsh-client-ui-primitives`.
 *
 * In production the host ModuleLoader supplies these components; the visual
 * harness has no host, so this module provides minimal semantic equivalents
 * (button/input/dialog/menu) with the same prop surface the plugins use.
 * It also publishes `window.FixturePrimitives` so the CJS client bundle's
 * `require('@deepseek-ai/dsh-client-ui-primitives')` resolves to this stub.
 */

const React = window.React
const h = React.createElement

export function Button({ className, variant, size, active, icon, ...rest }) {
  return h('button', {
    className: ['fx-btn', className].filter(Boolean).join(' '),
    'data-variant': variant ?? 'default',
    'data-size': size ?? 'md',
    'data-active': active === true ? 'true' : undefined,
    ...rest,
  })
}

export function Pill({ className, active, ...rest }) {
  return h(Button, { className: ['fx-pill', className].filter(Boolean).join(' '), 'aria-pressed': active === true, active, ...rest })
}

export function Input({ className, ...rest }) {
  return h('input', { className: ['fx-input', className].filter(Boolean).join(' '), ...rest })
}

export function DisclosureRow({ className, title, children, defaultOpen = false, ...rest }) {
  return h('details', { className: ['fx-disclosure', className].filter(Boolean).join(' '), open: defaultOpen || undefined, ...rest },
    h('summary', null, title),
    children)
}

export function Modal({ open, onClose, title, closeLabel, headless, children }) {
  if (!open) return null
  return h('div', {
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': typeof title === 'string' ? title : 'Dialog',
    className: 'fx-modal',
    onKeyDown: (event) => { if (event.key === 'Escape') onClose?.() },
  },
    h('div', { className: 'fx-modal-head' },
      h('strong', null, title),
      h(Button, { type: 'button', onClick: () => onClose?.() }, closeLabel ?? 'Close')),
    h('div', { className: 'fx-modal-body' }, children))
}

export function Menu({ className, children, ...rest }) {
  return h('div', { role: 'menu', className: ['fx-menu', className].filter(Boolean).join(' '), ...rest }, children)
}

window.FixturePrimitives = { Button, Pill, Input, DisclosureRow, Modal, Menu }
