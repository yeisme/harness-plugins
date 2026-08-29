import { describe, expect, it } from 'vitest'
import { toolHubRemoteContribution } from '../src/client/remote-contribution.ts'
import { normalizeToolHubClientError } from '../src/client/remote.ts'

const listCodec = toolHubRemoteContribution.descriptors.find(descriptor => descriptor.method === 'list')?.result.schema

function catalog() {
  return {
    ok: true,
    specVersion: '1.0',
    complete: true,
    generation: 1,
    skillsAvailable: false,
    toolsAvailable: true,
    mcpInventoryAvailable: false,
    items: [],
  }
}

describe('toolHub list additive codec', () => {
  it('accepts old and additive responses without changing the v1 descriptor', () => {
    expect(listCodec?.parse(catalog())).toMatchObject({ specVersion: '1.0' })
    expect(listCodec?.parse({
      ...catalog(),
      observedAt: 10,
      healthAvailable: true,
      items: [{
        id: 'mcp:github', family: 'mcp', origin: 'mcp', name: 'github', label: 'mcp__github', description: '', source: 'mcp-client',
        availability: 'available', enabled: true, canToggle: true, reasonCode: 'disabled_by_user', health: { state: 'connected', observedAt: 10 },
      }],
    })).toMatchObject({ healthAvailable: true })
    expect(toolHubRemoteContribution.descriptors.find(descriptor => descriptor.method === 'list')?.id).toContain('toolHub.list@1')
  })

  it('rejects malformed optional health', () => {
    expect(() => listCodec?.parse({ ...catalog(), items: [{ health: { state: 'healthy', observedAt: 10 } }] })).toThrow(/health/)
  })
})

describe('toolHub error normalization', () => {
  it('maps 404 and drops raw details', () => {
    const error = normalizeToolHubClientError({ code: 'internal', message: 'client api failed: HTTP 404', details: { token: 'secret' } })
    expect(error.code).toBe('endpoint_not_found')
    expect(error.message).toBe('endpoint_not_found')
    expect(JSON.stringify(error)).not.toMatch(/secret|HTTP 404/)
  })
})
