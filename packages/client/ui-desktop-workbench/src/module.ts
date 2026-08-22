/**
 * Desktop Workbench module descriptor.
 *
 * This module composes session, file, terminal, media, and notification tabs
 * into the Workbench Core shell. It does not own domain state.
 *
 * @module @yeisme/dsh-client-ui-desktop-workbench/module
 */

import type { WorkbenchModuleDefinitionV1 } from '@yeisme/dsh-workbench-core'

export const desktopWorkbenchModule: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-desktop-workbench',
  version: '0.1.0-rc.1',
  title: 'Desktop Workbench',
  description: 'Self-maintained DSH desktop workbench shell',
  requiredCapabilities: [],
  tabs: [
    { id: 'desktop-sessions', moduleId: 'dsh-desktop-workbench', title: '会话', order: 10, closable: false, scope: 'root' },
    { id: 'desktop-notifications', moduleId: 'dsh-desktop-workbench', title: '通知', order: 40, closable: true, scope: 'root' },
    { id: 'desktop-search', moduleId: 'dsh-desktop-workbench', title: '历史搜索', order: 50, closable: true, scope: 'root' },
  ],
  commands: [
    { id: 'desktop.workbench.toggle', moduleId: 'dsh-desktop-workbench', title: '切换 Desktop Workbench' },
    { id: 'desktop.session.open', moduleId: 'dsh-desktop-workbench', title: '打开会话管理' },
    { id: 'desktop.notifications.open', moduleId: 'dsh-desktop-workbench', title: '打开通知中心' },
    { id: 'desktop.search.open', moduleId: 'dsh-desktop-workbench', title: '打开历史搜索' },
  ],
}
