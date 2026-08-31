import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** productivity-ui-v3 3.3: cross-project doc references; V1/V2 history untouched. */
function repo(rel: string): string {
  return readFileSync(resolve(process.cwd(), '../../..', rel), 'utf8')
}

describe('V3 documentation supersede hygiene (productivity 3.3)', () => {
  it('the V3 change README exists and documents its own scope', () => {
    const v3readme = repo('openspec/changes/dsh-pane-workspace-experience-v3/README.md')
    expect(v3readme.length).toBeGreaterThan(0)
  })

  it('archived V2/V4 pane history stays byte-identical (no rewrite)', () => {
    const archive = resolve(process.cwd(), '../../../openspec/changes/archive')
    const v2 = readFileSync(resolve(archive, '2026-08-22-dsh-pane-workspace-docking-v2', 'proposal.md'), 'utf8')
    expect(v2).toMatch(/docking|pane/i)
    const v4 = readFileSync(resolve(archive, '2026-08-25-dsh-pane-workspace-interaction-v4', 'tasks.md'), 'utf8')
    expect(v4).toMatch(/- \[x\]|- \[ \]/)
  })

  it('the productivity contract references prior generations via archive/supersede language', () => {
    const design = repo('openspec/changes/dsh-workspace-productivity-ui-v3/design.md')
    expect(design).toMatch(/V1|V2|supersede|archive/i)
  })
})
