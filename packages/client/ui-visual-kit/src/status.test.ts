import { describe, expect, it } from 'vitest'
import { statusTone } from './status.ts'

describe('statusTone', () => {
  it('owner 词表映射到唯一 tone', () => {
    expect(statusTone('ready')).toBe('positive')
    expect(statusTone('completed')).toBe('positive')
    expect(statusTone('running')).toBe('info')
    expect(statusTone('partial')).toBe('warn')
    expect(statusTone('approval_required')).toBe('warn')
    expect(statusTone('reconcile_required')).toBe('critical')
    expect(statusTone('contract_mismatch')).toBe('critical')
    expect(statusTone('unknown')).toBe('critical')
    expect(statusTone('offline')).toBe('critical')
  })

  it('大小写不敏感', () => {
    expect(statusTone('Running')).toBe('info')
  })

  it('词表外/空值落 neutral，不抛错不伪装 ready', () => {
    expect(statusTone('brand-new-state')).toBe('neutral')
    expect(statusTone('')).toBe('neutral')
    expect(statusTone(undefined)).toBe('neutral')
    expect(statusTone(null)).toBe('neutral')
  })
})
