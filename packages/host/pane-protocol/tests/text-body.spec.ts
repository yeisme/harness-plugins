import { expect, it } from 'vitest'
import { PaneActionDescriptorSchema, PaneActionRequestSchema, encodePaneActionValues, decodePaneActionValues, PANE_TEXT_BODY_BYTES } from '../src/index.js'

const context = { workspaceRef: 'workspace:test', sessionRef: 'session:test', principalRef: 'principal:test', revision: '1' }
const descriptor = PaneActionDescriptorSchema.parse({ schema: 'pane.action-descriptor.v1alpha1', descriptorRef: 'action:save', owner: 'auctra', actionId: 'working-copy.save', targetRef: 'artifact:text', targetVersion: '1', context,
  label: 'Save', risk: 'low', confirmation: 'none', expiresAt: '2999-01-01T00:00:00Z', preview: { summary: 'Save' }, fields: [{ key: 'body', kind: 'textarea', label: 'Text', required: true, maxLength: 16384 }], textBody: { field: 'body', maxBytes: PANE_TEXT_BODY_BYTES } })
const request = { schema: 'pane.action-request.v1alpha1', descriptorRef: descriptor.descriptorRef, owner: descriptor.owner, actionId: descriptor.actionId, expectedTargetRef: descriptor.targetRef, expectedTargetVersion: '1', context, idempotencyKey: 'original-key' }

it('preserves legacy values and only encodes advertised large bodies separately', () => {
  expect(encodePaneActionValues(descriptor, { body: 'short' })).toEqual({ values: { body: 'short' } })
  const body = 'a'.repeat(16385)
  const parsed = PaneActionRequestSchema.parse({ ...request, ...encodePaneActionValues(descriptor, { body }) })
  expect(parsed.values).toEqual({})
  expect(decodePaneActionValues(parsed).body === body).toBe(true)
  const { textBody: _, ...legacy } = descriptor
  expect(PaneActionRequestSchema.safeParse({ ...request, ...encodePaneActionValues(legacy, { body }) }).success).toBe(false)
})

it('rejects duplicate values, malformed Unicode and bytes beyond the boundary', () => {
  const content = '😀'.repeat(PANE_TEXT_BODY_BYTES / 4)
  const base = { ...request, values: {}, textBody: { field: 'body', content } }
  expect(PaneActionRequestSchema.safeParse(base).success).toBe(true)
  expect(PaneActionRequestSchema.safeParse({ ...base, values: { body: 'duplicate' } }).success).toBe(false)
  for (const invalid of [content + 'a', '\uD800', '\uDC00']) {
    expect(PaneActionRequestSchema.safeParse({ ...base, textBody: { field: 'body', content: invalid } }).success).toBe(false)
  }
  expect(PaneActionDescriptorSchema.safeParse({ ...descriptor, textBody: { field: 'missing', maxBytes: 1 } }).success).toBe(false)
})
