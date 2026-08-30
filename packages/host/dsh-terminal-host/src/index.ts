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

/**
 * @deprecated Superseded by {@link TerminalHostV2} — retained exactly one RC
 * window for compatibility; migrate before the next minor.
 */
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

/**
 * Additive control lease (V3 6.4). Legacy attachments omit `control` entirely;
 * when present, input MUST only be written while state is 'granted' —
 * ungranted keypresses are dropped, never buffered, and takeover enables
 * input only after the owner grants.
 */
export interface TerminalControlLeaseV1 {
  readonly state: 'granted' | 'pending' | 'denied'
  readonly busy?: boolean | undefined
  subscribe(listener: (state: 'granted' | 'pending' | 'denied') => void): () => void
  requestTakeover?: () => Promise<{ readonly status: 'ok' | 'denied' | 'busy' }> | undefined
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
  /** Optional control lease; absent on legacy attachments (no gate). */
  readonly control?: TerminalControlLeaseV1 | undefined
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

export {
  TERMINAL_PANE_HOST_PLUGIN_NAME,
  TERMINAL_PANE_MAX_READ_LINES,
  TERMINAL_PANE_MAX_SEND_WAIT_MS,
  TERMINAL_PANE_MAX_SESSIONS_PER_OWNER,
  TERMINAL_PANE_REMOTE_SERVICE_KEY,
  TERMINAL_PANE_SPEC_VERSION,
  terminalPaneFailure,
} from './wire.ts'
export type {
  TerminalPaneCloseInputV1,
  TerminalPaneCloseOkV1,
  TerminalPaneCloseResult,
  TerminalPaneFailureCode,
  TerminalPaneFailureV1,
  TerminalPaneListOkV1,
  TerminalPaneListResult,
  TerminalPaneProbeOkV1,
  TerminalPaneProbeResult,
  TerminalPaneReadInputV1,
  TerminalPaneReadOkV1,
  TerminalPaneReadResult,
  TerminalPaneSendInputV1,
  TerminalPaneSendOkV1,
  TerminalPaneSendResult,
  TerminalPaneSignal,
  TerminalPaneSignalInputV1,
  TerminalPaneSignalOkV1,
  TerminalPaneSignalResult,
  TerminalPaneSpawnInputV1,
  TerminalPaneSpawnOkV1,
  TerminalPaneSpawnResult,
  TerminalPaneStatus,
  TerminalPaneSummaryV1,
  TerminalPaneWaitReason,
} from './wire.ts'
export {
  TerminalPaneAdapter,
  createTerminalPaneAdapter,
  isAgentsService,
  terminalsContractGaps,
} from './adapter.ts'
export type { AgentsServiceFace, TerminalsServiceFace, TerminalPaneOwner } from './adapter.ts'
export { TerminalPaneRemoteService, terminalPaneRemoteMarkers } from './remote.ts'
export { apply as terminalPaneHostApply, inject as terminalPaneHostInject, name as terminalPaneHostName } from './plugin.ts'
export { default as terminalPaneHostPlugin } from './plugin.ts'

/**
 * Pure fake host adapter (V3 1.2) for tests and demos: deterministic
 * observe/control/reconnect/exited/error states without a PTY or network.
 * State transitions are scriptable; nothing here touches an owner authority.
 */
export interface FakeTerminalScript {
  /** Chunk stream the fake attachment replays in order after attach. */
  readonly chunks?: readonly { readonly data: string; readonly truncated?: boolean }[]
  /** Rejects the attach promise with this message (error state). */
  readonly attachError?: string | undefined
  /** Attachment behavior once attached. */
  readonly attachment?: {
    readonly epoch?: string | undefined
    readonly controlState?: 'granted' | 'pending' | 'denied' | undefined
  } | undefined
}

export function createFakeTerminalHostV2(script: FakeTerminalScript = {}): TerminalHostV2 {
  const sessions: import('./index.js').TerminalSessionV1[] = [{ terminalId: 'fake-1', title: 'fake', running: true }]
  const receipts = () => ({ status: 'ok' as const, terminalId: 'fake-1' })
  return {
    version: '0.2.0-rc.1',
    capability: 'terminal-host',
    listTerminals: async () => sessions,
    openTerminal: async (title?: string) => {
      const session = { terminalId: `fake-${sessions.length + 1}`, title: title ?? `fake-${sessions.length + 1}`, running: true }
      sessions.push(session)
      return session
    },
    closeTerminal: async () => receipts(),
    writeInput: async () => receipts(),
    resizeTerminal: async () => receipts(),
    attachTerminal: async (terminalId: string, options?: { readonly signal?: AbortSignal | undefined }) => {
      if (script.attachError !== undefined) throw new Error(script.attachError)
      if (options?.signal?.aborted) throw new Error('aborted')
      const epoch = script.attachment?.epoch ?? 'epoch-1'
      let lastSequence = 0
      const listeners = new Set<(chunk: import('./index.js').TerminalOutputChunkV2) => void>()
      const controlState = script.attachment?.controlState ?? 'granted'
      const controlListeners = new Set<(state: 'granted' | 'pending' | 'denied') => void>()
      const attachment: TerminalAttachmentV2 = {
        terminalId,
        epoch,
        subscribe: listener => {
          listeners.add(listener)
          for (const chunk of script.chunks ?? []) {
            listener({ terminalId, epoch, sequence: ++lastSequence, data: chunk.data, ...(chunk.truncated === undefined ? {} : { truncated: chunk.truncated }) })
          }
          return () => { listeners.delete(listener) }
        },
        writeInput: async () => receipts(),
        resize: async () => receipts(),
        detach: async () => { listeners.clear() },
        ...(controlState === undefined ? {} : {
          control: {
            state: controlState,
            subscribe: (listener: (state: 'granted' | 'pending' | 'denied') => void) => {
              controlListeners.add(listener)
              return () => { controlListeners.delete(listener) }
            },
            requestTakeover: async () => {
              for (const listener of controlListeners) listener('granted')
              return { status: 'ok' as const }
            },
          },
        }),
      }
      return attachment
    },
  }
}
