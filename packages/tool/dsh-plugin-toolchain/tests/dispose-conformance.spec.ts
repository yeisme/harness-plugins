import { afterEach, describe, expect, it } from 'vitest'
import { runDisposeConformance } from '../src/checkers/dispose-conformance.js'
import { cleanupWorkspace, makeWorkspace } from './helpers.js'

const roots: string[] = []
afterEach(() => {
  for (const root of roots) cleanupWorkspace(root)
  roots.length = 0
})

function workspace(files: Record<string, string>): string {
  const root = makeWorkspace(files)
  roots.push(root)
  return root
}

describe('dispose-hmr-conformance (静态释放对称性 harness)', () => {
  it('reds NO_RELEASE_PATH when interval/listener has no release marker anywhere', () => {
    const root = workspace({
      'packages/client/ui-fx/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-fx' }),
      'packages/client/ui-fx/src/leaky.ts': [
        'export function start() {',
        '  setInterval(tick, 1000)',
        '  window.addEventListener("resize", tick)',
        '}',
        'function tick() {}',
        '',
      ].join('\n'),
    })
    const result = runDisposeConformance(root)
    const messages = result.findings.map(finding => finding.message).join(' ')
    expect(result.findings.every(finding => finding.code === 'DISPOSE/NO_RELEASE_PATH')).toBe(true)
    expect(messages).toContain('interval')
    expect(messages).toContain('event-listener')
  })

  it('reds COUNT_ASYMMETRY when a dispose path exists but counts mismatch; passes balanced files', () => {
    const root = workspace({
      'packages/client/ui-fx/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-fx' }),
      'packages/client/ui-fx/src/partial.ts': [
        'export function mount() {',
        '  window.addEventListener("resize", a)',
        '  window.addEventListener("scroll", b)',
        '  return { dispose() { window.removeEventListener("resize", a) } }',
        '}',
        '',
      ].join('\n'),
      'packages/client/ui-clean/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-clean' }),
      'packages/client/ui-clean/src/balanced.ts': [
        'export function mount() {',
        '  const obs = new ResizeObserver(() => {})',
        '  return { dispose() { obs.disconnect() } }',
        '}',
        '',
      ].join('\n'),
    })
    const result = runDisposeConformance(root)
    const asymmetry = result.findings.filter(finding => finding.code === 'DISPOSE/COUNT_ASYMMETRY')
    expect(asymmetry.length).toBe(1)
    expect(asymmetry[0]?.location).toContain('partial.ts')
    expect(result.findings.find(finding => finding.location.includes('balanced.ts'))).toBeUndefined()
  })

  it('ignores comment lines and one-shot setTimeout (timer class tracks intervals only)', () => {
    const root = workspace({
      'packages/client/ui-fx/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-fx' }),
      'packages/client/ui-fx/src/index.ts': [
        '// setInterval(comment, 1000)',
        'export function once() { setTimeout(go, 10) }',
        'function go() {}',
        '',
      ].join('\n'),
    })
    const result = runDisposeConformance(root)
    expect(result.findings).toEqual([])
  })
})
