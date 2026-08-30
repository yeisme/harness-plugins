// @vitest-environment jsdom
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

// vitest runs per-package, so cwd is the package root; jsdom rewrites
// import.meta.url to http: and fileURLToPath would throw.
const clientPath = join(process.cwd(), 'lib/client.js')

const built = await access(clientPath).then(() => true, () => false)

interface Registration {
  id: string
  factory: (require: (spec: string) => unknown) => unknown
}

let registration: Registration | undefined

/**
 * Runtime ModuleLoader smoke (file-preview-formats). Skipped until the bundle
 * is built; once built, the single-file factory must materialize its exports
 * against only platform seed modules — mammoth/@e965/xlsx/dompurify stay
 * unevaluated lazy factories until the first format preview opens.
 */
describe.skipIf(!built)('dsh-rich-media client.js ModuleLoader runtime smoke', () => {
  it('registers once and materializes without heavy deps evaluated', async () => {
    const win = window as unknown as { __ModuleLoader__?: { load: (reg: Registration) => void } }
    registration = undefined
    win.__ModuleLoader__ = { load: reg => { registration = reg } }
    // The bundle is one banner expression registering via window; indirect eval
    // keeps it off the ESM loader (jsdom rejects file: imports).
    const code = await readFile(clientPath, 'utf8')
    ;(0, eval)(code)

    expect(registration?.id).toBe('@yeisme/dsh-rich-media')
    const requireSpy = vi.fn((spec: string): unknown => {
      if (spec === 'react' || spec === 'react/jsx-runtime' || spec === 'react-dom' || spec === '@deepseek-ai/dsh-client-ui-primitives') return {}
      throw new Error(`unexpected require outside the platform seed table: ${spec}`)
    })
    const exports = registration!.factory(requireSpy) as Record<string, unknown>

    expect(exports.MediaPreviewPane).toBeTypeOf('function')
    expect(exports.MediaCsvRenderer).toBeTypeOf('function')
    expect(exports.MediaDocxRenderer).toBeTypeOf('function')
    expect(exports.MediaSheetRenderer).toBeTypeOf('function')
    expect(exports.classifyFileEntry).toBeTypeOf('function')
    expect(exports.registerFilePreviewRenderers).toBeTypeOf('function')
    const evaluated = requireSpy.mock.calls.map(call => call[0])
    // Registration must not evaluate any heavy renderer dep (V3 1.6/4.7):
    // pdfjs-dist, @e965/xlsx, mammoth, wavesurfer.js, hls.js stay lazy.
    for (const heavy of ['pdfjs-dist', '@e965/xlsx', 'mammoth', 'wavesurfer.js', 'hls.js']) {
      expect(evaluated, `heavy dep evaluated: ${heavy}`).not.toContain(heavy)
    }
    expect([...new Set(evaluated)].sort()).toEqual([
      '@deepseek-ai/dsh-client-ui-primitives',
      'react',
      'react-dom',
      'react/jsx-runtime',
    ])
  }, 60_000)
})
