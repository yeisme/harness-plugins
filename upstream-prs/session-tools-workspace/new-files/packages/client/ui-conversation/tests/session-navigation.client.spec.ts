import { describe, expect, it, vi } from 'vitest'
import { ConversationNavigation } from '../src/client/conversation/navigation.ts'

describe('explicit conversation navigation', () => {
  it('queues per-session requests until the correct shell mounts', () => {
    const a = vi.fn(), b = vi.fn(), navigation = new ConversationNavigation(() => true)
    navigation.open('a', 'chat', 'tool-result:4'); navigation.open('b', 'mcp-inspector')
    navigation.bind('b', b)
    expect(b).toHaveBeenCalledWith('mcp-inspector', ''); expect(a).not.toHaveBeenCalled()
    navigation.bind('a', a); expect(a).toHaveBeenCalledWith('chat', 'tool-result:4')
  })
  it('reopens closed shells and refuses missing sessions', () => {
    const navigation = new ConversationNavigation(id => id === 'a'), first = vi.fn(), second = vi.fn()
    navigation.bind('a', first)(); navigation.open('a', 'mcp-inspector'); navigation.bind('a', second)
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledWith('mcp-inspector', '')
    expect(navigation.open('deleted', 'chat')).toBe(false)
  })
  it('protects newer bindings and stops after disposal', () => {
    const navigation = new ConversationNavigation(() => true), current = vi.fn()
    const old = navigation.bind('a', vi.fn()); navigation.bind('a', current); old(); navigation.open('a', 'chat')
    expect(current).toHaveBeenCalledOnce(); navigation.dispose(); expect(navigation.open('a', 'chat')).toBe(false)
  })
})
