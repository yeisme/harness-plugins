/**
 * Template-registry host service (task 2.1): connection management, capability
 * probe, disconnect detection, and the honest catalog degradation path.
 *
 * Three honest states (never more):
 * - `connected`: the stdio MCP probe passed — initialize answered, the server
 *   identity matches, and tools/list covers REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS;
 * - `degraded`: the probe failed (or the transport dropped mid-flight) AND
 *   the promptrepo catalog is readable — the pane serves a bounded read-only
 *   browse from catalog.json; compile/export/session actions are disabled;
 * - `offline`: no MCP and no catalog — no data is fabricated.
 *
 * Disconnect detection: any transport failure while connected flips the
 * service to degraded/offline (transport_lost); the next in-flight catalog
 * read falls back to the catalog, and `probe()` re-checks the transport
 * (a fresh child process) so recovery is one probe away. Owner error codes
 * (REVISION_CONFLICT, RIGHTS_DENIED, ...) are surfaced verbatim and never
 * count as disconnects.
 *
 * @module @yeisme/dsh-template-registry/service
 */

import {
  REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS,
  type Template,
  type TemplateSession,
} from './contracts.js'
import { catalogBrowseTemplates, parsePromptCatalog, type PromptCatalog } from './catalog.js'
import {
  rpcInspectTemplate,
  rpcListTemplates,
  rpcSearchTemplates,
  templatePreviewFromInspection,
  type TemplateBrowseInput,
  type TemplateInspection,
  type TemplatePreview,
  type TemplateRegistryCallFailure,
} from './rpc.js'
import {
  registryCompileSession,
  registryExportCompile,
  registrySessionConfirm,
  registrySessionCreate,
  registrySessionShow,
  registrySessionUpdate,
  type RegistryCompileResult,
  type RegistryExportReceipt,
  type RegistrySessionContext,
  type RegistrySessionCreateInput,
  type RegistrySessionFieldInput,
  type TemplateSessionFailure,
  type TemplateSessionOutcome,
} from './sessions.js'
import {
  createTemplateRegistryMcpConnection,
  isSafeTemplateRegistryBinary,
  nodeTemplateRegistrySpawn,
  TEMPLATE_REGISTRY_DISCONNECTED,
  type TemplateRegistryProcessFactory,
  type TemplateRegistryServerInfo,
} from './transport.js'

// ---------------------------------------------------------------------------
// Capability probe
// ---------------------------------------------------------------------------

/** Why the MCP seam is unusable (honest sub-reasons of the degraded/offline fold). */
export type TemplateRegistryUnavailableReason = 'connect_failed' | 'server_mismatch' | 'tools_missing' | 'transport_lost'

export type TemplateRegistryProbe =
  | { readonly state: 'connected'; readonly server: TemplateRegistryServerInfo }
  | { readonly state: 'unavailable'; readonly reason: TemplateRegistryUnavailableReason; readonly missingTools?: readonly string[] }

export const TEMPLATE_REGISTRY_SERVER_NAME = 'template-registry'
export const TEMPLATE_REGISTRY_COMPILER_PREFIX = 'template-registry.prompt-compiler.'

export const TEMPLATE_REGISTRY_PROBE_TIMEOUT_MS = 8000

/**
 * Capability probe: initialize (server identity check) + tools/list ⊇ the
 * nine required tools. The probe aborts (and tears the connection down)
 * after `timeoutMs`; every failure collapses to an honest reason — never raw
 * process error text.
 */
