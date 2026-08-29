import { describe, expect, test } from 'vitest'
import { deriveMcpActivity, deriveToolActivity, splitMcpToolName, type ActivityToolResultNode } from '../src/client/activity.ts'

function landed(name: string, callTime: number, time: number, isError = false, seq = 1): ActivityToolResultNode {
  return { kind: 'tool-result', seq, time, call: { name }, callTime, isError }
}

describe('splitMcpToolName', () => {
  test('server names may contain underscores; non-mcp names are rejected', () => {
    expect(splitMcpToolName('mcp__my_server__list_files')).toEqual({ server: 'my_server', tool: 'list_files' })
    expect(splitMcpToolName('read_file')).toBeNull()
    expect(splitMcpToolName('mcp__noseparator')).toBeNull()
    expect(splitMcpToolName('mcp___leading')).toBeNull()
  })
})

describe('deriveMcpActivity', () => {
  test('groups by server with counts, errors and durations', () => {
    const activity = deriveMcpActivity([
      landed('mcp__github__create_issue', 1_000, 2_500, false, 1),
      landed('mcp__github__list_prs', 3_000, 3_100, false, 2),
      landed('mcp__github__list_prs', 5_000, 9_000, true, 3),
      landed('mcp__gateway__exec', 4_000, 4_050, false, 4),
      landed('read_file', 1, 2, false, 5),
    ])
    expect(activity).toHaveLength(2)
    const github = activity.find(group => group.server === 'github')
    expect(github).toMatchObject({ calls: 3, errors: 1, running: 0 })
    const durations = github?.records.map(record => record.durationMs)
    expect(durations).toContain(4_000)
    const gateway = activity.find(group => group.server === 'gateway')
    expect(gateway).toMatchObject({ calls: 1, errors: 0 })
  })

  test('running calls are flagged without duration and counted', () => {
    const activity = deriveMcpActivity(
      [landed('mcp__github__create_issue', 1_000, 2_000, false, 1)],
      [{ name: 'mcp__github__list_prs', time: 5_000 }],
    )
    const github = activity[0]
    expect(github).toMatchObject({ calls: 2, running: 1 })
    const running = github.records.find(record => record.running)
    expect(running).toMatchObject({ tool: 'list_prs', durationMs: null })
  })

  test('records are newest-first and capped at 20; deterministic order', () => {
    const nodes = Array.from({ length: 30 }, (_, index) => landed('mcp__bulk__op', index, index + 1, false, index))
    const first = deriveMcpActivity(nodes)
    const second = deriveMcpActivity([...nodes].reverse())
    expect(first[0].records).toHaveLength(20)
    expect(first[0].records[0].time).toBe(30)
    expect(second).toEqual(first)
  })

  test('non-unique names are dropped, not guessed into groups', () => {
    const activity = deriveMcpActivity([landed('mcp__broken', 1, 2, false, 1), landed('mcp__a__b__c', 1, 2, false, 2)])
    // mcp__broken 无第二分隔符 → 丢弃；mcp__a__b__c → server=a tool=b__c。
    expect(activity).toHaveLength(1)
    expect(activity[0]).toMatchObject({ server: 'a' })
    expect(activity[0].records[0].tool).toBe('b__c')
  })
})

describe('deriveToolActivity', () => {
  test('correlates MCP/native calls and aggregates Skill without reading arguments', () => {
    const activity = deriveToolActivity([
      landed('mcp__github__create_issue', 1_000, 2_000, false, 1),
      landed('read_file', 2_000, 2_100, true, 2),
      landed('skill', 3_000, 3_500, false, 3),
      landed('bad name', 4_000, 4_100, false, 4),
    ], [{ name: 'mcp__github__list_prs', time: 5_000 }])
    expect(activity).toMatchObject({ calls: 4, errors: 1, running: 1 })
    expect(activity.records.find(record => record.tool === 'create_issue')).toMatchObject({ itemId: 'mcp:github', family: 'mcp' })
    expect(activity.records.find(record => record.tool === 'read_file')).toMatchObject({ itemId: 'tool:read_file', family: 'native', isError: true })
    expect(activity.records.find(record => record.family === 'skill')).toMatchObject({ itemId: null, tool: 'skill' })
    expect(activity.records.some(record => record.tool === 'bad name')).toBe(false)
  })

  test('counts all valid records but bounds rendered history', () => {
    const activity = deriveToolActivity(Array.from({ length: 240 }, (_, index) => landed('read_file', index, index + 1, false, index)))
    expect(activity.calls).toBe(240)
    expect(activity.records).toHaveLength(200)
    expect(activity.records[0].time).toBe(240)
  })
})
