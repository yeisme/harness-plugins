import { describe, expect, it } from 'vitest'
import { createDshHostProjection } from '../src/dsh-host-projection.ts'
import type { DshHostProjectionSeams } from '../src/dsh-host-projection.ts'

describe('createDshHostProjection', () => {
  it('wraps real DSH seam callbacks', () => {
    const seams: DshHostProjectionSeams = {
      listMedia: () => [],
      listFileEntries: () => [],
      resolveMediaUrl: () => undefined,
      resolveFilePreviewUrl: () => undefined,
    }
    const projection = createDshHostProjection(seams)
    expect(projection.listMedia()).toEqual([])
    expect(projection.listFileEntries()).toEqual([])
  })
})
