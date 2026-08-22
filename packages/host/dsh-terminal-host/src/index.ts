/**
 * @yeisme/dsh-terminal-host.
 *
 * This package exposes the host side of the self-maintained DSH terminal
 * panes. DSH remains the canonical owner of PTY state and lifecycle; this
 * host adapts official DSH terminal services through a typed seam.
 *
 * @module @yeisme/dsh-terminal-host
 */

export interface TerminalSessionV1 {
  /** Opaque terminal session id. */
  readonly terminalId: string
  /** Safe display title. */
  readonly title: string
  /** Whether the PTY is still running. */
  readonly running: boolean
  /** ISO timestamp of last output, when known. */
  readonly lastActivityAt?: string | undefined
}

export type TerminalMutationStatus = 'ok' | 'not_implemented' | 'rejected'

export interface TerminalMutationReceiptV1 {
  readonly status: TerminalMutationStatus
  readonly terminalId: string
  /** Typed failure/skip reason; absent when status is ok. */
  readonly reason?: string
}

export interface TerminalHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: 'terminal-host'
  /** Lists terminal sessions visible to the current workspace. */
  listTerminals(): Promise<readonly TerminalSessionV1[]>
  /** Opens a new terminal session. */
  openTerminal(title?: string): Promise<TerminalSessionV1>
  /** Closes a terminal session. */
  closeTerminal(terminalId: string): Promise<TerminalMutationReceiptV1>
  /** Writes raw input to a terminal session. */
  writeInput(terminalId: string, data: string): Promise<TerminalMutationReceiptV1>
  /** Resizes a terminal session. */
  resizeTerminal(terminalId: string, cols: number, rows: number): Promise<TerminalMutationReceiptV1>
}

/** Optional Cordis context key used by Pane providers when a real DSH terminal service is mounted. */
export const TERMINAL_HOST_CONTEXT_KEY = 'dsh.terminalHost' as const

export interface TerminalOutputChunkV2 {
  readonly terminalId: string
  readonly epoch: string
  readonly sequence: number
  readonly data: string
  readonly truncated?: boolean
}

export interface TerminalAttachmentV2 {
  readonly terminalId: string
  readonly epoch: string
  /** Subscribe to owner-authorized VT output chunks. */
  subscribe(listener: (chunk: TerminalOutputChunkV2) => void): () => void
  /** Send user input only after the owner grants this attachment control. */
  writeInput(data: string): Promise<TerminalMutationReceiptV1>
  /** Request a PTY resize through the owner. */
  resize(cols: number, rows: number): Promise<TerminalMutationReceiptV1>
  /** Detach the browser view without killing the PTY. */
  detach(): Promise<void>
}

export interface TerminalHostV2 extends Omit<TerminalHostV1, 'version'> {
  readonly version: '0.2.0-rc.1'
  /** Attach one browser view to an existing owner-owned terminal session. */
  attachTerminal(terminalId: string, options?: { readonly cols?: number; readonly rows?: number; readonly signal?: AbortSignal }): Promise<TerminalAttachmentV2>
}

/**
 * Typed seam into DSH terminal services. This keeps the host contract pure
 * and testable; a real DSH adapter maps these callbacks onto `ctx.terminals`
 * / PTY provider APIs.
 */
export interface DshTerminalSeams {
  listTerminals(): Promise<readonly TerminalSessionV1[]>
  openTerminal(title?: string): Promise<TerminalSessionV1>
  closeTerminal(terminalId: string): Promise<TerminalMutationReceiptV1>
  writeInput(terminalId: string, data: string): Promise<TerminalMutationReceiptV1>
  resizeTerminal(terminalId: string, cols: number, rows: number): Promise<TerminalMutationReceiptV1>
}

export interface DshTerminalV2Seams extends DshTerminalSeams {
  attachTerminal(terminalId: string, options?: { readonly cols?: number; readonly rows?: number; readonly signal?: AbortSignal }): Promise<TerminalAttachmentV2>
}

function isTerminalHostBase(value: unknown): value is Omit<TerminalHostV1, 'version'> & { readonly version: string } {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<TerminalHostV1> & { readonly version?: unknown }
  return candidate.capability === 'terminal-host'
    && typeof candidate.listTerminals === 'function'
    && typeof candidate.openTerminal === 'function'
    && typeof candidate.closeTerminal === 'function'
    && typeof candidate.writeInput === 'function'
    && typeof candidate.resizeTerminal === 'function'
}

/** Runtime guard for an owner-provided terminal host discovered from Cordis. */
export function isTerminalHostV1(value: unknown): value is TerminalHostV1 {
  return isTerminalHostBase(value) && value.version === '0.1.0-rc.1'
}

/** Runtime guard for the interactive host capability used by xterm.js. */
export function isTerminalHostV2(value: unknown): value is TerminalHostV2 {
  return isTerminalHostBase(value)
    && value.version === '0.2.0-rc.1'
    && typeof (value as unknown as Partial<TerminalHostV2>).attachTerminal === 'function'
}

/** Wrap DSH terminal seam callbacks as a `TerminalHostV1`. */
export function createTerminalHost(seams: DshTerminalSeams): TerminalHostV1 {
  return {
    version: '0.1.0-rc.1',
    capability: 'terminal-host',
    listTerminals: seams.listTerminals,
    openTerminal: seams.openTerminal,
    closeTerminal: seams.closeTerminal,
    writeInput: seams.writeInput,
    resizeTerminal: seams.resizeTerminal,
  }
}

/** Wrap the DSH interactive terminal seam without moving PTY ownership into the browser. */
export function createTerminalHostV2(seams: DshTerminalV2Seams): TerminalHostV2 {
  return {
    ...createTerminalHost(seams),
    version: '0.2.0-rc.1',
    attachTerminal: seams.attachTerminal,
  }
}

function notImplemented(terminalId: string): TerminalMutationReceiptV1 {
  return { status: 'not_implemented', terminalId, reason: 'host adapter not wired yet' }
}

/** Placeholder host adapter used until real DSH terminal seams are wired. */
export function createTerminalHostPlaceholder(): TerminalHostV1 {
  return createTerminalHost({
    async listTerminals() {
      return []
    },
    async openTerminal(title = 'Terminal') {
      return { terminalId: 'terminal-placeholder', title, running: false }
    },
    async closeTerminal(terminalId) {
      return notImplemented(terminalId)
    },
    async writeInput(terminalId) {
      return notImplemented(terminalId)
    },
    async resizeTerminal(terminalId) {
      return notImplemented(terminalId)
    },
  })
}
