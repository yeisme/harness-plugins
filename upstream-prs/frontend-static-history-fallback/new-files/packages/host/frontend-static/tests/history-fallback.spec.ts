import { describe, expect, it } from 'vitest'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serveStatic } from '../src/index.ts'

interface CapturedResponse {
  status: number
  headers: Record<string, string | number | string[]>
  body: string | Buffer
}

function fakeResponse(): { res: CapturedResponse & { writeHead(status: number, headers?: Record<string, string | number | string[]>): void; end(body?: string | Buffer): void }; captured: CapturedResponse } {
  const captured: CapturedResponse = { status: 0, headers: {}, body: '' }
  return {
    captured,
    res: {
      ...captured,
      writeHead(status, headers = {}) { this.status = status; this.headers = headers },
      end(body = '') { this.body = body },
    },
  } as never
}

async function distOf(): Promise<{ distRoot: string; distIndex: string }> {
  const root = await mkdtemp(join(tmpdir(), 'fsfb-'))
  await mkdir(join(root, 'assets'), { recursive: true })
  await writeFile(join(root, 'index.html'), '<html>index</html>')
  await writeFile(join(root, 'assets', 'app.js'), 'console.log(1)')
  return { distRoot: root, distIndex: join(root, 'index.html') }
}

const INDEX = '<html>index</html>'
const renderIndex = async (): Promise<string> => INDEX
const authorize = (): boolean => true
const deny = (): boolean => false

describe('frontend-static historyFallback decision matrix', () => {
  it('GET + no extension + fallback on → renders the index', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    await serveStatic('/s/abc123', res as never, distRoot, distIndex, authorize, renderIndex, () => true)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/html')
    expect(String(res.body)).toBe(INDEX)
  })

  it('GET + no extension + fallback off → 404 (stock semantics)', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    await serveStatic('/s/abc123', res as never, distRoot, distIndex, authorize, renderIndex, () => false)
    expect(res.status).toBe(404)
  })

  it('GET + extension + fallback on without html Accept → 404 (caller gates Accept)', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    // No-extension rule lives in the caller; extension + no Accept ⇒ false.
    await serveStatic('/missing.js', res as never, distRoot, distIndex, authorize, renderIndex, () => false)
    expect(res.status).toBe(404)
  })

  it('existing asset still serves regardless of the fallback decision', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    await serveStatic('/assets/app.js', res as never, distRoot, distIndex, authorize, renderIndex, () => true)
    expect(res.status).toBe(200)
    expect(String(res.body)).toBe('console.log(1)')
  })

  it('fallback response respects index authorization', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    await serveStatic('/s/abc123', res as never, distRoot, distIndex, deny, renderIndex, () => true)
    expect(res.status).toBe(0)
    expect(res.body).toBe('')
  })

  it('traversal stays 403 even with the fallback on', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    await serveStatic('/../etc/passwd', res as never, distRoot, distIndex, authorize, renderIndex, () => true)
    expect(res.status).toBe(403)
  })

  it('dist root renders the authenticated index without touching the fallback', async () => {
    const { distRoot, distIndex } = await distOf()
    const { res } = fakeResponse()
    let asked = false
    await serveStatic('/', res as never, distRoot, distIndex, authorize, renderIndex, () => { asked = true; return true })
    expect(res.status).toBe(200)
    expect(String(res.body)).toBe(INDEX)
    expect(asked).toBe(false)
  })
})
