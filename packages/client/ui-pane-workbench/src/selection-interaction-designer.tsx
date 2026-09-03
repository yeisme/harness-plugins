/**
 * Workspace Designer「Selection & Interaction」区（Selection Interaction V2）。
 *
 * 按 context 配置动作 visibility、canonical order、shortcut、density 与
 * preset；只编辑有界 UI 偏好（canonical id + 枚举值），不承载 anchor 内容、
 * 路径、URL 或 owner payload。未知 id / 非法快捷键不进入偏好，交由
 * `mergeSelectionPreferences` 的 fail-closed 诊断兜底。
 */

import { createElement, useState, type ReactNode } from 'react'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import { SurfaceSection } from '@yeisme/dsh-client-ui-surface'
import { t } from './i18n/locale.js'

export const SELECTION_DESIGNER_CONTEXTS = ['text', 'source', 'image-region', 'table-range', 'editable-control'] as const
export type SelectionDesignerContext = (typeof SELECTION_DESIGNER_CONTEXTS)[number]

/** 与 ui-interaction-space `SelectionContextPreference` 结构兼容（本地最小面，避免整层依赖）。 */
export interface SelectionDesignerContextPreference {
  readonly actions?: readonly { readonly id: string; readonly visible?: boolean }[]
  readonly order?: readonly string[]
  readonly shortcut?: string
  readonly density?: 'compact' | 'comfortable'
  readonly preset?: 'default' | 'review' | 'edit' | 'custom'
}

export type SelectionDesignerPreferences = Readonly<Partial<Record<SelectionDesignerContext, SelectionDesignerContextPreference>>>

/** 已知 canonical 动作 id（内置集；扩展动作经 registry 注入后可扩展本清单）。 */
export const SELECTION_DESIGNER_BUILTIN_IDS: readonly string[] = [
  'dsh:ask', 'dsh:comment', 'dsh:copy-quote', 'dsh:edit', 'dsh:analyze', 'dsh:add-to-batch', 'dsh:open-full',
]

const SHORTCUT_PATTERN = /^(?:Alt|Ctrl|Meta|Shift)(?:\+(?:Alt|Ctrl|Meta|Shift)){0,2}\+[A-Za-z][A-Za-z0-9]{0,11}$/

export interface SelectionInteractionDesignerSectionProps {
  readonly preferences: SelectionDesignerPreferences
  readonly knownActionIds?: readonly string[]
  readonly onChange: (next: SelectionDesignerPreferences) => void
}

function contextLabel(kind: SelectionDesignerContext): string {
  return t(`designer.selection.context.${kind}`)
}

export function SelectionInteractionDesignerSection(props: SelectionInteractionDesignerSectionProps): ReactNode {
  const [openContext, setOpenContext] = useState<SelectionDesignerContext>('text')
  const known = props.knownActionIds ?? SELECTION_DESIGNER_BUILTIN_IDS
  const contextTabs = SELECTION_DESIGNER_CONTEXTS.map(kind => createElement(Button, {
    key: kind,
    type: 'button',
    size: 'sm',
    variant: 'toolbar',
    role: 'tab',
    'aria-selected': openContext === kind,
    onClick: () => { void kind; setOpenContext(kind) },
  }, createElement('span', { 'data-selection-context-tab': kind }, contextLabel(kind))))
  const panel = renderContextPanel(openContext, props.preferences[openContext], known, props.onChange)
  return createElement(SurfaceSection, {
    className: 'pwr-designer-selection',
    'data-pane-designer-slot': 'selection-interaction',
    title: t('designer.selection.title'),
    description: t('designer.selection.description'),
  }, createElement('div', { role: 'tablist', 'aria-label': t('designer.selection.contexts') }, ...contextTabs), ...panel)
}

