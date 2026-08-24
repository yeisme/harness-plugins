import {
  JsonValueSchema,
  PaneViewDescriptorSchema,
  type JsonValue,
  type PaneViewDescriptorV1,
} from '@yeisme/dsh-pane-protocol'
import type { ReactNode } from 'react'
import type { PaneViewInstanceV1, PaneWorkspaceV1 } from './workspace.js'

export type PaneLocalViewFactory = (props: PaneLocalViewProps) => unknown

export interface PaneLocalViewProps {
  readonly view: PaneViewInstanceV1
  readonly projection?: JsonValue
  /** Local-only DSH host content. It never crosses projection or persistence boundaries. */
  readonly hostContent?: ReactNode
  readonly retry: () => void
}

export interface PaneViewI18nRegistrationV1 {
  readonly namespace: string
  readonly labelKey: string
  readonly descriptionKey?: string
  readonly keywordsKey?: string
}

export interface PaneViewRegistrationV1 {
  readonly descriptor: PaneViewDescriptorV1
  readonly component: PaneLocalViewFactory
  readonly requiredCapabilities?: readonly string[]
  /** Built-in host adapters may stay addressable without appearing in the public picker. */
  readonly showInPicker?: boolean
  /** Local-only copy keys. Absent registrations keep using descriptor.label. */
  readonly i18n?: PaneViewI18nRegistrationV1
}

export interface PaneViewRegistryEnvironment {
  readonly capabilities: ReadonlySet<string>
  /** Optional diagnostics sink; listener failures never escape registry mutations. */
  readonly onListenerError?: (error: unknown) => void
}

export class PaneViewRegistrationError extends Error {
  constructor(readonly code: 'contract_mismatch' | 'capability_denied' | 'duplicate_kind', message: string) {
    super(message)
    this.name = 'PaneViewRegistrationError'
  }
}

