import { createHash } from 'node:crypto'
import { PANE_ACTION_DESCRIPTOR_SCHEMA, PANE_ARTIFACT_SCHEMA, PaneActionRequestSchema, PaneActionReconcileRequestSchema,
  type PaneActionReceiptV1, type PaneContextV1 } from '@yeisme/dsh-pane-protocol'
import type { CreatorOwnerAdapterV1, CreatorOwnerSnapshotV1, CreatorStudioContextV1 } from './types.ts'
import { SonoraSubtitleExportClient, type SonoraSubtitleExportResult, type SonoraSubtitleTrackPreview } from './sonora-subtitle-export.ts'
import { SonoraWorksTableClient } from './sonora-works-table.ts'

const actionId = 'subtitle.export'
const contextKeys = ['tenantRef', 'workspaceRef', 'projectRef', 'sessionRef', 'principalRef', 'membershipRevision', 'installationRef', 'pluginDigest', 'policyRevision', 'runtimeGeneration', 'revision'] as const
function sameContext(a: PaneContextV1, b: CreatorStudioContextV1): boolean { return contextKeys.every(key => a[key] === b[key]) }
function descriptorRef(track: SonoraSubtitleTrackPreview): string { return `sonora:subtitle.export:${track.track_digest}:${track.review_digest}` }
function exportable(track: SonoraSubtitleTrackPreview): boolean { return track.readability_status === 'ok' && track.decision_code === 'approved' && track.cue_count > 0 }

/** A selected-track slice of the audio studio, using the normal Creator adapter seam.
 * Selection is a Host project reference; all review and version facts come from Sonora.
 */
