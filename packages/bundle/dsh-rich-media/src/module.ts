/**
 * Rich Media Workbench module descriptor.
 *
 * This is the Workbench Core module contributed by `@yeisme/dsh-rich-media`.
 * It is a plain headless descriptor and can be imported by node-side code.
 *
 * @module @yeisme/dsh-rich-media/module
 */

import type { WorkbenchModuleDefinitionV1 } from '@yeisme/dsh-workbench-core'

export const richMediaWorkbenchModule: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-rich-media',
  version: '0.1.0-rc.1',
  title: 'Rich Media',
  description: 'DSH rich media library and preview workbench',
  requiredCapabilities: [],
  tabs: [
    { id: 'media', moduleId: 'dsh-rich-media', title: '媒体库', order: 0, closable: false, scope: 'session-maybe' },
  ],
  commands: [
    { id: 'media.open', moduleId: 'dsh-rich-media', title: '打开媒体' },
    { id: 'media.download', moduleId: 'dsh-rich-media', title: '下载媒体' },
  ],
}
