import { createElement, type ReactNode } from 'react'
import { t } from '../i18n/locale.js'
import type { PaneLocalViewProps, PaneViewRegistry } from '../view-registry.js'
import { DSH_FILE_PREVIEW_VIEW_KIND } from './provider.js'
import type { FileLifecycleActionV1, FileLifecycleStatusV1 } from './file-lifecycle.js'

export function FilePreviewView({ view }: PaneLocalViewProps): ReactNode {
  const status: FileLifecycleStatusV1 = view.status === 'conflict' ? 'conflict' : view.stale || view.status === 'stale' ? 'stale' : 'ready'
  const actions: readonly FileLifecycleActionV1[] = status === 'conflict'
    ? ['compare', 'reload', 'save_as', 'keep_local']
    : status === 'stale'
      ? ['compare', 'reload', 'keep_local']
      : []
  return createElement('section', { className: 'pwr-file-preview', 'data-file-status': status },
    createElement('h2', null, view.title),
    status === 'ready' ? null : createElement('p', { role: 'status' }, status === 'conflict' ? t('state.conflict') : t('state.stale')),
    ...actions.map(action => createElement('button', { key: action, type: 'button', 'data-file-action': action }, t(`explorer.action.${action}`))),
  )
}

export function registerFilePreviewProvider(registry: PaneViewRegistry): () => void {
  if (registry.has(DSH_FILE_PREVIEW_VIEW_KIND)) return () => {}
  return registry.registerView({
    descriptor: {
      kind: DSH_FILE_PREVIEW_VIEW_KIND,
      label: 'File',
      componentKey: 'dsh-file-preview',
      role: 'content',
      preferredRegion: 'right',
      retention: 'recreate',
      singleton: false,
    },
    component: FilePreviewView,
    showInPicker: false,
    i18n: { namespace: 'paneWorkbench', labelKey: 'explorer.openFile' },
  })
}
