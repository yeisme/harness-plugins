/**
 * @yeisme/dsh-terminal root entry.
 *
 * This package is the Workbench Core terminal view. It exports the module
 * descriptor and xterm.js-backed React panel; it does not own PTY state.
 *
 * @module @yeisme/dsh-terminal
 */

export { terminalModule } from './module.ts'
export { TerminalPanel } from './client/terminal-panel.tsx'
export type { TerminalPanelProps, TerminalPanelState } from './client/terminal-panel.tsx'
