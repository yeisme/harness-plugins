import { describe, expect, it } from 'vitest'
import { ToolsHubController } from '../src/client/controller.ts'
import type { ToolHubCatalogAnswerV1, ToolHubRemoteFace, ToolHubSetEnabledAnswerV1 } from '../src/client/wire.ts'

function catalog(generation: number, enabled = true): ToolHubCatalogAnswerV1 {
  return {
    ok: true,
    specVersion: '1.0',
    complete: true,
    generation,
    skillsAvailable: true,
    toolsAvailable: false,
    mcpInventoryAvailable: false,
    items: [{
      id: 'skill:writer',
      family: 'skill',
      origin: 'skill',
      name: 'writer',
      label: 'writer',
      description: 'Write',
      source: 'user',
      availability: enabled ? 'available' : 'disabled',
      enabled,
      canToggle: true,
    }],
  }
}

describe('ToolsHubController', () => {
  it('drops stale list answers and toggles through the remote', async () => {
    let generation = 1
    const remote: ToolHubRemoteFace = {
      async list() {
        return catalog(generation)
      },
      async setEnabled(input) {
        generation += 1
        return { ok: true, id: input.id as 'skill:writer', enabled: input.enabled, generation }
      },
    }
    const controller = new ToolsHubController(remote)
    await controller.refresh()
    const ready = controller.getSnapshot()
    expect(ready.status).toBe('ready')
    const answer: ToolHubSetEnabledAnswerV1 = await controller.setEnabled('skill:writer', false)
    expect(answer.ok).toBe(true)
    const after = controller.getSnapshot()
    expect(after.status).toBe('ready')
    if (after.status !== 'ready') return
    expect(after.catalog.generation).toBe(2)
    controller.dispose()
    await controller.refresh()
    expect(controller.getSnapshot().status).toBe('ready')
  })

  it('surfaces catalog-unavailable without inventing items', async () => {
    const remote: ToolHubRemoteFace = {
      async list() {
        return { ok: false, code: 'catalog-unavailable', message: 'catalog: unavailable in this version' }
      },
      async setEnabled() {
        return { ok: false, code: 'catalog-unavailable', message: 'catalog: unavailable in this version' }
      },
    }
    const controller = new ToolsHubController(remote)
    await controller.refresh()
    expect(controller.getSnapshot()).toMatchObject({ status: 'unavailable', code: 'catalog_unavailable' })
    controller.dispose()
  })

  it('normalizes transport details without exposing raw error payloads', async () => {
    const remote: ToolHubRemoteFace = {
      async list() {
        throw { code: 'internal', message: 'client api failed: HTTP 404', details: { authorization: 'secret' } }
      },
      async setEnabled() {
        return { ok: false, code: 'catalog-unavailable', message: 'unavailable' }
      },
    }
    const controller = new ToolsHubController(remote)
    await controller.refresh()
    const state = controller.getSnapshot()
    expect(state).toMatchObject({ status: 'error', code: 'endpoint_not_found', message: 'endpoint_not_found' })
    expect(JSON.stringify(state)).not.toMatch(/authorization|secret|HTTP 404/)
  })
})
