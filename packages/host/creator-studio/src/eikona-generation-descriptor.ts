import { EIKONA_GENERATE_ACTION, eikonaGenerationDescriptorRef } from './eikona-generation-request.ts'
export { EIKONA_GENERATE_ACTION } from './eikona-generation-request.ts'
import { PaneActionDescriptorSchema, PANE_ACTION_DESCRIPTOR_SCHEMA } from '@yeisme/dsh-pane-protocol'
import { bindEikonaGeneration } from './eikona-generation-binding.ts'
import type { CreatorStudioContextV1 } from './types.ts'


/** Confirmation projection only; dispatch must repeat owner admission. */
export function createEikonaGenerationDescriptor(preparation: unknown, approval: unknown, observation: unknown, context: CreatorStudioContextV1, now = Date.now(), ownerProjectId?: string) {
  const projectId = ownerProjectId ?? context.projectRef?.replace(/^project:/u, '')
  if (!projectId || !context.projectRef) return undefined
  const binding = bindEikonaGeneration(preparation, approval, observation, projectId, now)
  if (!binding) return undefined
  const values = {
    preparation_ref: binding.preparationRef, preparation_digest: binding.digest,
    approval_ref: binding.request.approval_ref, prompt_version: binding.request.prompt_version,
    model: binding.request.model,
  }
  const labels: Record<keyof typeof values, string> = { preparation_ref: '固定准备', preparation_digest: '准备摘要', approval_ref: '预算批准', prompt_version: '固定提示词版本', model: '图像模型' }
  const parsed = PaneActionDescriptorSchema.safeParse({
    schema: PANE_ACTION_DESCRIPTOR_SCHEMA, owner: 'eikona', actionId: EIKONA_GENERATE_ACTION,
    descriptorRef: eikonaGenerationDescriptorRef(values), targetRef: binding.preparationRef, targetVersion: binding.digest,
    context: { ...context }, presentation: { task: 'image' }, label: '执行图像生成', risk: 'high', confirmation: 'confirm',
    expiresAt: new Date(Math.min(now + 60_000, Date.parse(binding.expiresAt))).toISOString(),
    preview: { summary: `执行固定准备，生成 1 张图片。费用未知；已批准预算上限 USD ${binding.maxCostUSD}。输出进入候选，不自动采用、写回或交付。` },
    fields: Object.entries(values).map(([key, value]) => ({ key, label: labels[key as keyof typeof values], kind: 'select', required: true, options: [{ value, label: value }] })),
  })
  return parsed.success ? { descriptor: parsed.data, values } : undefined
}
