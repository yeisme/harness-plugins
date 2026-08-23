/**
 * 编辑器与分组的内置文案（zh/en）。宿主可用 register 选项覆盖；
 * provider 的“未标记”组文案跟随 locale 注册。
 *
 * @module @yeisme/dsh-client-ui-session-tags/client/locales
 */

import type { TagEditorOverlayLabels } from './TagEditorOverlay.tsx'

export const NS = 'session-tags' as const

export const en = {
  'manage-tags': 'Manage tags',
  'by-tags': 'By tags',
  untagged: 'Untagged',
  'editor-title': 'Manage tags',
  'editor-input-label': 'New tag',
  'editor-add': 'Add tag',
  'editor-save': 'Save',
  'editor-cancel': 'Cancel',
  'editor-remove': 'Remove tag',
  'editor-suggestions': 'Existing tags',
  'editor-conflict': 'Tags changed elsewhere. Updated tags are shown; review and save again.',
  'editor-error': 'Cannot save tags.',
  'editor-busy': 'Saving tags…',
} as const

export type SessionTagsKey = keyof typeof en

export const zh: Record<SessionTagsKey, string> = {
  'manage-tags': '管理标签',
  'by-tags': '按标签',
  untagged: '未标记',
  'editor-title': '管理标签',
  'editor-input-label': '新标签',
  'editor-add': '添加标签',
  'editor-save': '保存',
  'editor-cancel': '取消',
  'editor-remove': '移除标签',
  'editor-suggestions': '既有标签',
  'editor-conflict': '标签已在别处更新。已展示最新标签，请确认后再保存。',
  'editor-error': '无法保存标签。',
  'editor-busy': '正在保存标签…',
}

/** 由字典派生的 overlay 文案包。 */
export function overlayLabelsFrom(dict: Record<SessionTagsKey, string>): TagEditorOverlayLabels {
  return {
    title: dict['editor-title'],
    inputLabel: dict['editor-input-label'],
    add: dict['editor-add'],
    save: dict['editor-save'],
    cancel: dict['editor-cancel'],
    removeLabel: tag => `${dict['editor-remove']} ${tag}`,
    suggestionsTitle: dict['editor-suggestions'],
    conflictNotice: dict['editor-conflict'],
    errorNotice: dict['editor-error'],
    busy: dict['editor-busy'],
  }
}
