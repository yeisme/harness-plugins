/**
 * @yeisme/dsh-ai-drama-director root entry.
 *
 * Installable DSH Web bundle for AI Drama Director pack.
 *
 * Host face: mounts the CreativePipelineGateway (service key `creativePipeline`)
 * so the pipeline workbench pane can probe a real (non-fixture) owner
 * projection through `remote.creativePipeline`, and registers the matching
 * typert contribution when the host registry is available. The gateway owns no
 * domain state and fail-closes until an integration provides
 * `creativePipelineExpectedContext` (tenant/workspace/project) — context is
 * never derived from browser parameters. The browser face stays at `./client`.
 *
 * The bundle package shares its name with the host pack, so a bare self-import
 * would resolve to this bundle entry; the gateway is therefore bundled from the
 * host pack build output via the tsdown alias (see tsdown.config.ts), matching
 * the existing client-entry handling of the name collision.
 *
 * @module @yeisme/dsh-ai-drama-director
 */

import type { Context } from '@deepseek-ai/cordis'
import { LocalStudioCLI } from '@yeisme/dsh-creator-studio-host'
import { SCENE_3D_CONTEXT_SCHEMA, SCENE_3D_EXPECTED_CONTEXT } from '@yeisme/dsh-3d-director-host'
import {
  CreativePipelineGateway,
  CREATIVE_PIPELINE_CONTEXT_SCHEMA,
  CREATIVE_PIPELINE_EXPECTED_CONTEXT,
  CREATIVE_PIPELINE_RUN_OWNER,
  CREATIVE_PIPELINE_SERVICE_KEY,
  CREATIVE_PIPELINE_SNAPSHOT_SCHEMA,
} from '@yeisme/dsh-ai-drama-director/pipeline-gateway'

export {
  CreativePipelineGateway,
  CREATIVE_PIPELINE_EXPECTED_CONTEXT,
  CREATIVE_PIPELINE_RUN_OWNER,
  CREATIVE_PIPELINE_SNAPSHOT_SCHEMA,
}
export type {
  CreativePipelineContextV1,
  CreativePipelineRunOwnerFaceV1,
  CreativePipelineSnapshotResultV1,
} from '@yeisme/dsh-ai-drama-director/pipeline-gateway'

export const name = 'dsh-ai-drama-director'
export const inject: readonly string[] = ['typert']

interface TypertRegistryFace {
  register(contribution: typeof creativePipelineTypertContribution): (() => void | Promise<void>) | undefined
}

const creativePipelineTypertContribution = {
  package: '@yeisme/dsh-ai-drama-director',
  face: 'host',
  schemas: [],
  model: {
    services: [{
      key: CREATIVE_PIPELINE_SERVICE_KEY,
      exportName: 'CreativePipelineGateway',
      summary: 'Safe creative pipeline workbench projection gateway (read-only canvas seam plus owner run projections).',
      tags: [],
      members: [
        { kind: 'method', name: 'snapshot', signature: 'snapshot(): Promise<CreativePipelineSnapshotResultV1>' },
        { kind: 'method', name: 'canvasRead', signature: 'canvasRead(input: unknown): Promise<ProjectCanvasReadResult>' },
      ],
      types: [],
    }],
    events: [],
    objects: [],
  },
  invocations: [
    {
      id: '@yeisme/dsh-ai-drama-director#creativePipeline/snapshot',
      service: CREATIVE_PIPELINE_SERVICE_KEY,
      namespace: CREATIVE_PIPELINE_SERVICE_KEY,
      method: 'snapshot',
      invocation: { kind: 'direct' },
      parameters: [],
      result: { mode: 'src-json' },
    },
    {
      id: '@yeisme/dsh-ai-drama-director#creativePipeline/canvasRead',
      service: CREATIVE_PIPELINE_SERVICE_KEY,
      namespace: CREATIVE_PIPELINE_SERVICE_KEY,
      method: 'canvasRead',
      invocation: { kind: 'direct' },
      parameters: [{ name: 'input', wire: 'input', source: 'json', codec: { mode: 'src-json' } }],
      result: { mode: 'src-json' },
    },
  ],
}

