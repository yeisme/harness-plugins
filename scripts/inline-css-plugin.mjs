import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'

/** Match Vite's CSS ?inline import for the standalone ModuleLoader bundle. */
export function inlineCssPlugin() {
  return {
    name: 'dsh-inline-css',
    resolveId(source, importer) {
      if (!source.endsWith('.css?inline')) return null
      return createRequire(importer ?? import.meta.url).resolve(source.slice(0, -7)) + '?inline'
    },
    async load(id) {
      if (!id.endsWith('.css?inline')) return null
      return 'export default ' + JSON.stringify(await readFile(id.slice(0, -7), 'utf8'))
    },
  }
}
