import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { clientInject, clientName } from '../src/client/index.ts'

describe('bundle smoke', () => {
  it('ships a cordis patch and a dsh bundle descriptor', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
    expect(pkg.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(readFileSync(new URL('../cordis.patch.yml', import.meta.url), 'utf8')).toContain('@yeisme/dsh-session-cookie-manager')
  })
  it('client entry is mount-free and re-exports the safe client face', () => {
    expect(clientName).toBe('dsh-session-cookie-manager/client')
    expect(clientInject).toEqual([])
  })
})
