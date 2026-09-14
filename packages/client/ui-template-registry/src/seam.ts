/**
 * Client-side typed seam for the template-registry panes (task 3.1/3.2).
 *
 * The browser never talks to the stdio MCP owner directly. It consumes the
 * host service (`createTemplateRegistryService`, task 2.1-2.4) through the
 * context service `templateRegistryHost` — the same composition model as the
 * radar client's `radarHost`/`radarMarketHost`. The face is the frozen
 * `TemplateRegistryService` surface plus a schema discriminator and the
 * runtime locale; everything it returns is already a safe projection
 * (bounded refs/digests/titles, fail-closed rights, no credentials, no raw
 * template bodies, no absolute paths).
 *
 * Missing seam => the entry stays disabled with a stable reason; nothing is
 * fabricated and no dead buttons are rendered.
 *
 * @module @yeisme/dsh-client-ui-template-registry/seam
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { TemplateRegistryService } from '@yeisme/dsh-template-registry'

/** Context service key carrying the host Remote (provided by the DSH host composition). */
export const TEMPLATE_REGISTRY_HOST_SERVICE = 'templateRegistryHost' as const

/** Wire discriminator the structural probe requires before any call. */
export const TEMPLATE_REGISTRY_HOST_SCHEMA = 'dsh.template-registry.host.v1' as const

export type TemplateRegistryLocale = 'zh' | 'en' | 'pseudo'

/** The only host face the panes consume; mirrors the 2.x service surface. */
export interface TemplateRegistryHostFace extends TemplateRegistryService {
  readonly schema: typeof TEMPLATE_REGISTRY_HOST_SCHEMA
  readonly locale?: TemplateRegistryLocale | undefined
}

/** Minimal Pane Workbench client face (same subset the radar client probes). */
export interface TemplateRegistryPaneWorkbenchFace {
  registerView(input: unknown): () => void
  openView(request: unknown): void
  registerCommand?(input: unknown): () => void
}

export type TemplateRegistryClientDependency = 'paneWorkbench' | 'templateRegistryHost'

export interface TemplateRegistryClientProbeEntryV1 {
  readonly available: boolean
  readonly reason: string
}

export interface TemplateRegistryClientProbeResultV1 {
  /** True only when paneWorkbench + templateRegistryHost both probe. */
  readonly available: boolean
  readonly paneWorkbench: TemplateRegistryClientProbeEntryV1
  readonly templateRegistryHost: TemplateRegistryClientProbeEntryV1
}

export interface TemplateRegistryClientProbeResolutionV1 {
  readonly probe: TemplateRegistryClientProbeResultV1
  readonly pane?: TemplateRegistryPaneWorkbenchFace
  readonly host?: TemplateRegistryHostFace
}

export const TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS = {
  paneWorkbench: 'seam_unavailable: the official Pane slot is unavailable; the template-registry panes stay disabled',
  templateRegistryHost: 'needs_template_registry: the template-registry host service is unavailable; install the template-registry host wiring and retry',
  ready: 'template-registry client capability is ready',
} as const

type ContextReader = Pick<ClientContext, 'get'>

function readContextService<T>(ctx: ContextReader, name: string): T | undefined {
  try {
    return ctx.get(name as never) as T | undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isPaneWorkbenchFace(value: unknown): value is TemplateRegistryPaneWorkbenchFace {
  return isRecord(value)
    && typeof value.registerView === 'function'
    && typeof value.openView === 'function'
}

const HOST_FACE_METHODS = [
  'health', 'probe', 'browse', 'search', 'inspect', 'preview',
  'createSession', 'updateSession', 'confirmSession', 'compileSession', 'exportSession', 'showSession',
] as const

/** Structural probe of the host Remote: schema discriminator + full method surface. */
export function isTemplateRegistryHost(value: unknown): value is TemplateRegistryHostFace {
  if (!isRecord(value)) return false
  if (value.schema !== TEMPLATE_REGISTRY_HOST_SCHEMA) return false
  return HOST_FACE_METHODS.every(method => typeof value[method] === 'function')
}

/**
 * Probe the two dependencies. The host seam is verified structurally and by
 * one live `health()` read (nothing is spawned from the browser side); a
 * degraded/offline health still counts as available — the panes own those
 * honest states. A throwing or contract-mismatching seam fails closed.
 */
export async function probeTemplateRegistryClient(ctx: ContextReader): Promise<TemplateRegistryClientProbeResolutionV1> {
  const pane = readContextService<TemplateRegistryPaneWorkbenchFace>(ctx, 'paneWorkbench')
  const hostCandidate = readContextService<unknown>(ctx, TEMPLATE_REGISTRY_HOST_SERVICE)
  const paneOk = pane !== undefined && isPaneWorkbenchFace(pane)

  let hostOk = hostCandidate !== undefined && isTemplateRegistryHost(hostCandidate)
  let hostReason: string = TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS.templateRegistryHost
  const host = hostOk ? (hostCandidate as TemplateRegistryHostFace) : undefined
  if (hostOk && host !== undefined) {
    try {
      host.health()
    } catch {
      hostOk = false
      hostReason = 'template_registry_host_unusable: the host service answered with a contract violation'
    }
  }

  const probe: TemplateRegistryClientProbeResultV1 = {
    available: paneOk && hostOk,
    paneWorkbench: {
      available: paneOk,
      reason: paneOk ? TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS.ready : TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS.paneWorkbench,
    },
    templateRegistryHost: {
      available: hostOk,
      reason: hostOk ? TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS.ready : hostReason,
    },
  }
  return {
    probe,
    ...(paneOk && pane !== undefined ? { pane } : {}),
    ...(hostOk && host !== undefined ? { host } : {}),
  }
}
