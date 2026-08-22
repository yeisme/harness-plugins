import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session/types'
import { mediaNodeDefinition } from '../src/client/media-node.tsx'
import type { MediaNodeData } from '../src/client/media-node.tsx'
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

function context(state: MediaNodeData | undefined) {
  return { kind: 'media-ref' as const, key: 'media-ref:m1', id: 'm1', matches: [], start: undefined, state, current: new Map() }
}

describe('mediaNodeDefinition', () => {
  it('matches a media/ref event by its stable media id', () => {
    expect(mediaNodeDefinition.match(event)).toEqual({ id: 'm1', role: 'start' })
  })

  it('folds media/ref/update into the same node as an update role', () => {
    const update: SessionEvent<'media/ref/update'> = {
      type: 'media/ref/update',
      seq: 1,
      time: 1,
      data: { mediaId: 'm1', media: { ...media, ref: 'img-2', version: 'v2' }, title: 'Replaced' },
    }
    expect(mediaNodeDefinition.match(update)).toEqual({ id: 'm1', role: 'update' })
  })

  it('folds media/ref/remove into the same node as an update role', () => {
    const remove: SessionEvent<'media/ref/remove'> = {
      type: 'media/ref/remove',
      seq: 2,
      time: 2,
      data: { mediaId: 'm1', reason: 'expired' },
    }
    expect(mediaNodeDefinition.match(remove)).toEqual({ id: 'm1', role: 'update' })
  })

  it('ignores unrelated events', () => {
    expect(mediaNodeDefinition.match({ type: 'turn/start', seq: 0, time: 0, data: { turn: 1 } })).toBeNull()
  })

  it('builds renderer-ready state from the start event', () => {
    const state = mediaNodeDefinition.start(
      context(undefined),
      { event, role: 'start', location: { kind: 'unresolved' } },
      { previous: () => undefined },
    )
    expect(state.mediaId).toBe('m1')
    expect(state.media.ref).toBe('img-1')
  })

  it('applies media/ref/update to existing state', () => {
    const state: MediaNodeData = {
      mediaId: 'm1',
      media: media,
      title: 'Example image',
      summary: 'old summary',
    }
    const update: SessionEvent<'media/ref/update'> = {
      type: 'media/ref/update',
      seq: 1,
      time: 1,
      data: { mediaId: 'm1', media: { ...media, ref: 'img-2', version: 'v2' }, title: 'Replaced' },
    }
    const next = mediaNodeDefinition.update(
      context(state),
      { event: update, role: 'update', location: { kind: 'unresolved' } },
    )
    expect(next?.media.ref).toBe('img-2')
    expect(next?.title).toBe('Replaced')
    expect(next?.summary).toBe('old summary')
    expect(next?.removed).toBeUndefined()
  })

  it('marks state removed on media/ref/remove', () => {
    const state: MediaNodeData = { mediaId: 'm1', media: media, title: 'Example image' }
    const remove: SessionEvent<'media/ref/remove'> = {
      type: 'media/ref/remove',
      seq: 2,
      time: 2,
      data: { mediaId: 'm1', reason: 'expired' },
    }
    const next = mediaNodeDefinition.update(
      context(state),
      { event: remove, role: 'update', location: { kind: 'unresolved' } },
    )
    expect(next?.removed).toBe(true)
    expect(next?.removalReason).toBe('expired')
  })
})