/**
 * Mounts the pipeline gateway once per root context. The gateway is a cordis
 * child plugin of this bundle and unloads with it; the typert contribution is
 * best-effort and unregisters on dispose. No owner adapter or run owner is
 * fabricated here — integrations provide `creativePipelineRunOwner` separately.
 *
 * Local staging context (dsh-screenplay-production-continuity-v1 task 3.2):
 * mirroring the Creator Studio bundle's local mount, once the DSH workspace
 * registry exists this bundle derives the SAME deterministic local
 * tenant/workspace/project refs from `LocalStudioCLI` and provides them under
 * `creativePipelineExpectedContext` and `scene3dDirectorExpectedContext`
 * (per-service guards: an explicit deployment integration that provided
 * either context first keeps it). Sharing the derivation with the Creator
 * Studio canvas writer is load-bearing, not incidental: the pipeline reads
 * the same canvas rows and the 3D viewport the same scene rows only because
 * all three key their domains by the identical [tenant, workspace, project]
 * tuple. Context is server-bound (uid/home/cwd hashes) and never derived
 * from browser parameters.
 */
export async function apply(ctx: Context): Promise<void> {
  if (ctx.get(CREATIVE_PIPELINE_SERVICE_KEY as never) !== undefined) return
  await ctx.plugin(CreativePipelineGateway)
  const registry = ctx.get('typert' as never) as TypertRegistryFace | undefined
  const unregister = registry?.register(creativePipelineTypertContribution)
  if (unregister !== undefined) ctx.effect(() => unregister, 'creativePipeline.typert')
  ctx.effect(() => mountLocalExpectedContexts(ctx), 'creativePipeline.localContext')
}

type LocalContextMount = { disposers: Array<() => void> }

const LOCAL_CONTEXT_MOUNTS = Symbol.for('yeisme.dsh-ai-drama-director.local-context-mounts.v1')

function localContextMounts(): WeakMap<object, LocalContextMount> {
  const store = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = store[LOCAL_CONTEXT_MOUNTS]
  if (existing instanceof WeakMap) return existing as WeakMap<object, LocalContextMount>
  const created = new WeakMap<object, LocalContextMount>()
  store[LOCAL_CONTEXT_MOUNTS] = created
  return created
}

/**
 * Provides the two expected contexts from the deterministic local studio
 * identity when (and only when) the workspace registry exists and no explicit
 * integration provided them first. Idempotent across re-applies; released on
 * unload so an explicit integration provided later is not shadowed.
 */
function mountLocalExpectedContexts(ctx: Context): () => void {
  const root = ctx.root
  const store = localContextMounts()
  if (store.get(root) !== undefined) return () => {}
  const mount: LocalContextMount = { disposers: [] }
  store.set(root, mount)
  let active = true
  const fiber = root.inject(['workspaceRegistry'] as never, async (scope: Context) => {
    if (!active) return
    const derived = await deriveLocalContext()
    if (!active || derived === undefined) return
    // Per-service precedence, re-checked after every await: an explicit
    // integration that provided either context keeps its authenticated value.
    if (root.get(CREATIVE_PIPELINE_EXPECTED_CONTEXT as never) === undefined) {
      mount.disposers.push(scope.provide(CREATIVE_PIPELINE_EXPECTED_CONTEXT, {
        schema: CREATIVE_PIPELINE_CONTEXT_SCHEMA,
        tenantRef: derived.tenantRef,
        workspaceRef: derived.workspaceRef,
        projectRef: derived.projectRef,
      }))
    }
    if (root.get(SCENE_3D_EXPECTED_CONTEXT as never) === undefined) {
      mount.disposers.push(scope.provide(SCENE_3D_EXPECTED_CONTEXT, {
        schema: SCENE_3D_CONTEXT_SCHEMA,
        tenantRef: derived.tenantRef,
        workspaceRef: derived.workspaceRef,
        projectRef: derived.projectRef,
      }))
    }
    return () => {
      for (const dispose of mount.disposers.splice(0).reverse()) dispose()
    }
  })
  return () => {
    active = false
    store.delete(root)
    for (const dispose of mount.disposers.splice(0).reverse()) dispose()
    void fiber.dispose()
  }
}

/** Deterministic local refs from the shared LocalStudioCLI identity; undefined when the local config is unreadable or the context incomplete. */
async function deriveLocalContext(): Promise<{ readonly tenantRef: string; readonly workspaceRef: string; readonly projectRef: string } | undefined> {
  try {
    const local = await LocalStudioCLI.open()
    const { tenantRef, workspaceRef, projectRef } = local.context
    // Both gateway validators require all three refs; an incomplete local
    // identity provides nothing rather than a partial context.
    if (typeof tenantRef !== 'string' || typeof workspaceRef !== 'string' || typeof projectRef !== 'string') return undefined
    return { tenantRef, workspaceRef, projectRef }
  } catch {
    return undefined
  }
}

const DshAiDramaDirectorPlugin = { name, inject, apply }

export default DshAiDramaDirectorPlugin