export async function probeTemplateRegistryMcp(
  connection: { serverInfo(options?: { signal?: AbortSignal }): Promise<TemplateRegistryServerInfo>; request(method: string, params?: Record<string, unknown>, options?: { signal?: AbortSignal }): Promise<unknown>; dispose(): void },
  options: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<TemplateRegistryProbe> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? TEMPLATE_REGISTRY_PROBE_TIMEOUT_MS)
  const forward = () => controller.abort()
  options.signal?.addEventListener('abort', forward, { once: true })
  try {
    let server: TemplateRegistryServerInfo
    try {
      server = await connection.serverInfo({ signal: controller.signal })
    } catch {
      // Spawn failure, handshake failure, and probe timeout all surface as
      // the same honest connect_failed — the transport collapses the details.
      return { state: 'unavailable', reason: 'connect_failed' }
    }
    if (server.serverName !== TEMPLATE_REGISTRY_SERVER_NAME || !server.serverVersion.startsWith(TEMPLATE_REGISTRY_COMPILER_PREFIX)) {
      return { state: 'unavailable', reason: 'server_mismatch' }
    }
    let tools: unknown
    try {
      tools = await connection.request('tools/list', {}, { signal: controller.signal })
    } catch {
      return { state: 'unavailable', reason: 'connect_failed' }
    }
    const names = new Set(toolNames(tools))
    const missing = REQUIRED_TEMPLATE_REGISTRY_MCP_TOOLS.filter(tool => !names.has(tool))
    if (missing.length > 0) return { state: 'unavailable', reason: 'tools_missing', missingTools: [...missing] }
    return { state: 'connected', server }
  } finally {
    clearTimeout(timer)
    options.signal?.removeEventListener('abort', forward)
  }
}

