import type { PaneWorkbenchController } from '../controller.js'
import { t } from '../i18n/locale.js'
import type { PaneViewRegistry } from '../view-registry.js'
import { SourceControlView } from './source-control.js'
import { DSH_SOURCE_CONTROL_RESOURCE_KEY, DSH_SOURCE_CONTROL_VIEW_KIND } from './source-control.js'

export function registerSourceControlProvider(registry: PaneViewRegistry): () => void {
  if (registry.has(DSH_SOURCE_CONTROL_VIEW_KIND)) return () => {}
  return registry.registerView({
    descriptor: {
      kind: DSH_SOURCE_CONTROL_VIEW_KIND,
      label: 'Source Control',
      componentKey: 'dsh-source-control',
      role: 'navigator',
      preferredRegion: 'right',
      retention: 'keep-alive',
      singleton: true,
    },
    component: SourceControlView,
    showInPicker: true,
    i18n: { namespace: 'paneWorkbench', labelKey: 'rail.sourceControl' },
  })
}

export function openSourceControlNavigator(controller: PaneWorkbenchController): void {
  controller.openView({
    kind: DSH_SOURCE_CONTROL_VIEW_KIND,
    resourceKey: DSH_SOURCE_CONTROL_RESOURCE_KEY,
    role: 'navigator',
    preferredRegion: 'right',
    retention: 'keep-alive',
    singleton: true,
    preview: false,
    pinned: true,
    title: t('rail.sourceControl'),
  })
}
