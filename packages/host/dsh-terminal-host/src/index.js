/**
 * @yeisme/dsh-terminal-host.
 *
 * This package exposes the host side of the self-maintained DSH terminal
 * panes. DSH remains the canonical owner of PTY state and lifecycle; this
 * host adapts official DSH terminal services through a typed seam.
 *
 * @module @yeisme/dsh-terminal-host
 */
/** Optional Cordis context key used by Pane providers when a real DSH terminal service is mounted. */
export const TERMINAL_HOST_CONTEXT_KEY = 'dsh.terminalHost';
function isTerminalHostBase(value) {
    if (typeof value !== 'object' || value === null)
        return false;
    const candidate = value;
    return candidate.capability === 'terminal-host'
        && typeof candidate.listTerminals === 'function'
        && typeof candidate.openTerminal === 'function'
        && typeof candidate.closeTerminal === 'function'
        && typeof candidate.writeInput === 'function'
        && typeof candidate.resizeTerminal === 'function';
}
/** Runtime guard for an owner-provided terminal host discovered from Cordis. */
export function isTerminalHostV1(value) {
    return isTerminalHostBase(value) && value.version === '0.1.0-rc.1';
}
/** Runtime guard for the interactive host capability used by xterm.js. */
export function isTerminalHostV2(value) {
    return isTerminalHostBase(value)
        && value.version === '0.2.0-rc.1'
        && typeof value.attachTerminal === 'function';
}
/** Wrap DSH terminal seam callbacks as a `TerminalHostV1`. */
export function createTerminalHost(seams) {
    return {
        version: '0.1.0-rc.1',
        capability: 'terminal-host',
        listTerminals: seams.listTerminals,
        openTerminal: seams.openTerminal,
        closeTerminal: seams.closeTerminal,
        writeInput: seams.writeInput,
        resizeTerminal: seams.resizeTerminal,
    };
}
/** Wrap the DSH interactive terminal seam without moving PTY ownership into the browser. */
export function createTerminalHostV2(seams) {
    return {
        ...createTerminalHost(seams),
        version: '0.2.0-rc.1',
        attachTerminal: seams.attachTerminal,
    };
}
function notImplemented(terminalId) {
    return { status: 'not_implemented', terminalId, reason: 'host adapter not wired yet' };
}
/** Placeholder host adapter used until real DSH terminal seams are wired. */
export function createTerminalHostPlaceholder() {
    return createTerminalHost({
        async listTerminals() {
            return [];
        },
        async openTerminal(title = 'Terminal') {
            return { terminalId: 'terminal-placeholder', title, running: false };
        },
        async closeTerminal(terminalId) {
            return notImplemented(terminalId);
        },
        async writeInput(terminalId) {
            return notImplemented(terminalId);
        },
        async resizeTerminal(terminalId) {
            return notImplemented(terminalId);
        },
    });
}
