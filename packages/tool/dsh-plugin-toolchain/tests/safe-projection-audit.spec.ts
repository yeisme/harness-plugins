import { afterEach, describe, expect, it } from 'vitest'
import { runSafeProjectionAudit } from '../src/checkers/safe-projection-audit.js'
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

describe('safe-projection-audit (R9 观测门)', () => {
  it('reds on browser-side cookie/storage/fetch/abs-path/raw-url and host sensitive projection fields', () => {
    const root = workspace({
      'packages/client/ui-fx/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-fx' }),
      'packages/client/ui-fx/src/index.ts': [
        'export function leaky() {',
        "  const c = document.cookie",
        '  localStorage.getItem("x")',
        '  fetch("https://api.example.com/v1")',
        '  const p = "/home/user/secret.txt"',
        '}',
        '// comment fetch( should not count',
        '',
      ].join('\n'),
      'packages/host/hfx/package.json': JSON.stringify({ name: '@yeisme/dsh-hfx' }),
      'packages/host/hfx/src/projection.ts': [
        'export interface TeamProjection {',
        '  sessionId: string',
        '  token: string',
        '}',
        'interface Internal { token: string }',
        '',
      ].join('\n'),
    })
    const result = runSafeProjectionAudit(root)
    const codes = result.findings.map(finding => finding.code)
    expect(codes).toContain('SAFEPROJ/BROWSER_COOKIE_ACCESS')
    expect(codes).toContain('SAFEPROJ/BROWSER_STORAGE_ACCESS')
    expect(codes).toContain('SAFEPROJ/RAW_FETCH')
    expect(codes).toContain('SAFEPROJ/ABSOLUTE_PATH_LITERAL')
    expect(codes).toContain('SAFEPROJ/RAW_URL_LITERAL')
    expect(codes).toContain('SAFEPROJ/PROJECTION_FIELD')
    // 消息不得回显命中值（脱敏）
    const messages = result.findings.map(finding => finding.message).join(' ')
    expect(messages).not.toContain('/home/user/secret.txt')
    expect(messages).not.toContain('api.example.com')
  })

  it('reds on wire fixtures with sensitive keys or absolute paths, passes clean trees', () => {
    const root = workspace({
      'packages/client/ui-clean/package.json': JSON.stringify({ name: '@yeisme/dsh-client-ui-clean' }),
      'packages/client/ui-clean/src/index.ts': 'export const value = 1\n',
      'packages/client/ui-clean/tests/fixtures/wire.fixture.json': JSON.stringify({ tokenCount: 3, path: '/workspaces/x' }),
    })
    const result = runSafeProjectionAudit(root)
    const codes = result.findings.map(finding => finding.code)
    expect(codes).toContain('SAFEPROJ/WIRE_FIXTURE_KEY')
    expect(codes).toContain('SAFEPROJ/WIRE_FIXTURE_ABS_PATH')
  })
})
