#!/usr/bin/env node
/**
 * Minimal Workbench module generator.
 *
 * Usage:
 *   node packages/bundle/dsh-workbench-core/scripts/generate-module.mjs my-module
 *
 * Creates packages/bundle/dsh-<name>/ with a Workbench Core module skeleton.
 * This is an evaluation scaffold, not a full package manager replacement.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const name = process.argv[2]
if (!name || !/^[a-z0-9][a-z0-9-]{1,63}$/.test(name)) {
  console.error('Usage: node generate-module.mjs <module-name>')
  process.exit(1)
}

const root = resolve(import.meta.dirname, '..', '..', '..', '..')
const dir = resolve(root, 'packages', 'bundle', `dsh-${name}`)
const pkgName = `@yeisme/dsh-${name}`

const files = {
  'package.json': JSON.stringify({
    name: pkgName,
    version: '0.1.0-rc.1',
    description: `DSH Workbench module: ${name}`,
    type: 'module',
    main: 'lib/index.js',
    types: 'lib/types/index.d.ts',
    scripts: {
      typecheck: 'tsc -p tsconfig.json --noEmit',
      test: 'vitest run',
      build: 'tsc -p tsconfig.json && tsdown',
    },
    dependencies: {
      '@yeisme/dsh-workbench-core': 'workspace:*',
      react: '^18.2.0',
    },
    devDependencies: {
      typescript: '^5.6.0',
      tsdown: '^0.22.2',
      vitest: '^3.0.0',
      '@types/react': '~18.3.1',
    },
  }, null, 2),
  'tsconfig.json': JSON.stringify({
    extends: '../../../tsconfig.base.client.json',
    compilerOptions: { rootDir: 'src', outDir: 'lib/types' },
    include: ['src'],
  }, null, 2),
  'src/module.ts': `import type { WorkbenchModuleDefinitionV1 } from '@yeisme/dsh-workbench-core'

export const module: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-${name}',
  version: '0.1.0-rc.1',
  title: '${name}',
  requiredCapabilities: [],
  tabs: [
    { id: '${name}', moduleId: 'dsh-${name}', title: '${name}', order: 0, closable: true, scope: 'session-maybe' },
  ],
  commands: [],
}
`,
  'src/index.ts': `export { module } from './module.ts'
`,
  'tests/module.spec.ts': `import { describe, expect, it } from 'vitest'
import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { module } from '../src/module.ts'

describe('${name} module', () => {
  it('registers into Workbench Core', () => {
    const registry = new WorkbenchRegistry()
    registry.register(module)
    expect(registry.snapshot().modules.map(item => item.id)).toEqual(['dsh-${name}'])
  })
})
`,
  'README.md': `# ${pkgName}

DSH Workbench module generated from the Workbench Core scaffold.

## Development

\`\`\`bash
pnpm --filter ${pkgName} run typecheck
pnpm --filter ${pkgName} run test
pnpm --filter ${pkgName} run build
\`\`\`
`,
}

await mkdir(resolve(dir, 'src'), { recursive: true })
await mkdir(resolve(dir, 'tests'), { recursive: true })
for (const [file, content] of Object.entries(files)) {
  await writeFile(resolve(dir, file), content)
}
console.log(`Created ${dir}`)
