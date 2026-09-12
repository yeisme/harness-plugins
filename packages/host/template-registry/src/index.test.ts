import { describe, expect, it } from 'vitest'
import { canCompile, createTemplateSession, markStale } from './index.js'
describe('template sessions', () => {
  it('requires confirmation and fields', () => { const s = createTemplateSession('official/x@1','sha256:x'); expect(canCompile(s,['tone'])).toBe(false); expect(canCompile({...s,fields:{tone:'quiet'},confirmed:true},['tone'])).toBe(true) })
  it('marks digest drift stale', () => { const s = createTemplateSession('x','a'); expect(markStale(s,'b').status).toBe('stale') })
})
