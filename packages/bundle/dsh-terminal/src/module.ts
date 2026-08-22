/**
 * Terminal Workbench module.
 *
 * This module contributes the terminal view descriptor. It does not own PTY
 * state; DSH terminal remains the canonical owner.
 *
 * @module @yeisme/dsh-terminal/module
 */

import type { WorkbenchModuleDefinitionV1 } from '@yeisme/dsh-workbench-core'

export const terminalModule: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-terminal',
  version: '0.1.0-rc.1',
  title: 'Terminal',
  description: 'Terminal projection workbench module',
  requiredCapabilities: [],
  tabs: [
    { id: 'terminal', moduleId: 'dsh-terminal', title: '终端', order: 200, closable: true, scope: 'session-maybe' },
  ],
  commands: [
    { id: 'terminal.open', moduleId: 'dsh-terminal', title: '打开终端' },
    { id: 'terminal.reconnect', moduleId: 'dsh-terminal', title: '重连终端' },
  ],
}
