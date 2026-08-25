import { describe, expect, it } from 'vitest'
import {
  DRAMA_COMMANDS,
  probeDramaCapability,
  shouldRetryUnknownDramaResult,
  validateDramaCommandRequest,
  validateDramaContext,
  validateWorkbenchHandoff,
} from '../src/index.js'

describe('Drama Director contracts', () => {
  it('accepts a versioned context and rejects secrets or paths', () => {
    expect(validateDramaContext({
      schema: 'drama.context.v1',
      workspaceRef: 'ws:alpha',
      projectRef: 'proj:show',
      showRef: 'show:1',
      episodeRef: 'ep:2',
      ownerVersions: { auctra: 'v1' },
      contextRevision: 'rev-3',
      freshness: 'fresh',
    })).toBe(true)
    expect(validateDramaContext({
      schema: 'drama.context.v1',
      workspaceRef: '/etc/passwd',
      projectRef: 'proj:show',
      showRef: 'show:1',
      ownerVersions: {},
      contextRevision: 'rev-3',
      freshness: 'fresh',
    })).toBe(false)
  })

  it('accepts typed /drama requests and rejects argv or prompts', () => {
    expect(DRAMA_COMMANDS).toContain('review')
    expect(validateDramaCommandRequest({
      schema: 'drama.command-request.v1',
      command: 'review',
      selector: 'next-review',
      contextRevision: 'rev-3',
    })).toBe(true)
    expect(validateDramaCommandRequest({
      schema: 'drama.command-request.v1',
      command: 'review',
      selector: 'rm --force',
      contextRevision: 'rev-3',
    })).toBe(false)
    expect(shouldRetryUnknownDramaResult()).toBe(false)
  })

  it('keeps Workbench handoff to safe refs and disables without capability', () => {
    expect(validateWorkbenchHandoff({
      schema: 'drama.workbench-handoff.v1',
      contextRef: 'ctx:1',
      targetSurface: 'workbench.review',
      presentationIntent: 'open-review',
      expiresAt: 1_800_000_000_000,
      nonce: 'nonce-1',
    })).toBe(true)
    expect(validateWorkbenchHandoff({
      schema: 'drama.workbench-handoff.v1',
      contextRef: 'ctx:1',
      targetSurface: 'workbench.review',
      presentationIntent: 'https://secret.example/token',
      expiresAt: 1,
      nonce: 'nonce-1',
    })).toBe(false)
    expect(probeDramaCapability(false, 'missing creator-studio projection').disabled).toBe(true)
  })
})
