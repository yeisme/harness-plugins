import { afterEach, describe, expect, it } from 'vitest'
import { runVisualTokenConformance } from '../src/checkers/visual-token.js'
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

const SURFACES_STUB = [
  '// stub surfaces gate for fixture',
  'const errors = ["client/ui-fx: adopted package has no shared Surface root/import"]',
  'if (errors.length) { process.stderr.write(`Web surface conformance failed (1):\\n- ${errors[0]}\\n`); process.exitCode = 1 }',
  '',
].join('\n')

describe('visual-token-conformance', () => {
  it('collects surfaces-gate regressions and computes token usage rates', () => {
    const root = workspace({
      'scripts/check-ui-surface-contracts.mjs': SURFACES_STUB,
      'packages/client/ui-fx/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-fx' }),
      'packages/client/ui-fx/src/index.ts': 'export const a = "var(--vk-color)"\nexport const b = "#ff0000"\nexport const c = "rgba(1,2,3,0.5)"\n',
      'packages/client/ui-clean/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-clean' }),
      'packages/client/ui-clean/src/index.ts': 'export const a = "var(--vk-a)"\nexport const b = "var(--dsw-b)"\n',
    })
    const result = runVisualTokenConformance(root)
    expect(result.findings.map(finding => finding.code)).toContain('VT/SURFACE_REGRESSION')
    const notes = result.notes.join('\n')
    expect(notes).toContain('token-rate packages/client/ui-fx: 33%')
    expect(notes).toContain('token-rate packages/client/ui-clean: 100%')
  })

  it('reports internal error when the surfaces gate cannot be executed', () => {
    const root = workspace({
      'packages/client/ui-fx/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-fx' }),
    })
    const result = runVisualTokenConformance(root)
    expect(result.status).toBe('error')
    expect(result.error).toContain('surfaces gate')
  })
})
