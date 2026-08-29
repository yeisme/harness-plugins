import {
  ArtifactIntentSchema,
  PaneActionReceiptSchema,
  PaneCommandDescriptorSchema,
  type ArtifactIntentV1,
  type PaneActionReceiptV1,
  type PaneCommandDescriptorV1,
} from '@yeisme/dsh-pane-protocol'

export type PaneCommandHandler = () => unknown | Promise<unknown>

export interface PaneCommandRegistrationV1 {
  readonly descriptor: PaneCommandDescriptorV1
  readonly execute: PaneCommandHandler
}

export class PaneCommandRegistrationError extends Error {
  constructor(readonly code: 'contract_mismatch' | 'duplicate_command' | 'unknown_command', message: string) {
    super(message)
    this.name = 'PaneCommandRegistrationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Local command catalog shared by the view picker, header launcher, and command palette. */
export class PaneCommandRegistry {
  private readonly registrations = new Map<string, PaneCommandRegistrationV1>()
  private readonly listeners = new Set<() => void>()

  register(input: unknown): () => void {
    if (!isRecord(input) || !isRecord(input.descriptor) || typeof input.execute !== 'function') {
      throw new PaneCommandRegistrationError('contract_mismatch', 'A pane command requires a typed descriptor and a local execute function.')
    }
    const descriptor = PaneCommandDescriptorSchema.safeParse(input.descriptor)
    if (!descriptor.success) throw new PaneCommandRegistrationError('contract_mismatch', 'Pane command descriptor does not match the safe contract.')
    if (this.registrations.has(descriptor.data.id)) {
      throw new PaneCommandRegistrationError('duplicate_command', `Pane command ${descriptor.data.id} is already registered.`)
    }
    const registration = { descriptor: descriptor.data, execute: input.execute as PaneCommandHandler }
    this.registrations.set(descriptor.data.id, registration)
    this.emit()
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.registrations.get(descriptor.data.id) === registration) {
        this.registrations.delete(descriptor.data.id)
        this.emit()
      }
    }
  }

  snapshot(): readonly PaneCommandRegistrationV1[] {
    return [...this.registrations.values()].sort((left, right) => {
      const leftOrder = left.descriptor.presentation?.order ?? 0
      const rightOrder = right.descriptor.presentation?.order ?? 0
      return leftOrder - rightOrder || left.descriptor.label.localeCompare(right.descriptor.label)
    })
  }

  async execute(id: string): Promise<unknown> {
    const registration = this.registrations.get(id)
    if (registration === undefined) throw new PaneCommandRegistrationError('unknown_command', `Pane command ${id} is not registered.`)
    return registration.execute()
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try { listener() } catch { /* a command subscriber cannot block registry disposal */ }
    }
  }
}

export interface PaneIntentHandlerRegistrationV1 {
  readonly id: string
  readonly intents?: readonly ArtifactIntentV1['intent'][]
  readonly targetOwners?: readonly string[]
  readonly priority?: number
  readonly handle: (intent: ArtifactIntentV1) => PaneActionReceiptV1 | Promise<PaneActionReceiptV1>
}

const HANDLER_ID = /^[a-z0-9][a-z0-9._:/-]*$/i
const INTENTS = new Set<ArtifactIntentV1['intent']>(['open', 'compare', 'attach_context', 'transform', 'handoff', 'link'])

function safeReceiptRef(input: ArtifactIntentV1): string {
  const suffix = input.idempotencyKey.replace(/[^a-z0-9._:-]/gi, '-').slice(0, 96) || 'unknown'
  return `receipt:pane:${suffix}`
}

const ADMISSION_LEDGER_LIMIT = 256

/** Deterministic owner-neutral dispatch. It never retries or infers success from a timeout. */
export class PaneIntentDispatcher {
  private readonly handlers = new Map<string, PaneIntentHandlerRegistrationV1>()
  private readonly admissions = new Map<string, Promise<PaneActionReceiptV1>>()

  /** Bounded idempotency ledger size, exposed for diagnostics. */
  get admissionLedgerSize(): number {
    return this.admissions.size
  }

  /** Whether one gesture already reached a handler under this idempotency key (in-flight or settled). */
  hasAdmission(idempotencyKey: string): boolean {
    return this.admissions.has(idempotencyKey)
  }

  /** Session-scoped reset; the ledger is never persisted. */
  clearAdmissions(): void {
    this.admissions.clear()
  }

  private rememberAdmission(idempotencyKey: string, admission: Promise<PaneActionReceiptV1>): void {
    this.admissions.set(idempotencyKey, admission)
    while (this.admissions.size > ADMISSION_LEDGER_LIMIT) {
      const oldest = this.admissions.keys().next()
      if (oldest.done === true) break
      this.admissions.delete(oldest.value)
    }
  }

  register(input: PaneIntentHandlerRegistrationV1): () => void {
    if (!HANDLER_ID.test(input.id) || typeof input.handle !== 'function') throw new TypeError('Pane intent handler requires a safe id and local handle function.')
    if (this.handlers.has(input.id)) throw new TypeError(`Pane intent handler ${input.id} is already registered.`)
    if (input.intents?.some(intent => !INTENTS.has(intent)) === true) throw new TypeError('Pane intent handler contains an unsupported intent.')
    if (input.targetOwners?.some(owner => !HANDLER_ID.test(owner)) === true) throw new TypeError('Pane intent handler target owners must be safe identifiers.')
    const registration = {
      ...input,
      intents: input.intents === undefined ? undefined : [...input.intents],
      targetOwners: input.targetOwners === undefined ? undefined : [...input.targetOwners],
      priority: Number.isFinite(input.priority) ? Math.trunc(input.priority ?? 0) : 0,
    }
    this.handlers.set(input.id, registration)
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.handlers.get(input.id) === registration) this.handlers.delete(input.id)
    }
  }

  async dispatch(input: unknown): Promise<PaneActionReceiptV1> {
    const intent = ArtifactIntentSchema.parse(input)
    const targetOwner = intent.targetOwner ?? intent.source.owner
    const candidates = [...this.handlers.values()]
      .filter(handler => handler.intents === undefined || handler.intents.includes(intent.intent))
      .filter(handler => handler.targetOwners === undefined || handler.targetOwners.includes(targetOwner))
      .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0) || left.id.localeCompare(right.id))
    const handler = candidates[0]
    if (handler === undefined) {
      return PaneActionReceiptSchema.parse({
        status: 'reconcile_required',
        receiptRef: safeReceiptRef(intent),
        owner: targetOwner,
        summary: 'No current Pane provider can handle this artifact intent.',
        reconcileReason: 'intent_handler_unavailable',
      })
    }
    // Duplicate deliveries of one gesture (double drop, double click, retry)
    // share the first admission; only the first delivery reaches the handler.
    const admitted = this.admissions.get(intent.idempotencyKey)
    if (admitted !== undefined) return admitted
    const pending = this.settle(handler, intent, targetOwner)
    this.rememberAdmission(intent.idempotencyKey, pending)
    return pending
  }

  private async settle(
    handler: PaneIntentHandlerRegistrationV1,
    intent: ArtifactIntentV1,
    targetOwner: string,
  ): Promise<PaneActionReceiptV1> {
    try {
      return PaneActionReceiptSchema.parse(await handler.handle(intent))
    } catch {
      return PaneActionReceiptSchema.parse({
        status: 'unknown',
        receiptRef: safeReceiptRef(intent),
        owner: targetOwner,
        summary: 'The artifact owner did not return a verifiable intent receipt.',
        reconcileReason: 'intent_settlement_unknown',
      })
    }
  }
}