const LOCAL_I18N_TOKEN = /^[A-Za-z][A-Za-z0-9._-]{0,127}$/
const REMOTE_I18N_INJECTION = /^(?:https?:|javascript:|[\\/]|[A-Za-z]:[\\/]|\\\\)/i
const LOCAL_I18N_FIELDS = ['namespace', 'labelKey', 'descriptionKey', 'keywordsKey'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isRemoteI18nInjection(value: string): boolean {
  return REMOTE_I18N_INJECTION.test(value.trim()) || value.includes('://')
}

function parseLocalI18nToken(value: unknown, field: string): string {
  if (typeof value === 'function') {
    throw new PaneViewRegistrationError('contract_mismatch', `Pane view i18n ${field} must not be executable.`)
  }
  if (typeof value !== 'string' || value.length === 0 || value.length > 160) {
    throw new PaneViewRegistrationError('contract_mismatch', `Pane view i18n ${field} must be a local key.`)
  }
  if (isRemoteI18nInjection(value) || !LOCAL_I18N_TOKEN.test(value)) {
    throw new PaneViewRegistrationError('contract_mismatch', `Pane view i18n ${field} rejects remote or untrusted injection.`)
  }
  return value
}

function parsePaneViewI18n(input: unknown): PaneViewI18nRegistrationV1 | undefined {
  if (input === undefined) return undefined
  if (typeof input === 'function') {
    throw new PaneViewRegistrationError('contract_mismatch', 'Pane view i18n must not be executable.')
  }
  if (!isRecord(input)) {
    throw new PaneViewRegistrationError('contract_mismatch', 'Pane view i18n must be a local-only key block.')
  }
  for (const field of Object.keys(input)) {
    if (!(LOCAL_I18N_FIELDS as readonly string[]).includes(field)) {
      throw new PaneViewRegistrationError('contract_mismatch', `Pane view i18n ${field} is not an accepted local field.`)
    }
    if (typeof input[field] === 'function') {
      throw new PaneViewRegistrationError('contract_mismatch', `Pane view i18n ${field} must not be executable.`)
    }
  }
  const i18n: PaneViewI18nRegistrationV1 = {
    namespace: parseLocalI18nToken(input.namespace, 'namespace'),
    labelKey: parseLocalI18nToken(input.labelKey, 'labelKey'),
  }
  if (input.descriptionKey !== undefined) {
    return {
      ...i18n,
      descriptionKey: parseLocalI18nToken(input.descriptionKey, 'descriptionKey'),
      ...(input.keywordsKey === undefined ? {} : { keywordsKey: parseLocalI18nToken(input.keywordsKey, 'keywordsKey') }),
    }
  }
  if (input.keywordsKey !== undefined) {
    return { ...i18n, keywordsKey: parseLocalI18nToken(input.keywordsKey, 'keywordsKey') }
  }
  return i18n
}

/**
 * Validates the local-only registration boundary. Factories are supplied by the
 * loaded client package; host projections never select code, modules, URLs, or frames.
 */
export function parsePaneViewRegistration(input: unknown, environment: PaneViewRegistryEnvironment): PaneViewRegistrationV1 {
  if (!isRecord(input) || !isRecord(input.descriptor) || typeof input.component !== 'function') {
    throw new PaneViewRegistrationError('contract_mismatch', 'A pane view requires a local component factory and a typed descriptor.')
  }
  for (const forbidden of ['componentUrl', 'module', 'moduleName', 'url', 'iframe', 'factory']) {
    if (forbidden in input) throw new PaneViewRegistrationError('contract_mismatch', `Pane view ${forbidden} is not an accepted registration field.`)
  }
  const descriptor = PaneViewDescriptorSchema.safeParse(input.descriptor)
  if (!descriptor.success) throw new PaneViewRegistrationError('contract_mismatch', 'Pane view descriptor does not match the safe contract.')
  const requiredCapabilities = Array.isArray(input.requiredCapabilities)
    ? input.requiredCapabilities.filter((item): item is string => typeof item === 'string')
    : []
  if (requiredCapabilities.length !== (Array.isArray(input.requiredCapabilities) ? input.requiredCapabilities.length : 0)) {
    throw new PaneViewRegistrationError('contract_mismatch', 'Pane view capabilities must be strings.')
  }
  if (input.showInPicker !== undefined && typeof input.showInPicker !== 'boolean') {
    throw new PaneViewRegistrationError('contract_mismatch', 'Pane view showInPicker must be a boolean.')
  }
  const missing = requiredCapabilities.filter(capability => !environment.capabilities.has(capability))
  if (missing.length > 0) throw new PaneViewRegistrationError('capability_denied', `Missing pane capabilities: ${missing.join(', ')}`)
  const i18n = parsePaneViewI18n(input.i18n)
  return {
    descriptor: descriptor.data,
    component: input.component as PaneLocalViewFactory,
    requiredCapabilities,
    showInPicker: input.showInPicker ?? true,
    ...(i18n === undefined ? {} : { i18n }),
  }
}

/** Local registry used by ctx.paneWorkbench; a disposer intentionally orphan-recovers existing tabs. */
export class PaneViewRegistry {
  private readonly registrations = new Map<string, PaneViewRegistrationV1>()
  private readonly listeners = new Set<() => void>()

  constructor(private readonly environment: PaneViewRegistryEnvironment) {}

  registerView(input: unknown): () => void {
    const registration = parsePaneViewRegistration(input, this.environment)
    const kind = registration.descriptor.kind
    if (this.registrations.has(kind)) throw new PaneViewRegistrationError('duplicate_kind', `Pane view ${kind} is already registered.`)
    this.registrations.set(kind, registration)
    this.emit()
    let disposed = false
    return () => {
      if (disposed) return
      disposed = true
      if (this.registrations.get(kind) === registration) {
        this.registrations.delete(kind)
        this.emit()
      }
    }
  }

  get(kind: string): PaneViewRegistrationV1 | undefined { return this.registrations.get(kind) }

  has(kind: string): boolean { return this.registrations.has(kind) }

  snapshot(): readonly PaneViewRegistrationV1[] {
    return [...this.registrations.values()].sort((left, right) => left.descriptor.kind.localeCompare(right.descriptor.kind))
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (error) {
        try { this.environment.onListenerError?.(error) } catch { /* diagnostics are best-effort */ }
      }
    }
  }
}

/** Drops untrusted projection values before they reach a local view component. */
export function parseSafePaneProjection(input: unknown): JsonValue | undefined {
  const parsed = JsonValueSchema.safeParse(input)
  return parsed.success ? parsed.data : undefined
}

/** Keeps the layout recoverable when a provider is unloaded or has not registered yet. */
export function markOrphanedPaneViews(state: PaneWorkspaceV1, registry: Pick<PaneViewRegistry, 'has'>): PaneWorkspaceV1 {
  let changed = false
  const views = Object.fromEntries(Object.entries(state.views).map(([id, view]) => {
    const status = registry.has(view.kind)
      ? (view.status === 'orphaned' ? 'ready' : view.status)
      : 'orphaned'
    if (status !== view.status) changed = true
    return [id, { ...view, status }]
  })) as PaneWorkspaceV1['views']
  return changed ? { ...state, views } : state
}