function toolNames(toolsResult: unknown): string[] {
  if (typeof toolsResult !== 'object' || toolsResult === null) return []
  const tools = (toolsResult as { tools?: unknown }).tools
  if (!Array.isArray(tools)) return []
  return tools
    .map(tool => (typeof tool === 'object' && tool !== null ? (tool as { name?: unknown }).name : undefined))
    .filter((name): name is string => typeof name === 'string')
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export type TemplateRegistryHealth =
  | { readonly state: 'connected'; readonly server: TemplateRegistryServerInfo }
  | { readonly state: 'degraded'; readonly reason: TemplateRegistryUnavailableReason; readonly catalogDigest: string }
  | { readonly state: 'offline'; readonly reason: TemplateRegistryUnavailableReason }

export interface TemplateRegistryServiceOptions {
  readonly mcp: { readonly binary: string; readonly cwd?: string; readonly spawnProcess?: TemplateRegistryProcessFactory }
  /** Catalog source for the degraded path (e.g. readPromptCatalogFile). */
  readonly catalog: { readonly load: () => Promise<unknown> }
  readonly probeTimeoutMs?: number
}

export type TemplateBrowseFailure = TemplateRegistryCallFailure | { readonly kind: 'offline' }

export type TemplateBrowseOutcome =
  | { readonly ok: true; readonly origin: 'mcp' | 'catalog'; readonly templates: readonly Template[]; readonly catalogDigest?: string }
  | { readonly ok: false; readonly failure: TemplateBrowseFailure; readonly health: TemplateRegistryHealth }

export type TemplateInspectOutcome =
  | { readonly ok: true; readonly inspection: TemplateInspection }
  | { readonly ok: false; readonly failure: TemplateRegistryCallFailure | { readonly kind: 'degraded' } | { readonly kind: 'not_found' } }

export interface TemplateRegistryService {
  /** Last known honest state (no I/O). */
  health(): TemplateRegistryHealth
  /** Re-check the transport (fresh child process) and the required tools. */
  probe(options?: { signal?: AbortSignal }): Promise<TemplateRegistryHealth>
  browse(input?: TemplateBrowseInput): Promise<TemplateBrowseOutcome>
  search(query: string): Promise<TemplateBrowseOutcome>
  inspect(ref: string): Promise<TemplateInspectOutcome>
  preview(ref: string): Promise<TemplatePreview>
  createSession(input: RegistrySessionCreateInput, context: { ref: string; digest: string; contractDigest?: string }): Promise<TemplateSessionOutcome<TemplateSession>>
  updateSession(input: { sessionId: string; expectedRevision: number; fields: Readonly<Record<string, RegistrySessionFieldInput>> }, context: RegistrySessionContext): Promise<TemplateSessionOutcome<TemplateSession>>
  confirmSession(input: { sessionId: string; expectedRevision: number; decisionRef: string; goal?: boolean; fields?: readonly string[] }, context: RegistrySessionContext): Promise<TemplateSessionOutcome<TemplateSession>>
  compileSession(input: { sessionId: string; expectedRevision: number }, guard: { session: TemplateSession; required: readonly string[] }, context: RegistrySessionContext): Promise<TemplateSessionOutcome<RegistryCompileResult>>
  exportSession(input: { compileId: string; output: string }, guard: { session: TemplateSession; currentDigest?: string }): Promise<TemplateSessionOutcome<RegistryExportReceipt>>
  showSession(sessionId: string, context: RegistrySessionContext): Promise<TemplateSessionOutcome<TemplateSession>>
  /** Kill the owned child process (host dispose). */
  dispose(): void
}

type CatalogCache = { readonly status: 'loading'; readonly promise: Promise<PromptCatalog | undefined> } | { readonly status: 'ready'; readonly catalog: PromptCatalog | undefined }

/**
 * Create the host service. Unsafe binary names throw (`unsafe_binary`);
 * the catalog is loaded lazily at most once per service instance and a
 * failed load is remembered (degradation then reports offline).
 */
export function createTemplateRegistryService(options: TemplateRegistryServiceOptions): TemplateRegistryService {
  if (!isSafeTemplateRegistryBinary(options.mcp.binary)) throw new Error('unsafe_binary')
  const connection = createTemplateRegistryMcpConnection(
    { binary: options.mcp.binary, ...(options.mcp.cwd === undefined ? {} : { cwd: options.mcp.cwd }) },
    { spawnProcess: options.mcp.spawnProcess ?? nodeTemplateRegistrySpawn },
  )
  let health: TemplateRegistryHealth = { state: 'offline', reason: 'connect_failed' }
  let catalogCache: CatalogCache | undefined

  const loadCatalog = (): Promise<PromptCatalog | undefined> => {
    if (catalogCache === undefined) {
      const promise = options.catalog.load().then(parsePromptCatalog, () => undefined)
      catalogCache = { status: 'loading', promise }
      void promise.then(catalog => { catalogCache = { status: 'ready', catalog } })
    }
    if (catalogCache.status === 'ready') return Promise.resolve(catalogCache.catalog)
    return catalogCache.promise
  }

  /** Fold a probe result with catalog availability into the honest three states. */
  const settle = async (probe: TemplateRegistryProbe): Promise<TemplateRegistryHealth> => {
    if (probe.state === 'connected') {
      health = { state: 'connected', server: probe.server }
      return health
    }
    const catalog = await loadCatalog()
    health = catalog === undefined
      ? { state: 'offline', reason: probe.reason }
      : { state: 'degraded', reason: probe.reason, catalogDigest: catalog.digest }
    return health
  }

  /** Any transport failure while connected flips to the degraded/offline fold. */
  const noteTransportFailure = (failure: { readonly kind?: unknown }): boolean => {
    if (failure.kind !== 'disconnected') return false
    void settle({ state: 'unavailable', reason: 'transport_lost' })
    return true
  }

  const degradedFailure = (): { kind: 'degraded' } => {
    // Reads are impossible without the MCP seam (the catalog carries no
    // contracts); the honest answer is the degraded reason code.
    return { kind: 'degraded' }
  }

  const degradedGuard = (): TemplateSessionFailure => ({
    // Session mutations fail closed in degraded/offline states (read-only
    // catalog fallback only); probe() is the recovery path.
    kind: 'guard', code: 'degraded', detail: 'the template-registry MCP seam is not connected',
  })

  const requireConnection = (): { ok: true } | { ok: false; failure: TemplateSessionFailure } => {
    return health.state === 'connected' ? { ok: true } : { ok: false, failure: degradedGuard() }
  }

  const catalogBrowse = async (input: TemplateBrowseInput, cause: TemplateRegistryUnavailableReason): Promise<TemplateBrowseOutcome> => {
    const catalog = await loadCatalog()
    if (catalog === undefined) {
      health = { state: 'offline', reason: cause }
      return { ok: false, failure: { kind: 'offline' }, health }
    }
    health = { state: 'degraded', reason: cause, catalogDigest: catalog.digest }
    return {
      ok: true, origin: 'catalog', catalogDigest: catalog.digest,
      templates: catalogBrowseTemplates(catalog, {
        ...(input.query === undefined ? {} : { query: input.query }),
        ...(input.category === undefined ? {} : { category: input.category }),
        ...(input.tag === undefined ? {} : { tag: input.tag }),
        ...(input.capability === undefined ? {} : { capability: input.capability }),
        ...(input.locale === undefined ? {} : { locale: input.locale }),
      }),
    }
  }

  const service: TemplateRegistryService = {
    health: () => health,

    async probe(probeOptions) {
      return settle(await probeTemplateRegistryMcp(connection, { ...probeOptions, ...(options.probeTimeoutMs === undefined ? {} : { timeoutMs: options.probeTimeoutMs }) }))
    },

    async browse(input = {}) {
      if (health.state !== 'connected') {
        // Degraded/offline: only the catalog fallback can answer.
        return catalogBrowse(input, health.reason)
      }
      const outcome = await rpcListTemplates(connection, input)
      if (outcome.ok) return { ok: true, origin: 'mcp', templates: outcome.templates }
      if (noteTransportFailure(outcome.failure)) return catalogBrowse(input, 'transport_lost')
      // Owner-side failure with the transport alive: the owner error code
      // surfaces verbatim (no silent catalog substitution).
      return { ok: false, failure: outcome.failure, health }
    },

    async search(query) {
      if (health.state !== 'connected') return catalogBrowse({ query }, health.reason)
      const outcome = await rpcSearchTemplates(connection, query)
      if (outcome.ok) return { ok: true, origin: 'mcp', templates: outcome.templates }
      if (noteTransportFailure(outcome.failure)) return catalogBrowse({ query }, 'transport_lost')
      return { ok: false, failure: outcome.failure, health }
    },

    async inspect(ref) {
      if (health.state !== 'connected') return { ok: false, failure: degradedFailure() }
      const outcome = await rpcInspectTemplate(connection, ref)
      if (!outcome.ok && noteTransportFailure(outcome.failure)) return { ok: false, failure: degradedFailure() }
      return outcome
    },

    async preview(ref) {
      // Degraded mode never previews: the catalog has no contract
      // permissions, so the deny reason is the degradation itself.
      if (health.state !== 'connected') return { ref, allowed: false, reason: 'degraded' }
      const outcome = await rpcInspectTemplate(connection, ref)
      if (!outcome.ok) {
        if (noteTransportFailure(outcome.failure)) return { ref, allowed: false, reason: 'degraded' }
        return outcome.failure.kind === 'not_found'
          ? { ref, allowed: false, reason: 'not_found' }
          : { ref, allowed: false, reason: 'contract_unavailable' }
      }
      return templatePreviewFromInspection(outcome.inspection)
    },

    async createSession(input, context) {
      const gate = requireConnection()
      if (!gate.ok) return { ok: false, failure: gate.failure }
      const outcome = await registrySessionCreate(connection, input, context)
      if (!outcome.ok) noteTransportFailure(outcome.failure)
      return outcome
    },

    async updateSession(input, context) {
      const gate = requireConnection()
      if (!gate.ok) return { ok: false, failure: gate.failure }
      const outcome = await registrySessionUpdate(connection, input, context)
      if (!outcome.ok) noteTransportFailure(outcome.failure)
      return outcome
    },

    async confirmSession(input, context) {
      const gate = requireConnection()
      if (!gate.ok) return { ok: false, failure: gate.failure }
      const outcome = await registrySessionConfirm(connection, input, context)
      if (!outcome.ok) noteTransportFailure(outcome.failure)
      return outcome
    },

    async compileSession(input, guard, context) {
      const gate = requireConnection()
      if (!gate.ok) return { ok: false, failure: gate.failure }
      const outcome = await registryCompileSession(connection, input, guard, context)
      if (!outcome.ok) noteTransportFailure(outcome.failure)
      return outcome
    },

    async exportSession(input, guard) {
      const gate = requireConnection()
      if (!gate.ok) return { ok: false, failure: gate.failure }
      const outcome = await registryExportCompile(connection, input, guard)
      if (!outcome.ok) noteTransportFailure(outcome.failure)
      return outcome
    },

    async showSession(sessionId, context) {
      const gate = requireConnection()
      if (!gate.ok) return { ok: false, failure: gate.failure }
      const outcome = await registrySessionShow(connection, sessionId, context)
      if (!outcome.ok) noteTransportFailure(outcome.failure)
      return outcome
    },

    dispose() {
      connection.dispose()
    },
  }
  return service
}

/** Re-export for callers building their own connection (probe-only usage). */
export { TEMPLATE_REGISTRY_DISCONNECTED }