export function createSonoraSubtitleExportAdapter(
  client: SonoraSubtitleExportClient,
  selectedTrack: (context: CreatorStudioContextV1) => Promise<string | undefined>,
  works?: SonoraWorksTableClient,
): CreatorOwnerAdapterV1 {
  let sequence = 0
  async function read(context: CreatorStudioContextV1) {
    const ref = await selectedTrack({ ...context })
    return ref === undefined ? undefined : client.readTrack(context, ref)
  }
  function receipt(context: CreatorStudioContextV1, key: string, result: SonoraSubtitleExportResult): PaneActionReceiptV1 {
    if (result.status === 'ready') {
      const resource = result.resource
      return { owner: 'sonora', actionId, status: 'completed', receiptRef: resource.ref,
        summary: 'Sonora saved the reviewed subtitle export.', outputArtifacts: [{ schema: PANE_ARTIFACT_SCHEMA,
          owner: 'sonora', kind: 'subtitle', ref: resource.ref, version: resource.content_digest,
          mediaType: resource.media_type, title: `Subtitle export (${resource.format.toUpperCase()})`, evidenceRefs: [], capabilities: [],
        }] }
    }
    const identity = createHash('sha256').update(JSON.stringify([context.projectRef, context.principalRef, key])).digest('hex')
    return { owner: 'sonora', actionId, status: result.status, receiptRef: `receipt:sonora:subtitle-export:${identity}`,
      summary: result.status === 'unknown' ? 'The original subtitle export must be reconciled.' : 'The subtitle export request was rejected.',
      ...(result.status === 'unknown' ? { reconcileReason: result.reason } : {}),
    }
  }
  return {
    owner: 'sonora', transport: 'service',
    async readTranscriptionCatalog(context) {
      const result = await client.readTranscriptionCatalog({ ...context })
      return result.status === 'ready' ? result.resource : undefined
    },
    async readWorksTable(context, cursor) {
      return works === undefined ? { status: 'rejected', reason: 'unavailable' } : works.read({ ...context }, cursor)
    },
    async snapshot(context): Promise<CreatorOwnerSnapshotV1> {
      context = { ...context }
      const result = await read(context)
      const track = result?.status === 'ready' ? result.resource : undefined
      const ready = track !== undefined && exportable(track)
      const current = ++sequence
      return { schemaVersion: 'creator.owner.snapshot.v1alpha1', owner: 'sonora', transport: 'service',
        snapshotRef: `sonora:subtitle-studio:${current}`, snapshotVersion: current, cursor: `sonora:subtitle-studio:${current}`, sequence: current,
        generatedAt: new Date().toISOString(), context: { ...context },
        status: ready ? 'ready' : track !== undefined || result === undefined ? 'attention_required' : result.status !== 'ready' && result.reason === 'permission_denied' ? 'permission_denied' : 'unknown',
        freshness: track === undefined ? 'unknown' : 'fresh',
        summary: ready ? 'The selected subtitle track is ready to export.' : track !== undefined ? 'Review the selected subtitle track in Sonora before exporting.' : 'Select an accessible Sonora subtitle track.',
        resources: track === undefined ? [] : [{ ref: track.ref, version: track.track_digest, kind: 'subtitle-track', title: 'Selected subtitle track',
          status: track.readability_status, metrics: [{ label: 'Cues', value: String(track.cue_count) }], evidenceRefs: [] }],
        actions: !ready || track === undefined ? [] : [{ schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'sonora', actionId,
          descriptorRef: descriptorRef(track), targetRef: track.ref, targetVersion: track.track_digest, context: { ...context },
          label: 'Export reviewed subtitles', risk: 'low', confirmation: 'confirm', expiresAt: new Date(Date.now() + 60_000).toISOString(),
          preview: { summary: 'Save a fixed-version subtitle export in Sonora. This does not adopt a new track or deliver a shot.', cost: { currency: 'USD', amount: 0, estimate: false } },
          fields: [{ key: 'format', kind: 'select', label: 'Subtitle format', required: true, options: [{ value: 'srt', label: 'SRT' }, { value: 'vtt', label: 'WebVTT' }] }],
        }],
      }
    },
    async dispatch(raw, context) {
      context = { ...context }
      const request = PaneActionRequestSchema.safeParse(raw)
      const reject = () => receipt(context, raw.idempotencyKey, { status: 'rejected', reason: 'invalid_input' })
      if (!request.success) return reject()
      const input = request.data
      if (input.owner !== 'sonora' || input.actionId !== actionId || !sameContext(input.context, context)
        || Object.keys(input.values).length !== 1 || !['srt', 'vtt'].includes(String(input.values.format))) return reject()
      const scope = { ...context }
      const result = await read(scope)
      if (result?.status !== 'ready' || !exportable(result.resource)) return receipt(scope, input.idempotencyKey, { status: 'rejected', reason: 'unavailable' })
      const track = result.resource
      if (input.expectedTargetRef !== track.ref || input.expectedTargetVersion !== track.track_digest || input.descriptorRef !== descriptorRef(track)) return reject()
      return receipt(scope, input.idempotencyKey, await client.create(scope, { track_ref: track.ref, track_digest: track.track_digest,
        review_digest: track.review_digest, format: input.values.format as 'srt' | 'vtt' }, input.idempotencyKey))
    },
    async reconcile(raw, context) {
      context = { ...context }
      const request = PaneActionReconcileRequestSchema.safeParse(raw)
      if (!request.success) return receipt(context, raw.idempotencyKey, { status: 'unknown', reason: 'invalid_input' })
      const input = request.data
      if (input.owner !== 'sonora' || input.actionId !== actionId || !sameContext(input.context, context)) return receipt(context, input.idempotencyKey, { status: 'unknown', reason: 'invalid_input' })
      const result = await client.lookupOriginal({ ...context }, input.idempotencyKey)
      if (result.status === 'ready' && result.resource.track_ref !== input.expectedTargetRef) return receipt(context, input.idempotencyKey, { status: 'unknown', reason: 'unconfirmed' })
      return receipt(context, input.idempotencyKey, result)
    },
    async readArtifactContent(artifact, context) {
      if (artifact.owner !== 'sonora' || artifact.kind !== 'subtitle') return undefined
      const scope = { ...context }
      const claim = { ...artifact }
      const result = await client.read(scope, claim.ref)
      if (result.status !== 'ready' || result.resource.content_digest !== claim.version || result.resource.media_type !== claim.mediaType) return undefined
      const content = await client.readContent(scope, result.resource)
      // Respect the existing ephemeral editor contract without silently truncating.
      if (content === undefined || content.length > 256 * 1024) return undefined
      return { artifact: claim, contentRevision: result.resource.content_digest, content }
    },
  }
}
