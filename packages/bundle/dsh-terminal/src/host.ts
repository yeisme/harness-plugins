/**
 * DSH loader entry for the terminal Host face.
 *
 * Keep this entry free of React, browser primitives and styles. The browser
 * half remains available through `@yeisme/dsh-terminal/client`.
 */

import {
  terminalPaneHostApply as hostApply,
  terminalPaneHostInject as hostInject,
  terminalPaneHostName as hostName,
} from '@yeisme/dsh-terminal-host'

export const name = hostName
export const inject = hostInject
export const apply = hostApply

const DshTerminalHostPlugin = { name, inject, apply }
export default DshTerminalHostPlugin
