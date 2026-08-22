import { describe, expect, it } from 'vitest'
import { isFileEntry, validateFileEntry } from '../src/types.ts'

const base = {
  id: 'file-1',
  name: 'notes.txt',
  kind: 'text',
  mediaType: 'text/plain',
  size: 12,
  capabilities: ['preview', 'open'],
} as const

describe('FileEntryV1 validation', () => {
  it('accepts a safe file entry', () => {
    expect(validateFileEntry(base).ok).toBe(true)
    expect(isFileEntry(base)).toBe(true)
  })

  it('rejects a raw path in id or name', () => {
    expect(validateFileEntry({ ...base, id: '/etc/passwd' }).ok).toBe(false)
    expect(validateFileEntry({ ...base, name: '../secret.txt' }).ok).toBe(false)
  })

  it('rejects unknown capabilities', () => {
    expect(validateFileEntry({ ...base, capabilities: ['execute'] }).ok).toBe(false)
  })

  it('accepts a safe optional parentId', () => {
    const result = validateFileEntry({ ...base, parentId: 'dir-1' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.parentId).toBe('dir-1')
  })

  it('rejects a path-like or self-referencing parentId', () => {
    expect(validateFileEntry({ ...base, parentId: '../secret' }).ok).toBe(false)
    expect(validateFileEntry({ ...base, parentId: 'file-1' }).ok).toBe(false)
  })
})
