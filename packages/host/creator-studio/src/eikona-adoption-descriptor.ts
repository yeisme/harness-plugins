import { PaneActionDescriptorSchema, PANE_ACTION_DESCRIPTOR_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { EIKONA_ADOPT_ACTION, eikonaAdoptionDescriptorRef } from './eikona-adoption-request.ts'
import { prepareEikonaAdoption } from './eikona-adoption.ts'
import type { CreatorStudioContextV1 } from './types.ts'

/** Build the existing confirmation surface only from a verified prepared candidate. */
export function createEikonaAdoptionDescriptor(prepared: ReturnType<typeof prepareEikonaAdoption>, context: CreatorStudioContextV1, now = Date.now()) {
  if (prepared.status !== 'prepared' || !Number.isFinite(now)) return undefined
  const request = prepared.request
  const version = 'expected_version' in request ? Number(request.expected_version) : 0
  const values = { run_id: request.asset_ref, candidate_id: request.review_version, content_digest: request.expected_content_digest, decision_version: version }
  const parsed = PaneActionDescriptorSchema.safeParse({
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'eikona', actionId: EIKONA_ADOPT_ACTION,
    descriptorRef: eikonaAdoptionDescriptorRef(prepared.artifactRef, request.expected_content_digest, version),
    targetRef: prepared.artifactRef, targetVersion: request.expected_content_digest, context: { ...context },
    label: '采用候选', risk: 'medium', confirmation: 'confirm', expiresAt: new Date(now + 60_000).toISOString(),
    preview: { summary: '将所选固定版本图片标记为已采用。写回源文件、正式版本确认和最终交付分别执行。' },
    fields: [
      { key: 'run_id', label: '来源运行', kind: 'select', required: true, options: [{ value: values.run_id, label: values.run_id }] },
      { key: 'candidate_id', label: '候选', kind: 'select', required: true, options: [{ value: values.candidate_id, label: values.candidate_id }] },
      { key: 'content_digest', label: '固定图片摘要', kind: 'select', required: true, options: [{ value: values.content_digest, label: values.content_digest }] },
      { key: 'decision_version', label: '已观察决定版本', kind: 'number', required: true, min: version, max: version },
    ],
  })
  return parsed.success ? { descriptor: parsed.data, values } : undefined
}