function renderContextPanel(
  kind: SelectionDesignerContext,
  current: SelectionDesignerContextPreference | undefined,
  known: readonly string[],
  onChange: (next: SelectionDesignerPreferences) => void,
): ReactNode[] {
  const hidden = new Set((current?.actions ?? []).filter(action => action.visible === false).map(action => action.id))
  const order = current?.order ?? known
  const patch = (partial: Partial<SelectionDesignerContextPreference>): void => {
    onChange({ [kind]: { ...current, ...partial } } as SelectionDesignerPreferences)
  }
  const nodes: ReactNode[] = []

  // 动作可见性（canonical id 有界集合）。
  nodes.push(createElement('div', { key: 'visibility', 'data-selection-pref': 'visibility' },
    createElement('p', null, t('designer.selection.visibility')),
    ...known.map(id => createElement('label', { key: id, 'data-selection-action': id },
      createElement('input', {
        type: 'checkbox',
        checked: !hidden.has(id),
        onChange: (event: { currentTarget: { checked: boolean } }) => {
          const next = new Set(hidden)
          if (event.currentTarget.checked) next.delete(id)
          else next.add(id)
          patch({ actions: known.map(actionId => ({ id: actionId, visible: !next.has(actionId) })) })
        },
      }),
      createElement('span', null, id),
    )),
  ))

  // 顺序（上移/下移；只记录 canonical id）。
  nodes.push(createElement('div', { key: 'order', 'data-selection-pref': 'order' },
    createElement('p', null, t('designer.selection.order')),
    createElement('ol', { 'data-selection-order': order.join(',') },
      ...order.map((id, index) => createElement('li', { key: `${id}-${index}`, 'data-selection-order-item': id },
        createElement('span', null, id),
        createElement(Button, {
          type: 'button', size: 'sm', variant: 'toolbar', 'aria-label': `move up ${id}`,
          disabled: index === 0,
          onClick: () => {
            const next = [...order]
            const previous = next[index - 1]
            next[index - 1] = next[index]!
            next[index] = previous!
            patch({ order: next })
          },
        }, '↑'),
        createElement(Button, {
          type: 'button', size: 'sm', variant: 'toolbar', 'aria-label': `move down ${id}`,
          disabled: index === order.length - 1,
          onClick: () => {
            const next = [...order]
            const following = next[index + 1]
            next[index + 1] = next[index]!
            next[index] = following!
            patch({ order: next })
          },
        }, '↓'),
      ))),
  ))

  // 快捷键（非法输入不进入偏好）。
  nodes.push(createElement('label', { key: 'shortcut', className: 'ys-field', 'data-selection-pref': 'shortcut' },
    createElement('span', null, t('designer.selection.shortcut')),
    createElement('input', {
      type: 'text',
      defaultValue: current?.shortcut ?? 'Alt+Enter',
      'aria-label': t('designer.selection.shortcut'),
      onBlur: (event: { currentTarget: { value: string } }) => {
        const value = event.currentTarget.value.trim()
        if (value === '' || SHORTCUT_PATTERN.test(value)) patch({ shortcut: value === '' ? undefined : value })
        else event.currentTarget.value = current?.shortcut ?? 'Alt+Enter'
      },
    }),
  ))

  // 密度与 preset。
  nodes.push(createElement('label', { key: 'density', className: 'ys-field', 'data-selection-pref': 'density' },
    createElement('span', null, t('designer.selection.density')),
    createElement('select', {
      value: current?.density ?? 'comfortable',
      onChange: (event: { currentTarget: { value: string } }) => patch({ density: event.currentTarget.value as 'compact' | 'comfortable' }),
    },
      createElement('option', { value: 'comfortable' }, 'comfortable'),
      createElement('option', { value: 'compact' }, 'compact')),
  ))
  nodes.push(createElement('label', { key: 'preset', className: 'ys-field', 'data-selection-pref': 'preset' },
    createElement('span', null, t('designer.selection.preset')),
    createElement('select', {
      value: current?.preset ?? 'default',
      onChange: (event: { currentTarget: { value: string } }) => patch({ preset: event.currentTarget.value as 'default' | 'review' | 'edit' | 'custom' }),
    },
      createElement('option', { value: 'default' }, 'default'),
      createElement('option', { value: 'review' }, 'review'),
      createElement('option', { value: 'edit' }, 'edit'),
      createElement('option', { value: 'custom' }, 'custom')),
  ))
  return nodes
}
