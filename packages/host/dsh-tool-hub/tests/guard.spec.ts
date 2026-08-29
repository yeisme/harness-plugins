import { describe, expect, it } from 'vitest'
import { denyReason } from '../src/plugin.ts'
import { ToolHubSidecar } from '../src/service.ts'
import { mcpId, skillId, toolId } from '../src/ids.ts'

describe('tool hub guard', () => {
  it('denies disabled skills, MCP servers, and native tools', async () => {
    const core = new ToolHubSidecar({
      catalog: {
        async collect() {
          return {
            skills: [{ name: 'writer', invocation: { modelInvocable: true } }],
            skillsComplete: true,
            tools: [{ name: 'read_file' }, { name: 'mcp__github__create_issue' }],
          }
        },
      },
    })
    const listed = await core.list()
    if (!listed.ok) throw new Error('expected catalog')
    await core.setEnabled({ id: skillId('writer'), enabled: false, ifGeneration: listed.generation })
    const afterSkill = await core.list()
    if (!afterSkill.ok) throw new Error('expected catalog')
    await core.setEnabled({ id: mcpId('github'), enabled: false, ifGeneration: afterSkill.generation })
    const afterMcp = await core.list()
    if (!afterMcp.ok) throw new Error('expected catalog')
    await core.setEnabled({ id: toolId('read_file'), enabled: false, ifGeneration: afterMcp.generation })
    expect(denyReason(core, { name: 'skill', arguments: { name: 'writer' } })).toMatch(/writer/)
    expect(denyReason(core, { name: 'mcp__github__create_issue' })).toMatch(/github/)
    expect(denyReason(core, { name: 'read_file' })).toMatch(/read_file/)
    expect(denyReason(core, { name: 'skill', arguments: { name: 'other' } })).toBeUndefined()
  })
})
