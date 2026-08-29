import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { ToolHubSidecar } from '../src/service.ts'
import { ToolHubRemoteService, toolHubRemoteMarkers } from '../src/remote.ts'
import { mcpId, skillId } from '../src/ids.ts'
import { TOOL_HUB_REMOTE_SERVICE_KEY, TOOL_HUB_SPEC_VERSION } from '../src/constants.ts'
import type { ToolHubPrefsRowV1 } from '../src/domain.ts'
import type { ToolHubTablePort } from '../src/service.ts'

class MemoryTable implements ToolHubTablePort {
  readonly rows = new Map<string, ToolHubPrefsRowV1>()
  get(key: string) { return this.rows.get(key) }
  async put(key: string, row: ToolHubPrefsRowV1) { this.rows.set(key, row) }
}

function sidecar(table?: MemoryTable) {
  return new ToolHubSidecar({
    ...(table === undefined ? {} : { table }),
    catalog: {
      async collect() {
        return {
          skills: [{ name: 'writer', description: 'Write', invocation: { modelInvocable: true } }],
          skillsComplete: true,
          tools: [{ name: 'read_file' }, { name: 'mcp__github__create_issue' }],
        }
      },
    },
    newVersion: () => 'rv1',
  })
}

describe('ToolHubSidecar', () => {
  it('lists a bounded catalog and toggles with generation CAS', async () => {
    const core = sidecar(new MemoryTable())
    const listed = await core.list()
    expect(listed).toMatchObject({ ok: true, specVersion: TOOL_HUB_SPEC_VERSION })
    if (!listed.ok) return
    const disable = await core.setEnabled({ id: skillId('writer'), enabled: false, ifGeneration: listed.generation })
    expect(disable).toMatchObject({ ok: true, enabled: false })
    const stale = await core.setEnabled({ id: skillId('writer'), enabled: true, ifGeneration: listed.generation })
    expect(stale).toMatchObject({ ok: false, code: 'generation-conflict' })
    const after = await core.list()
    if (!after.ok) return
    expect(after.items.find(item => item.id === skillId('writer'))?.enabled).toBe(false)
    expect(core.isDisabled(skillId('writer'))).toBe(true)
    expect(core.isDisabled(mcpId('github'))).toBe(false)
  })

  it('rejects unknown and non-toggleable items without retry', async () => {
    const core = sidecar()
    const listed = await core.list()
    if (!listed.ok) return
    const unknown = await core.setEnabled({ id: skillId('missing'), enabled: false, ifGeneration: listed.generation })
    expect(unknown).toMatchObject({ ok: false, code: 'item-unknown' })
  })
})

describe('toolHub remote', () => {
  it('binds the toolHub namespace and marks list/setEnabled', async () => {
    const ctx = new Context()
    const remote = new ToolHubRemoteService(ctx, sidecar())
    expect((remote as unknown as { name: string }).name).toBe(TOOL_HUB_REMOTE_SERVICE_KEY)
    expect(toolHubRemoteMarkers(remote)).toEqual([
      { method: 'list', invocation: { kind: 'direct' } },
      { method: 'setEnabled', invocation: { kind: 'direct' } },
    ])
    await ctx.fiber.dispose()
  })
})
