import { describe, expect, it } from 'vitest'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createNodeLanguageIntelligenceHost, type NodeLanguageDocumentSourceV1 } from '../lib/node.mjs'

function source(path: string, text: string): NodeLanguageDocumentSourceV1 {
  return {
    async resolve(input) {
      return {
        sessionId: input.sessionId,
        ref: input.ref,
        workspacePath: process.cwd(),
        path,
        title: path.split('/').at(-1) ?? 'fixture',
        text,
        truncated: false,
        readOnly: false,
        version: 'v1',
      }
    },
    async resolveTarget() { return undefined },
  }
}

describe('NodeLanguageIntelligenceHost', () => {
  it('projects a bounded Tree-sitter AST without exposing the filesystem path', async () => {
    const text = 'const emoji = "🙂"\nexport function greet(name: string) { return `${emoji} ${name}` }\n'
    const host = createNodeLanguageIntelligenceHost(source('/workspace/private/src/example.ts', text), { providers: [] })
    const snapshot = await host.open({ sessionId: 'session-1', ref: 'file-safe' })

    expect(['ast-only', 'lsp+ast']).toContain(snapshot.engine)
    expect(snapshot.modelUri).toMatch(/^dsh-resource:\/\/model\//)
    expect(JSON.stringify(snapshot)).not.toContain('/workspace/private')

    const result = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'structure' })
    expect(result.kind).toBe('structure')
    if (result.kind === 'structure') {
      expect(result.value.engine).toBe('tree-sitter')
      expect(result.value.nodes.some(node => node.kind === 'function_declaration')).toBe(true)
      expect(result.value.nodes.every(node => Number.isInteger(node.range.start.character))).toBe(true)
      expect(result.value.nodes.length).toBeLessThanOrEqual(10_000)
    }
    host.dispose()
  })

  it.each([
    ['jsonc-parser', '/workspace/config.json', '{"service":{"enabled":true}}'],
    ['mdast', '/workspace/README.md', '# Title\n\nParagraph with **detail**.\n'],
    ['yaml', '/workspace/config.yaml', 'service:\n  enabled: true\n'],
  ])('uses the %s structural provider', async (engine, path, text) => {
    const host = createNodeLanguageIntelligenceHost(source(path, text), { providers: [] })
    const snapshot = await host.open({ sessionId: 'session-1', ref: 'file-safe' })
    const result = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'structure' })
    expect(result.kind).toBe('structure')
    if (result.kind === 'structure') {
      expect(result.value.engine).toBe(engine)
      expect(result.value.nodes.length).toBeGreaterThan(0)
    }
    host.dispose()
  })

  it('rejects stale document versions and invalidates the AST after a change', async () => {
    const host = createNodeLanguageIntelligenceHost(source('/workspace/example.txt', 'first'), { providers: [] })
    const snapshot = await host.open({ sessionId: 'session-1', ref: 'file-safe' })
    expect(await host.change({ handleId: snapshot.handleId, documentVersion: 1, text: 'stale' })).toEqual({ accepted: false, documentVersion: 1 })
    expect(await host.change({ handleId: snapshot.handleId, documentVersion: 2, text: 'second' })).toEqual({ accepted: true, documentVersion: 2 })
    await expect(host.query(snapshot.handleId, 1, { kind: 'structure' })).rejects.toThrow('stale')
    const result = await host.query(snapshot.handleId, 2, { kind: 'structure' })
    expect(result.kind).toBe('structure')
    if (result.kind === 'structure') expect(result.value.documentVersion).toBe(2)
    await host.close(snapshot.handleId)
    await expect(host.query(snapshot.handleId, 2, { kind: 'structure' })).rejects.toThrow('closed')
    host.dispose()
  })

  it('fails closed when an LSP target leaves the opaque workspace owner', async () => {
    const host = createNodeLanguageIntelligenceHost({
      ...source('/workspace/example.ts', 'const value = 1'),
      async resolveTarget() { return undefined },
    }, { providers: [] })
    const snapshot = await host.open({ sessionId: 'session-1', ref: 'file-safe' })
    const result = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'definition', position: { line: 0, character: 1 } })
    expect(result).toEqual({ kind: 'definition', value: [] })
    host.dispose()
  })

  it('normalizes fake LSP semantics, UTF-16 positions and bounded workspace edits', async () => {
    const path = '/workspace/private/fixture.ts'
    const fixture = fileURLToPath(new URL('./fixtures/fake-lsp.mjs', import.meta.url))
    const host = createNodeLanguageIntelligenceHost({
      ...source(path, 'const emoji = "🙂"\n'),
      async resolveTarget(_sessionId, uri) {
        return uri === pathToFileURL(path).href ? { ref: 'file-safe', version: 'v1' } : undefined
      },
    }, { providers: [{ id: 'fake-lsp', languageIds: ['typescript'], command: process.execPath, args: [fixture, 'normal'] }] })
    const snapshot = await host.open({ sessionId: 'session-1', ref: 'file-safe' })
    expect(snapshot.engine).toBe('lsp+ast')
    expect(snapshot.features).toEqual(expect.arrayContaining(['symbols', 'semanticTokens', 'diagnostics', 'hover', 'format', 'rename', 'codeActions']))

    const symbols = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'symbols' })
    expect(symbols).toEqual(expect.objectContaining({ kind: 'symbols', value: [expect.objectContaining({ name: 'emoji' })] }))
    const tokens = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'semanticTokens' })
    expect(tokens).toEqual({ kind: 'semanticTokens', value: [{ line: 0, character: 6, length: 5, tokenType: 'variable', modifiers: ['declaration'] }] })
    const hover = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'hover', position: { line: 0, character: 15 } })
    expect(hover).toEqual({ kind: 'hover', value: { markdown: '**emoji** fixture hover' } })
    const definition = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'definition', position: { line: 0, character: 8 } })
    expect(definition).toEqual({ kind: 'definition', value: [{ ref: 'file-safe', range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } } }] })
    const formatted = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'format', tabSize: 2, insertSpaces: true })
    expect(formatted).toEqual(expect.objectContaining({ kind: 'workspaceEdit', value: expect.objectContaining({ kind: 'format', files: [expect.objectContaining({ ref: 'file-safe', expectedVersion: 'v1' })] }) }))
    const action = await host.query(snapshot.handleId, snapshot.documentVersion, { kind: 'codeAction', range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } } })
    expect(action).toEqual(expect.objectContaining({ kind: 'workspaceEdit', value: expect.objectContaining({ kind: 'codeAction', files: [expect.objectContaining({ ref: 'file-safe' })] }) }))
    expect(await host.change({ handleId: snapshot.handleId, documentVersion: 3, text: 'const emoji = "next"\n' })).toEqual({ accepted: true, documentVersion: 3 })
    expect(await host.change({ handleId: snapshot.handleId, documentVersion: 2, text: 'stale' })).toEqual({ accepted: false, documentVersion: 3 })
    host.dispose()
  })

  it('rejects LSP resource operations and restarts a crashed provider for the next open', async () => {
    const fixture = fileURLToPath(new URL('./fixtures/fake-lsp.mjs', import.meta.url))
    const descriptor = (mode: string) => [{ id: `fake-${mode}`, languageIds: ['typescript'], command: process.execPath, args: [fixture, mode] }]
    const resourceHost = createNodeLanguageIntelligenceHost(source('/workspace/private/fixture.ts', 'const value = 1\n'), { providers: descriptor('resource-op') })
    const resourceSnapshot = await resourceHost.open({ sessionId: 'session-1', ref: 'file-safe' })
    const rename = await resourceHost.query(resourceSnapshot.handleId, resourceSnapshot.documentVersion, { kind: 'rename', position: { line: 0, character: 6 }, newName: 'next' })
    expect(rename).toEqual({ kind: 'workspaceEdit', value: { title: 'Rename symbol', kind: 'rename', files: [], rejectedReason: 'resource/document operations are unsupported in V1' } })
    resourceHost.dispose()

    const crashHost = createNodeLanguageIntelligenceHost(source('/workspace/private/crash.ts', 'const value = 1\n'), { providers: descriptor('crash'), initializeTimeoutMs: 1_000 })
    const first = await crashHost.open({ sessionId: 'session-1', ref: 'file-safe' })
    expect(first.engine).toBe('lsp+ast')
    await new Promise(resolve => setTimeout(resolve, 180))
    const second = await crashHost.open({ sessionId: 'session-1', ref: 'file-safe' })
    expect(second.engine).toBe('lsp+ast')
    crashHost.dispose()

    const slowHost = createNodeLanguageIntelligenceHost(source('/workspace/private/slow.ts', 'const value = 1\n'), { providers: descriptor('slow'), requestTimeoutMs: 50 })
    const slow = await slowHost.open({ sessionId: 'session-1', ref: 'file-safe' })
    const startedAt = Date.now()
    const timedOut = await slowHost.query(slow.handleId, slow.documentVersion, { kind: 'hover', position: { line: 0, character: 1 } })
    expect(timedOut).toEqual({ kind: 'hover' })
    expect(Date.now() - startedAt).toBeLessThan(250)
    slowHost.dispose()
  })
})
