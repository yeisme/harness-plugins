import { mkdtemp, writeFile, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { handleYeismeFilesApi, listWorkspaceTree, readGitStatus, readWorkspaceText } from '../src/node.ts'

describe('@yeisme/dsh-file-host/node', () => {
  it('lists files and directories in one workspace level', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'README.md'), '# title\n')
    await writeFile(join(root, '.hidden'), 'x')
    const listing = await listWorkspaceTree(root)
    expect(listing.entries.map(entry => entry.name)).toEqual(['src', '.hidden', 'README.md'])
    expect(listing.entries.find(entry => entry.name === 'src')?.isDir).toBe(true)
    expect(listing.entries.find(entry => entry.name === 'README.md')?.isDir).toBe(false)
  })

  it('reads bounded utf8 text and refuses directory reads', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const file = join(root, 'notes.txt')
    await writeFile(file, 'hello pane')
    await expect(readWorkspaceText(file)).resolves.toMatchObject({ content: 'hello pane', binary: false })
    await expect(readWorkspaceText(root)).rejects.toThrow(/directory/)
  })

  it('serves fs.tree and fs.read through the yeisme-files API', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    await writeFile(join(root, 'a.ts'), 'export {}\n')
    const treeReq = {
      method: 'POST',
      url: '/yeisme-files/api/fs.tree',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root }))
      },
    }
    let treeBody = ''
    const treeRes = {
      writeHead() {},
      end(body: string) { treeBody = body },
    }
    await handleYeismeFilesApi(treeReq, treeRes, { sessionCwd: (_id, cwd) => cwd ?? root })
    const tree = JSON.parse(treeBody) as { ok: boolean; value: { entries: Array<{ name: string; isDir: boolean }> } }
    expect(tree.ok).toBe(true)
    expect(tree.value.entries.some(entry => entry.name === 'a.ts' && entry.isDir === false)).toBe(true)

    const readReq = {
      method: 'POST',
      url: '/yeisme-files/api/fs.read',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: join(root, 'a.ts') }))
      },
    }
    let readBody = ''
    const readRes = {
      writeHead() {},
      end(body: string) { readBody = body },
    }
    await handleYeismeFilesApi(readReq, readRes, { sessionCwd: (_id, cwd) => cwd ?? root })
    const read = JSON.parse(readBody) as { ok: boolean; value: { content: string } }
    expect(read.value.content).toContain('export')
  })

  it('reads git porcelain status for the workspace', async () => {
    const status = await readGitStatus(process.cwd())
    expect(status.branch.length).toBeGreaterThan(0)
    expect(Array.isArray(status.files)).toBe(true)
  })

  it('serves git.status through the yeisme-files API', async () => {
    const req = {
      method: 'POST',
      url: '/yeisme-files/api/git.status',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: process.cwd() }))
      },
    }
    let body = ''
    const res = {
      writeHead() {},
      end(text: string) { body = text },
    }
    await handleYeismeFilesApi(req, res, { sessionCwd: () => process.cwd() })
    const parsed = JSON.parse(body) as { ok: boolean; value: { branch: string; files: unknown[] } }
    expect(parsed.ok).toBe(true)
    expect(parsed.value.branch.length).toBeGreaterThan(0)
  })

  it('serves typed git.stage and git.diff inside a disposable workspace', async () => {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')
    const execFileAsync = promisify(execFile)
    const root = await mkdtemp(join(tmpdir(), 'yeisme-git-'))
    await execFileAsync('git', ['init'], { cwd: root })
    await execFileAsync('git', ['config', 'user.email', 'dev@example.invalid'], { cwd: root })
    await execFileAsync('git', ['config', 'user.name', 'dev'], { cwd: root })
    await writeFile(join(root, 'README.md'), '# title\n')
    const stageReq = {
      method: 'POST',
      url: '/yeisme-files/api/git.stage',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: 'README.md' }))
      },
    }
    let stageBody = ''
    const stageRes = { writeHead() {}, end(body: string) { stageBody = body } }
    await handleYeismeFilesApi(stageReq, stageRes, { sessionCwd: () => root })
    expect(JSON.parse(stageBody)).toMatchObject({ ok: true, value: { status: 'ok', actionId: 'stage' } })

    const diffReq = {
      method: 'POST',
      url: '/yeisme-files/api/git.diff',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: 'README.md' }))
      },
    }
    let diffBody = ''
    const diffRes = { writeHead() {}, end(body: string) { diffBody = body } }
    await handleYeismeFilesApi(diffReq, diffRes, { sessionCwd: () => root })
    expect(JSON.parse(diffBody).ok).toBe(true)
  })

  it('rejects paths that escape the session workspace', async () => {
    const root = await mkdtemp(join(tmpdir(), 'yeisme-files-'))
    const req = {
      method: 'POST',
      url: '/yeisme-files/api/fs.tree',
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify({ cwd: root, path: '/etc' }))
      },
    }
    let body = ''
    let status = 0
    const res = {
      writeHead(code: number) { status = code },
      end(text: string) { body = text },
    }
    await handleYeismeFilesApi(req, res, { sessionCwd: () => root })
    expect(status).toBe(403)
    expect(body).toContain('forbidden')
  })
})
