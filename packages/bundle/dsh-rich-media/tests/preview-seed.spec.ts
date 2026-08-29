import { afterEach, describe, expect, it } from 'vitest'
import { clearSeededMedia, listSeededMedia, seedMediaPreview, subscribeSeededMedia } from '../src/client/preview-seed.ts'
import type { MediaRefV1 } from '../src/host/types.ts'

const image: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  title: 'Example image',
  capabilities: ['preview'],
}

afterEach(() => {
  clearSeededMedia()
})

describe('media preview seed', () => {
  it('stores validated refs and ignores path-like payloads', () => {
    seedMediaPreview(image)
    seedMediaPreview({ ...image, ref: '/tmp/secret.png' })
    expect(listSeededMedia()).toEqual([image])
  })

  it('notifies subscribers and clears on dispose', () => {
    let ticks = 0
    const stop = subscribeSeededMedia(() => { ticks += 1 })
    seedMediaPreview(image)
    expect(ticks).toBe(1)
    clearSeededMedia()
    expect(listSeededMedia()).toEqual([])
    expect(ticks).toBe(2)
    stop()
    seedMediaPreview(image)
    expect(ticks).toBe(2)
  })
})
