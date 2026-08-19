import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { mediaNodeDefinition } from '../src/client/media-node.tsx'
import type { MediaRefV1 } from '../src/host/types.ts'

const media: MediaRefV1 = {
  owner: 'dsh',
  kind: 'image',
  ref: 'img-1',
  version: 'v1',
  mediaType: 'image/png',
  title: 'Example',
  capabilities: ['preview'],
}

const event: SessionEvent<'media/ref'> = {
  type: 'media/ref',
  seq: 0,
  time: 0,
  data: { mediaId: 'm1', media, title: 'Example image' },
}

describe('mediaNodeDefinition', () => {
  it('matches a media/ref event by its stable media id', () => {
    expect(mediaNodeDefinition.match(event)).toEqual({ id: 'm1', role: 'start' })
  })

  it('ignores unrelated events', () => {
    expect(mediaNodeDefinition.match({ type: 'turn/start', seq: 0, time: 0, data: { turn: 1 } })).toBeNull()
  })

  it('builds renderer-ready state from the start event', () => {
    const state = mediaNodeDefinition.start(
      { kind: 'media-ref', key: 'media-ref:m1', id: 'm1', matches: [], start: undefined, state: undefined, current: new Map() },
      { event, role: 'start', location: { kind: 'unresolved' } },
      { previous: () => undefined },
    )
    expect(state.mediaId).toBe('m1')
    expect(state.media.ref).toBe('img-1')
  })
})
