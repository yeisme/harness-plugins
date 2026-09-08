import { describe, expect, it } from 'vitest'
import { CREATOR_ARTIFACT_IMAGE_MAX_BYTES, validateCreatorArtifactImage } from '../src/artifact-image.ts'

const artifact = { schema: 'pane.artifact.v1alpha1', owner: 'eikona', kind: 'image', ref: 'artifact:image', version: 'v1', mediaType: 'image/png', title: 'Synthetic image', evidenceRefs: [], capabilities: ['preview'] }
const resource = () => ({ artifact, contentRevision: 'content:v1', mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) })

describe('Host-only Creator image resource', () => {
  it('detaches owner bytes before a later owner mutation', () => {
    const value = resource()
    const parsed = validateCreatorArtifactImage(value)!
    value.bytes[0] = 99
    expect(parsed.bytes).toEqual(new Uint8Array([1, 2, 3]))
    expect(parsed.artifact).not.toBe(artifact)
  })

  it.each([
    { mediaType: 'image/svg+xml' },
    { mediaType: 'image/jpeg' },
    { contentRevision: '' },
    { contentRevision: 'bad\nrevision' },
    { bytes: new Uint8Array(0) },
    { bytes: new Uint8Array(CREATOR_ARTIFACT_IMAGE_MAX_BYTES + 1) },
    { bytes: new Uint8Array(new SharedArrayBuffer(3)) },
    { bytes: [1, 2, 3] },
    { url: 'https://example.invalid/preview' },
  ])('rejects unbounded or unsupported resource metadata %#', override => {
    expect(validateCreatorArtifactImage({ ...resource(), ...override })).toBeUndefined()
  })
})
