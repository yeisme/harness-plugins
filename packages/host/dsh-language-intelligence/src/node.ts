import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createRequire } from 'node:module'
import { randomUUID } from 'node:crypto'
import { basename, dirname, extname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { parseTree, type Node as JsonNode } from 'jsonc-parser'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { parseDocument } from 'yaml'
import { CancellationTokenSource, createMessageConnection, StreamMessageReader, StreamMessageWriter, type MessageConnection } from 'vscode-jsonrpc/node'
import { Language, Parser, type Node as TreeSitterNode } from 'web-tree-sitter'
import {
  LANGUAGE_INTELLIGENCE_CAPABILITY,
  type CompletionItemProjectionV1,
  type DiagnosticSeverityV1,
  type DocumentSymbolV1,
  type HoverProjectionV1,
  type LanguageCapabilitySnapshotV1,
  type LanguageDiagnosticV1,
  type LanguageDocumentChangeV1,
  type LanguageDocumentRefV1,
  type LanguageDocumentSnapshotV1,
  type LanguageFeatureV1,
  type LanguageIntelligenceHostV1,
  type LanguageQueryResultV1,
  type LanguageQueryV1,
  type LanguageTargetV1,
  type SemanticTokenV1,
  type SyntaxNodeProjectionV1,
  type SyntaxTreeProjectionV1,
  type TextPositionV1,
  type TextRangeV1,
  type WorkspaceTextEditDraftV1,
  type WorkspaceTextEditV1,
} from './index.js'

const MAX_DOCUMENT_BYTES = 1024 * 1024
const MAX_AST_NODES = 10_000
const MAX_AST_DEPTH = 64
const MAX_LABEL = 120
const MAX_DIAGNOSTICS = 500
const MAX_SYMBOLS = 2_000
const MAX_COMPLETIONS = 200
const MAX_STRING = 2_000

export interface NodeLanguageDocumentV1 {
  readonly sessionId: string
  readonly ref: string
  readonly workspacePath: string
  readonly path: string
  readonly title: string
  readonly text: string
  readonly truncated: boolean
  readonly readOnly: boolean
  readonly version: string
}

export interface NodeLanguageTargetV1 {
  readonly ref: string
  readonly version?: string
}

export interface NodeLanguageDocumentSourceV1 {
  resolve(input: LanguageDocumentRefV1): Promise<NodeLanguageDocumentV1>
  resolveTarget(sessionId: string, uri: string): Promise<NodeLanguageTargetV1 | undefined>
}

export interface LanguageProviderV1 {
  readonly id: string
  readonly languageIds: readonly string[]
  readonly command: string
  readonly args: readonly string[]
}

export interface NodeLanguageIntelligenceOptionsV1 {
  /** Host-only fixed provider descriptors. Browser requests can never alter these values. */
  readonly providers?: readonly LanguageProviderV1[]
  readonly initializeTimeoutMs?: number
  readonly requestTimeoutMs?: number
}

const DEFAULT_PROVIDERS: readonly LanguageProviderV1[] = [
  { id: 'typescript-language-server', languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'], command: 'typescript-language-server', args: ['--stdio'] },
  { id: 'gopls', languageIds: ['go'], command: 'gopls', args: [] },
  { id: 'pyright', languageIds: ['python'], command: 'pyright-langserver', args: ['--stdio'] },
  { id: 'rust-analyzer', languageIds: ['rust'], command: 'rust-analyzer', args: [] },
  { id: 'bash-language-server', languageIds: ['shellscript'], command: 'bash-language-server', args: ['start'] },
  { id: 'json-language-server', languageIds: ['json', 'jsonc'], command: 'vscode-json-language-server', args: ['--stdio'] },
  { id: 'yaml-language-server', languageIds: ['yaml'], command: 'yaml-language-server', args: ['--stdio'] },
  { id: 'taplo', languageIds: ['toml'], command: 'taplo', args: ['lsp', 'stdio'] },
  { id: 'marksman', languageIds: ['markdown'], command: 'marksman', args: ['server'] },
]

const TREE_SITTER_GRAMMARS: Readonly<Record<string, string>> = {
  typescript: 'typescript',
  typescriptreact: 'tsx',
  javascript: 'javascript',
  javascriptreact: 'javascript',
  go: 'go',
  python: 'python',
  rust: 'rust',
  shellscript: 'bash',
}

function bounded(value: unknown, max = MAX_STRING): string | undefined {
  if (typeof value !== 'string' || value.length === 0) return undefined
  return value.slice(0, max)
}

function normalizePosition(value: unknown): TextPositionV1 {
  const position = value as { line?: unknown; character?: unknown } | undefined
  return {
    line: typeof position?.line === 'number' && Number.isFinite(position.line) && position.line >= 0 ? Math.floor(position.line) : 0,
    character: typeof position?.character === 'number' && Number.isFinite(position.character) && position.character >= 0 ? Math.floor(position.character) : 0,
  }
}

function normalizeRange(value: unknown): TextRangeV1 {
  const range = value as { start?: unknown; end?: unknown } | undefined
  return { start: normalizePosition(range?.start), end: normalizePosition(range?.end) }
}

function severityOf(value: unknown): DiagnosticSeverityV1 {
  if (value === 1) return 'error'
  if (value === 2) return 'warning'
  if (value === 3) return 'information'
  return 'hint'
}

function languageIdOf(path: string): string {
  const ext = extname(path).toLowerCase()
  if (ext === '.ts') return 'typescript'
  if (ext === '.tsx') return 'typescriptreact'
  if (['.js', '.mjs', '.cjs'].includes(ext)) return 'javascript'
  if (ext === '.jsx') return 'javascriptreact'
  if (ext === '.go') return 'go'
  if (ext === '.py') return 'python'
  if (ext === '.rs') return 'rust'
  if (['.sh', '.bash', '.zsh'].includes(ext)) return 'shellscript'
  if (ext === '.json') return 'json'
  if (ext === '.jsonc') return 'jsonc'
  if (['.yaml', '.yml'].includes(ext)) return 'yaml'
  if (ext === '.toml') return 'toml'
  if (['.md', '.mdx'].includes(ext)) return 'markdown'
  if (ext === '.css') return 'css'
  if (['.html', '.htm'].includes(ext)) return 'html'
  return 'plaintext'
}

function offsetPosition(text: string, offset: number): TextPositionV1 {
  const boundedOffset = Math.max(0, Math.min(offset, text.length))
  let line = 0
  let lineStart = 0
  for (let index = 0; index < boundedOffset; index += 1) {
    if (text.charCodeAt(index) === 10) {
      line += 1
      lineStart = index + 1
    }
  }
  return { line, character: boundedOffset - lineStart }
}

function offsetRange(text: string, start: number, end: number): TextRangeV1 {
  return { start: offsetPosition(text, start), end: offsetPosition(text, end) }
}

let treeSitterReady: Promise<void> | undefined
const grammarCache = new Map<string, Promise<Language>>()

function packageFile(packageName: string, relative: string): string {
  const require = createRequire(import.meta.url)
  if (packageName === 'web-tree-sitter') return require.resolve(`web-tree-sitter/${relative}`)
  if (packageName === '@vscode/tree-sitter-wasm') return require.resolve(`@vscode/tree-sitter-wasm/${relative}`)
  return join(dirname(require.resolve(`${packageName}/package.json`)), relative)
}

async function loadGrammar(grammar: string): Promise<Language> {
  treeSitterReady ??= Parser.init({ locateFile: () => packageFile('web-tree-sitter', 'web-tree-sitter.wasm') })
  await treeSitterReady
  let cached = grammarCache.get(grammar)
  if (cached === undefined) {
    cached = Language.load(packageFile('@vscode/tree-sitter-wasm', `wasm/tree-sitter-${grammar}.wasm`))
    grammarCache.set(grammar, cached)
  }
  return cached
}

function nodeLabel(source: string, node: TreeSitterNode): string | undefined {
  const label = source.slice(node.startIndex, Math.min(node.endIndex, node.startIndex + 256)).replace(/\s+/g, ' ').trim()
  return label.length === 0 ? undefined : label.slice(0, MAX_LABEL)
}

async function treeSitterStructure(text: string, languageId: string, version: number): Promise<SyntaxTreeProjectionV1 | undefined> {
  const grammar = TREE_SITTER_GRAMMARS[languageId]
  if (grammar === undefined) return undefined
  let parser: Parser | undefined
  try {
    const language = await loadGrammar(grammar)
    parser = new Parser()
    parser.setLanguage(language)
    const tree = parser.parse(text)
    if (tree === null) return undefined
    const nodes: SyntaxNodeProjectionV1[] = []
    const visit = (node: TreeSitterNode, parentId: string | undefined, field: string | undefined, depth: number): void => {
      if (nodes.length >= MAX_AST_NODES || depth > MAX_AST_DEPTH) return
      const id = `n${nodes.length}`
      const label = nodeLabel(text, node)
      nodes.push({
        id,
        ...(parentId === undefined ? {} : { parentId }),
        ...(field === undefined ? {} : { field }),
        kind: node.type.slice(0, 120),
        range: {
          start: { line: node.startPosition.row, character: node.startPosition.column },
          end: { line: node.endPosition.row, character: node.endPosition.column },
        },
        depth,
        named: node.isNamed,
        error: node.isError || node.hasError,
        missing: node.isMissing,
        ...(label === undefined ? {} : { label }),
      })
      for (let index = 0; index < node.childCount && nodes.length < MAX_AST_NODES; index += 1) {
        const child = node.child(index)
        if (child === null || !child.isNamed) continue
        visit(child, id, node.fieldNameForChild(index) ?? undefined, depth + 1)
      }
    }
    visit(tree.rootNode, undefined, undefined, 0)
    const partial = nodes.length >= MAX_AST_NODES
    const result: SyntaxTreeProjectionV1 = {
      engine: 'tree-sitter',
      languageId,
      documentVersion: version,
      ...(nodes[0] === undefined ? {} : { rootId: nodes[0].id }),
      nodes,
      partial,
      ...(partial ? { reason: 'syntax tree exceeded the node budget' } : {}),
    }
    tree.delete()
    return result
  } catch {
    return undefined
  } finally {
    parser?.delete()
  }
}

function jsonNodes(text: string, languageId: string, version: number): SyntaxTreeProjectionV1 | undefined {
  const root = parseTree(text)
  if (root === undefined) return undefined
  const nodes: SyntaxNodeProjectionV1[] = []
  const visit = (node: JsonNode, parentId: string | undefined, field: string | undefined, depth: number): void => {
    if (nodes.length >= MAX_AST_NODES || depth > MAX_AST_DEPTH) return
    const id = `n${nodes.length}`
    const raw = text.slice(node.offset, node.offset + Math.min(node.length, 160)).replace(/\s+/g, ' ').trim()
    nodes.push({
      id,
      ...(parentId === undefined ? {} : { parentId }),
      ...(field === undefined ? {} : { field }),
      kind: node.type,
      range: offsetRange(text, node.offset, node.offset + node.length),
      depth,
      named: true,
      error: false,
      missing: false,
      ...(raw.length === 0 ? {} : { label: raw.slice(0, MAX_LABEL) }),
    })
    for (let index = 0; index < (node.children?.length ?? 0); index += 1) {
      visit(node.children![index]!, id, node.type === 'property' && index === 0 ? 'key' : node.type === 'property' ? 'value' : undefined, depth + 1)
    }
  }
  visit(root, undefined, undefined, 0)
  return {
    engine: 'jsonc-parser',
    languageId,
    documentVersion: version,
    ...(nodes[0] === undefined ? {} : { rootId: nodes[0].id }),
    nodes,
    partial: nodes.length >= MAX_AST_NODES,
  }
}

function markdownNodes(text: string, version: number): SyntaxTreeProjectionV1 {
  const root = fromMarkdown(text) as unknown as { type: string; position?: { start?: { offset?: number }; end?: { offset?: number } }; children?: unknown[] }
  const nodes: SyntaxNodeProjectionV1[] = []
  const visit = (node: typeof root, parentId: string | undefined, depth: number): void => {
    if (nodes.length >= MAX_AST_NODES || depth > MAX_AST_DEPTH) return
    const id = `n${nodes.length}`
    const start = node.position?.start?.offset ?? 0
    const end = node.position?.end?.offset ?? start
    const raw = text.slice(start, Math.min(end, start + 160)).replace(/\s+/g, ' ').trim()
    nodes.push({
      id,
      ...(parentId === undefined ? {} : { parentId }),
      kind: String(node.type).slice(0, 120),
      range: offsetRange(text, start, end),
      depth,
      named: true,
      error: false,
      missing: false,
      ...(raw.length === 0 ? {} : { label: raw.slice(0, MAX_LABEL) }),
    })
    for (const child of node.children ?? []) visit(child as typeof root, id, depth + 1)
  }
  visit(root, undefined, 0)
  return {
    engine: 'mdast',
    languageId: 'markdown',
    documentVersion: version,
    ...(nodes[0] === undefined ? {} : { rootId: nodes[0].id }),
    nodes,
    partial: nodes.length >= MAX_AST_NODES,
  }
}

function yamlNodes(text: string, version: number): SyntaxTreeProjectionV1 {
  const document = parseDocument(text, { keepSourceTokens: true })
  const nodes: SyntaxNodeProjectionV1[] = []
  const seen = new Set<unknown>()
  const visit = (value: unknown, parentId: string | undefined, field: string | undefined, depth: number): void => {
    if (value === null || typeof value !== 'object' || seen.has(value) || nodes.length >= MAX_AST_NODES || depth > MAX_AST_DEPTH) return
    seen.add(value)
    const record = value as { range?: readonly number[]; items?: readonly unknown[]; key?: unknown; value?: unknown; type?: unknown }
    const start = typeof record.range?.[0] === 'number' ? record.range[0] : 0
    const end = typeof record.range?.[1] === 'number' ? record.range[1] : start
    const id = `n${nodes.length}`
    const kind = typeof record.type === 'string' ? record.type : value.constructor?.name ?? 'yaml-node'
    const raw = text.slice(start, Math.min(end, start + 160)).replace(/\s+/g, ' ').trim()
    nodes.push({
      id,
      ...(parentId === undefined ? {} : { parentId }),
      ...(field === undefined ? {} : { field }),
      kind: kind.slice(0, 120),
      range: offsetRange(text, start, end),
      depth,
      named: true,
      error: false,
      missing: false,
      ...(raw.length === 0 ? {} : { label: raw.slice(0, MAX_LABEL) }),
    })
    if (record.key !== undefined) visit(record.key, id, 'key', depth + 1)
    if (record.value !== undefined) visit(record.value, id, 'value', depth + 1)
    for (const item of record.items ?? []) visit(item, id, undefined, depth + 1)
  }
  visit(document.contents, undefined, undefined, 0)
  return {
    engine: 'yaml',
    languageId: 'yaml',
    documentVersion: version,
    ...(nodes[0] === undefined ? {} : { rootId: nodes[0].id }),
    nodes,
    partial: nodes.length >= MAX_AST_NODES,
  }
}

function lineStructure(text: string, languageId: string, version: number): SyntaxTreeProjectionV1 {
  const nodes: SyntaxNodeProjectionV1[] = [{
    id: 'n0', kind: 'document', range: offsetRange(text, 0, text.length), depth: 0, named: true, error: false, missing: false,
  }]
  let offset = 0
  for (const [line, source] of text.split('\n').entries()) {
    if (nodes.length >= MAX_AST_NODES) break
    const trimmed = source.trim()
    const interesting = /^(?:export\s+)?(?:async\s+)?(?:class|interface|type|enum|function|def|fn|func|struct|trait|impl|module|package|const|let|var)\b|^\[[^\]]+\]|^[A-Za-z_][\w.-]*\s*=/.test(trimmed)
    if (interesting) {
      nodes.push({
        id: `n${nodes.length}`,
        parentId: 'n0',
        kind: trimmed.startsWith('[') ? 'section' : 'declaration',
        range: { start: { line, character: source.length - source.trimStart().length }, end: { line, character: source.length } },
        depth: 1,
        named: true,
        error: false,
        missing: false,
        label: trimmed.slice(0, MAX_LABEL),
      })
    }
    offset += source.length + 1
  }
  return { engine: 'bounded-structure', languageId, documentVersion: version, rootId: 'n0', nodes, partial: nodes.length >= MAX_AST_NODES }
}

async function projectStructure(text: string, languageId: string, version: number): Promise<SyntaxTreeProjectionV1> {
  const treeSitter = await treeSitterStructure(text, languageId, version)
  if (treeSitter !== undefined) return treeSitter
  if (languageId === 'json' || languageId === 'jsonc') return jsonNodes(text, languageId, version) ?? lineStructure(text, languageId, version)
  if (languageId === 'markdown') return markdownNodes(text, version)
  if (languageId === 'yaml') return yamlNodes(text, version)
  return lineStructure(text, languageId, version)
}

function providerOf(languageId: string, providers: readonly LanguageProviderV1[]): LanguageProviderV1 | undefined {
  return providers.find(provider => provider.languageIds.includes(languageId))
}

function featuresFromCapabilities(capabilities: Record<string, unknown> | undefined): LanguageFeatureV1[] {
  const features: LanguageFeatureV1[] = ['structure']
  if (capabilities === undefined) return features
  if (capabilities.semanticTokensProvider !== undefined) features.push('semanticTokens')
  if (capabilities.documentSymbolProvider !== undefined) features.push('symbols')
  if (capabilities.foldingRangeProvider !== undefined) features.push('foldingRanges')
  features.push('diagnostics')
  if (capabilities.hoverProvider !== undefined) features.push('hover')
  if (capabilities.completionProvider !== undefined) features.push('completion')
  if (capabilities.signatureHelpProvider !== undefined) features.push('signatureHelp')
  if (capabilities.definitionProvider !== undefined) features.push('definition')
  if (capabilities.referencesProvider !== undefined) features.push('references')
  if (capabilities.inlayHintProvider !== undefined) features.push('inlayHints')
  if (capabilities.documentFormattingProvider !== undefined) features.push('format')
  if (capabilities.renameProvider !== undefined) features.push('rename')
  if (capabilities.codeActionProvider !== undefined) features.push('codeActions')
  return features
}

class LspSession {
  private child: ChildProcessWithoutNullStreams | undefined
  private connection: MessageConnection | undefined
  private capabilities: Record<string, unknown> | undefined
  private semanticLegend: { tokenTypes: readonly string[]; tokenModifiers: readonly string[] } = { tokenTypes: [], tokenModifiers: [] }
  private readonly diagnosticsByUri = new Map<string, readonly LanguageDiagnosticV1[]>()
  private closed = false

  constructor(
    readonly provider: LanguageProviderV1,
    readonly workspacePath: string,
    private readonly initializeTimeoutMs: number,
    private readonly requestTimeoutMs: number,
    private readonly onExit: () => void,
  ) {}

  async start(): Promise<boolean> {
    if (this.connection !== undefined) return true
    if (this.closed) return false
    try {
      const child = spawn(this.provider.command, [...this.provider.args], {
        cwd: this.workspacePath,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          PATH: process.env.PATH,
          LANG: process.env.LANG ?? 'C.UTF-8',
          LC_ALL: process.env.LC_ALL ?? process.env.LANG ?? 'C.UTF-8',
          TMPDIR: process.env.TMPDIR,
        },
      })
      this.child = child
      child.on('error', () => {
        // Spawn and late stream failures are converted into AST-only fallback.
      })
      await new Promise<void>((resolveSpawn, rejectSpawn) => {
        child.once('spawn', resolveSpawn)
        child.once('error', rejectSpawn)
      })
      child.stderr.resume()
      const connection = createMessageConnection(new StreamMessageReader(child.stdout), new StreamMessageWriter(child.stdin))
      this.connection = connection
      connection.onNotification('textDocument/publishDiagnostics', params => {
        const record = params as { uri?: unknown; diagnostics?: unknown[] }
        if (typeof record.uri !== 'string' || !Array.isArray(record.diagnostics)) return
        this.diagnosticsByUri.set(record.uri, record.diagnostics.slice(0, MAX_DIAGNOSTICS).map(item => {
          const diagnostic = item as Record<string, unknown>
          const source = bounded(diagnostic.source, 80)
          return {
            range: normalizeRange(diagnostic.range),
            severity: severityOf(diagnostic.severity),
            message: bounded(diagnostic.message) ?? 'Language Server diagnostic',
            ...(source === undefined ? {} : { source }),
            ...(typeof diagnostic.code === 'string' || typeof diagnostic.code === 'number' ? { code: String(diagnostic.code).slice(0, 80) } : {}),
          }
        }))
      })
      connection.listen()
      const processFailure = new Promise<never>((_, reject) => {
        child.once('error', reject)
        child.once('exit', code => { reject(new Error(`language server exited before initialize (${code ?? 'signal'})`)) })
      })
      const initialized = await Promise.race([
        connection.sendRequest('initialize', {
          processId: process.pid,
          clientInfo: { name: 'yeisme-dsh-language-intelligence', version: '0.1.0-rc.1' },
          rootUri: pathToFileURL(this.workspacePath).href,
          workspaceFolders: [{ uri: pathToFileURL(this.workspacePath).href, name: basename(this.workspacePath) }],
          capabilities: {
            general: { positionEncodings: ['utf-16'] },
            textDocument: {
              synchronization: { didSave: true, dynamicRegistration: false },
              semanticTokens: { requests: { full: true, range: true }, tokenTypes: [], tokenModifiers: [], formats: ['relative'] },
              documentSymbol: { hierarchicalDocumentSymbolSupport: true },
              hover: { contentFormat: ['markdown', 'plaintext'] },
              completion: { completionItem: { documentationFormat: ['markdown', 'plaintext'], snippetSupport: false } },
            },
          },
          initializationOptions: {},
        }) as Promise<{ capabilities?: Record<string, unknown> }>,
        processFailure,
        new Promise<never>((_, reject) => setTimeout(() => { reject(new Error('language server initialize timeout')) }, this.initializeTimeoutMs)),
      ])
      this.capabilities = initialized.capabilities ?? {}
      const semantic = this.capabilities.semanticTokensProvider as { legend?: { tokenTypes?: string[]; tokenModifiers?: string[] } } | undefined
      this.semanticLegend = {
        tokenTypes: semantic?.legend?.tokenTypes ?? [],
        tokenModifiers: semantic?.legend?.tokenModifiers ?? [],
      }
      connection.sendNotification('initialized', {})
      child.once('exit', () => {
        this.closed = true
        this.connection?.dispose()
        this.connection = undefined
        this.child = undefined
        this.onExit()
      })
      return true
    } catch {
      this.dispose()
      return false
    }
  }

  get features(): readonly LanguageFeatureV1[] { return featuresFromCapabilities(this.capabilities) }
  get diagnostics(): ReadonlyMap<string, readonly LanguageDiagnosticV1[]> { return this.diagnosticsByUri }

  notify(method: string, params: unknown): void { this.connection?.sendNotification(method, params) }
  async request(method: string, params: unknown): Promise<unknown> {
    if (this.connection === undefined) return undefined
    const cancellation = new CancellationTokenSource()
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        this.connection.sendRequest(method, params, cancellation.token),
        new Promise<undefined>(resolveTimeout => {
          timeout = setTimeout(() => { cancellation.cancel(); resolveTimeout(undefined) }, this.requestTimeoutMs)
        }),
      ])
    } catch {
      return undefined
    } finally {
      if (timeout !== undefined) clearTimeout(timeout)
      cancellation.dispose()
    }
  }

  decodeSemanticTokens(value: unknown): readonly SemanticTokenV1[] {
    const data = (value as { data?: unknown })?.data
    if (!Array.isArray(data)) return []
    const tokens: SemanticTokenV1[] = []
    let line = 0
    let character = 0
    for (let index = 0; index + 4 < data.length && tokens.length < 20_000; index += 5) {
      const deltaLine = Number(data[index])
      const deltaStart = Number(data[index + 1])
      const length = Number(data[index + 2])
      const typeIndex = Number(data[index + 3])
      const modifierBits = Number(data[index + 4])
      if (![deltaLine, deltaStart, length, typeIndex, modifierBits].every(Number.isFinite)) continue
      line += deltaLine
      character = deltaLine === 0 ? character + deltaStart : deltaStart
      const modifiers = this.semanticLegend.tokenModifiers.filter((_, bit) => (modifierBits & (1 << bit)) !== 0)
      tokens.push({ line, character, length, tokenType: this.semanticLegend.tokenTypes[typeIndex] ?? 'variable', modifiers })
    }
    return tokens
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    const connection = this.connection
    const child = this.child
    this.connection = undefined
    this.child = undefined
    if (connection === undefined || child === undefined) {
      child?.kill()
      return
    }
    void Promise.race([
      connection.sendRequest('shutdown').catch(() => undefined),
      new Promise<void>(resolveTimeout => setTimeout(resolveTimeout, 250)),
    ]).finally(() => {
      try { connection.sendNotification('exit') } catch {}
      setTimeout(() => {
        connection.dispose()
        child.kill()
      }, 25)
    })
  }
}

interface OpenDocumentRecord {
  readonly handleId: string
  readonly sessionId: string
  readonly ref: string
  readonly title: string
  readonly path: string
  readonly workspacePath: string
  readonly uri: string
  readonly modelUri: string
  readonly languageId: string
  readOnly: boolean
  truncated: boolean
  fileVersion: string
  documentVersion: number
  text: string
  lsp?: LspSession
  structure: SyntaxTreeProjectionV1 | undefined
}

function symbolOf(value: unknown, depth = 0): DocumentSymbolV1 | undefined {
  if (depth > 20 || typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  const name = bounded(record.name, 240)
  if (name === undefined) return undefined
  const children = Array.isArray(record.children)
    ? record.children.slice(0, MAX_SYMBOLS).flatMap(child => {
        const projected = symbolOf(child, depth + 1)
        return projected === undefined ? [] : [projected]
      })
    : undefined
  const detail = bounded(record.detail, 500)
  const locationRange = typeof record.location === 'object' && record.location !== null
    ? (record.location as Record<string, unknown>).range
    : undefined
  return {
    name,
    ...(detail === undefined ? {} : { detail }),
    kind: typeof record.kind === 'number' ? record.kind : 13,
    range: normalizeRange(record.range ?? locationRange),
    selectionRange: normalizeRange(record.selectionRange ?? record.range ?? locationRange),
    ...(children === undefined || children.length === 0 ? {} : { children }),
  }
}

function hoverMarkdown(value: unknown): HoverProjectionV1 | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const record = value as Record<string, unknown>
  const contents = record.contents
  let markdown: string | undefined
  if (typeof contents === 'string') markdown = contents
  else if (Array.isArray(contents)) markdown = contents.map(item => typeof item === 'string' ? item : bounded((item as Record<string, unknown>)?.value)).filter(Boolean).join('\n\n')
  else if (typeof contents === 'object' && contents !== null) markdown = bounded((contents as Record<string, unknown>).value)
  if (markdown === undefined || markdown.length === 0) return undefined
  return { markdown: markdown.slice(0, 8_000), ...(record.range === undefined ? {} : { range: normalizeRange(record.range) }) }
}

function completionItems(value: unknown): readonly CompletionItemProjectionV1[] {
  const items = Array.isArray(value) ? value : Array.isArray((value as { items?: unknown })?.items) ? (value as { items: unknown[] }).items : []
  return items.slice(0, MAX_COMPLETIONS).flatMap(item => {
    if (typeof item !== 'object' || item === null) return []
    const record = item as Record<string, unknown>
    const label = bounded(record.label, 240)
    if (label === undefined) return []
    const documentation = typeof record.documentation === 'string'
      ? record.documentation
      : bounded((record.documentation as Record<string, unknown> | undefined)?.value)
    const detail = bounded(record.detail, 500)
    const insertText = bounded(record.insertText, 4_000)
    const sortText = bounded(record.sortText, 240)
    return [{
      label,
      ...(detail === undefined ? {} : { detail }),
      ...(documentation === undefined ? {} : { documentation: documentation.slice(0, 4_000) }),
      ...(insertText === undefined ? {} : { insertText }),
      ...(sortText === undefined ? {} : { sortText }),
      ...(typeof record.kind === 'number' ? { kind: record.kind } : {}),
    }]
  })
}

export class NodeLanguageIntelligenceHost implements LanguageIntelligenceHostV1 {
  readonly version = '0.1.0-rc.1' as const
  readonly capability = LANGUAGE_INTELLIGENCE_CAPABILITY
  private readonly documents = new Map<string, OpenDocumentRecord>()
  private readonly sessions = new Map<string, Promise<LspSession | undefined>>()

  private readonly providers: readonly LanguageProviderV1[]
  private readonly initializeTimeoutMs: number
  private readonly requestTimeoutMs: number

  constructor(private readonly source: NodeLanguageDocumentSourceV1, options: NodeLanguageIntelligenceOptionsV1 = {}) {
    this.providers = options.providers ?? DEFAULT_PROVIDERS
    this.initializeTimeoutMs = Math.max(250, Math.min(30_000, options.initializeTimeoutMs ?? 3_000))
    this.requestTimeoutMs = Math.max(25, Math.min(60_000, options.requestTimeoutMs ?? 5_000))
  }

  private async lspFor(languageId: string, workspacePath: string): Promise<LspSession | undefined> {
    const provider = providerOf(languageId, this.providers)
    if (provider === undefined) return undefined
    const key = `${workspacePath}\0${provider.id}`
    let pending = this.sessions.get(key)
    if (pending === undefined) {
      pending = (async () => {
        const session = new LspSession(provider, workspacePath, this.initializeTimeoutMs, this.requestTimeoutMs, () => { this.sessions.delete(key) })
        return await session.start() ? session : undefined
      })()
      this.sessions.set(key, pending)
    }
    const session = await pending
    if (session === undefined) this.sessions.delete(key)
    return session
  }

  async probe(input: LanguageDocumentRefV1): Promise<LanguageCapabilitySnapshotV1> {
    try {
      const document = await this.source.resolve(input)
      const languageId = languageIdOf(document.path)
      if (document.truncated || Buffer.byteLength(document.text, 'utf8') > MAX_DOCUMENT_BYTES) {
        return { capability: this.capability, engine: 'source-only', languageId, features: [], reason: 'document is truncated or exceeds the semantic budget' }
      }
      const parserAvailable = TREE_SITTER_GRAMMARS[languageId] !== undefined || ['json', 'jsonc', 'yaml', 'toml', 'markdown'].includes(languageId)
      return {
        capability: this.capability,
        engine: parserAvailable ? 'ast-only' : 'source-only',
        languageId,
        features: parserAvailable ? ['structure'] : [],
        reason: parserAvailable ? 'AST provider available; Language Server starts lazily on open' : 'no AST provider for this language',
      }
    } catch {
      return { capability: this.capability, engine: 'unavailable', languageId: 'plaintext', features: [], reason: 'opaque file reference is unavailable' }
    }
  }

  async open(input: LanguageDocumentRefV1): Promise<LanguageDocumentSnapshotV1> {
    const document = await this.source.resolve(input)
    const languageId = languageIdOf(document.path)
    const handleId = randomUUID()
    const modelUri = `dsh-resource://model/${handleId}`
    const uri = pathToFileURL(document.path).href
    const semanticAllowed = !document.truncated && Buffer.byteLength(document.text, 'utf8') <= MAX_DOCUMENT_BYTES
    const lsp = semanticAllowed ? await this.lspFor(languageId, document.workspacePath) : undefined
    const record: OpenDocumentRecord = {
      handleId,
      sessionId: input.sessionId,
      ref: input.ref,
      title: document.title,
      path: document.path,
      workspacePath: document.workspacePath,
      uri,
      modelUri,
      languageId,
      readOnly: document.readOnly,
      truncated: document.truncated,
      fileVersion: document.version,
      documentVersion: 1,
      text: document.text,
      structure: undefined,
      ...(lsp === undefined ? {} : { lsp }),
    }
    this.documents.set(handleId, record)
    lsp?.notify('textDocument/didOpen', { textDocument: { uri, languageId, version: 1, text: document.text } })
    const parserAvailable = semanticAllowed && (TREE_SITTER_GRAMMARS[languageId] !== undefined || ['json', 'jsonc', 'yaml', 'toml', 'markdown'].includes(languageId))
    const features = lsp?.features ?? (parserAvailable ? ['structure'] as const : [])
    return {
      capability: this.capability,
      engine: lsp !== undefined ? 'lsp+ast' : parserAvailable ? 'ast-only' : 'source-only',
      languageId,
      features,
      reason: lsp !== undefined ? `Language Server ${lsp.provider.id} connected` : parserAvailable ? 'Language Server unavailable; AST fallback active' : 'source-only fallback active',
      handleId,
      modelUri,
      title: document.title,
      text: document.text,
      truncated: document.truncated,
      readOnly: document.readOnly,
      fileVersion: document.version,
      documentVersion: 1,
    }
  }

  async change(input: LanguageDocumentChangeV1): Promise<{ readonly accepted: boolean; readonly documentVersion: number }> {
    const document = this.documents.get(input.handleId)
    if (document === undefined || input.documentVersion <= document.documentVersion || Buffer.byteLength(input.text, 'utf8') > MAX_DOCUMENT_BYTES) {
      return { accepted: false, documentVersion: document?.documentVersion ?? 0 }
    }
    document.text = input.text
    document.documentVersion = input.documentVersion
    document.structure = undefined
    document.lsp?.notify('textDocument/didChange', {
      textDocument: { uri: document.uri, version: document.documentVersion },
      contentChanges: [{ text: document.text }],
    })
    return { accepted: true, documentVersion: document.documentVersion }
  }

  async query(handleId: string, documentVersion: number, query: LanguageQueryV1): Promise<LanguageQueryResultV1> {
    const document = this.documents.get(handleId)
    if (document === undefined) throw new Error('language document handle is closed')
    if (document.documentVersion !== documentVersion) throw new Error('language document version is stale')
    if (query.kind === 'structure') {
      document.structure ??= await projectStructure(document.text, document.languageId, document.documentVersion)
      return { kind: 'structure', value: document.structure }
    }
    if (query.kind === 'diagnostics') return { kind: 'diagnostics', value: document.lsp?.diagnostics.get(document.uri) ?? [] }
    if (query.kind === 'symbols') {
      const value = await document.lsp?.request('textDocument/documentSymbol', { textDocument: { uri: document.uri } })
      const rows = Array.isArray(value) ? value : []
      return { kind: 'symbols', value: rows.slice(0, MAX_SYMBOLS).flatMap(row => {
        const symbol = symbolOf(row)
        return symbol === undefined ? [] : [symbol]
      }) }
    }
    if (query.kind === 'semanticTokens') {
      const value = await document.lsp?.request('textDocument/semanticTokens/full', { textDocument: { uri: document.uri } })
      return { kind: 'semanticTokens', value: document.lsp?.decodeSemanticTokens(value) ?? [] }
    }
    if (query.kind === 'hover') {
      const value = await document.lsp?.request('textDocument/hover', { textDocument: { uri: document.uri }, position: query.position })
      const hover = hoverMarkdown(value)
      return hover === undefined ? { kind: 'hover' } : { kind: 'hover', value: hover }
    }
    if (query.kind === 'completion') {
      const value = await document.lsp?.request('textDocument/completion', { textDocument: { uri: document.uri }, position: query.position, context: { triggerKind: 1 } })
      return { kind: 'completion', value: completionItems(value) }
    }
    if (query.kind === 'definition' || query.kind === 'references') {
      const method = query.kind === 'definition' ? 'textDocument/definition' : 'textDocument/references'
      const value = await document.lsp?.request(method, {
        textDocument: { uri: document.uri },
        position: query.position,
        ...(query.kind === 'references' ? { context: { includeDeclaration: true } } : {}),
      })
      const rows = Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]
      const targets: LanguageTargetV1[] = []
      for (const row of rows.slice(0, 500)) {
        const location = row as { uri?: unknown; targetUri?: unknown; range?: unknown; targetSelectionRange?: unknown }
        const uri = typeof location.uri === 'string' ? location.uri : typeof location.targetUri === 'string' ? location.targetUri : undefined
        if (uri === undefined) continue
        const target = await this.source.resolveTarget(document.sessionId, uri)
        if (target === undefined) continue
        targets.push({ ref: target.ref, range: normalizeRange(location.range ?? location.targetSelectionRange) })
      }
      return { kind: query.kind, value: targets }
    }
    if (query.kind === 'format') {
      const edits = await document.lsp?.request('textDocument/formatting', {
        textDocument: { uri: document.uri },
        options: { tabSize: Math.max(1, Math.min(16, query.tabSize)), insertSpaces: query.insertSpaces },
      })
      return { kind: 'workspaceEdit', value: this.currentDocumentEdit(document, 'Format document', 'format', edits) }
    }
    if (query.kind === 'codeAction') {
      const value = await document.lsp?.request('textDocument/codeAction', {
        textDocument: { uri: document.uri },
        range: query.range,
        context: { diagnostics: document.lsp?.diagnostics.get(document.uri) ?? [] },
      })
      const actions = Array.isArray(value) ? value : []
      const action = actions.find(item => typeof item === 'object' && item !== null && (item as Record<string, unknown>).edit !== undefined) as Record<string, unknown> | undefined
      if (action === undefined) return { kind: 'workspaceEdit', value: { title: 'Code action', kind: 'codeAction', files: [], rejectedReason: 'Language Server returned no edit-only code action' } }
      return { kind: 'workspaceEdit', value: await this.workspaceEdit(document, `Code action: ${bounded(action.title, 160) ?? 'Apply fix'}`, 'codeAction', action.edit) }
    }
    const rename = await document.lsp?.request('textDocument/rename', {
      textDocument: { uri: document.uri }, position: query.position, newName: query.newName.slice(0, 240),
    })
    return { kind: 'workspaceEdit', value: await this.workspaceEdit(document, 'Rename symbol', 'rename', rename) }
  }

  private currentDocumentEdit(document: OpenDocumentRecord, title: string, kind: WorkspaceTextEditDraftV1['kind'], value: unknown): WorkspaceTextEditDraftV1 {
    const edits = Array.isArray(value) ? value : []
    const file: WorkspaceTextEditV1 = {
      ref: document.ref,
      expectedVersion: document.fileVersion,
      edits: edits.slice(0, 5_000).flatMap(item => {
        if (typeof item !== 'object' || item === null || typeof (item as Record<string, unknown>).newText !== 'string') return []
        return [{ range: normalizeRange((item as Record<string, unknown>).range), newText: String((item as Record<string, unknown>).newText).slice(0, MAX_DOCUMENT_BYTES) }]
      }),
    }
    return { title, kind, files: [file] }
  }

  private async workspaceEdit(document: OpenDocumentRecord, title: string, kind: WorkspaceTextEditDraftV1['kind'], value: unknown): Promise<WorkspaceTextEditDraftV1> {
    if (typeof value !== 'object' || value === null) return { title, kind, files: [], rejectedReason: 'Language Server returned no workspace edit' }
    const record = value as { changes?: unknown; documentChanges?: unknown }
    if (record.documentChanges !== undefined) return { title, kind, files: [], rejectedReason: 'resource/document operations are unsupported in V1' }
    if (typeof record.changes !== 'object' || record.changes === null) return { title, kind, files: [], rejectedReason: 'Language Server returned no bounded text changes' }
    const files: WorkspaceTextEditV1[] = []
    for (const [uri, rawEdits] of Object.entries(record.changes as Record<string, unknown>)) {
      if (!Array.isArray(rawEdits)) continue
      const target = await this.source.resolveTarget(document.sessionId, uri)
      if (target === undefined) return { title, kind, files: [], rejectedReason: 'workspace edit targets an unauthorized resource' }
      files.push({
        ref: target.ref,
        ...(target.version === undefined ? {} : { expectedVersion: target.version }),
        edits: rawEdits.slice(0, 5_000).flatMap(item => {
          if (typeof item !== 'object' || item === null || typeof (item as Record<string, unknown>).newText !== 'string') return []
          return [{ range: normalizeRange((item as Record<string, unknown>).range), newText: String((item as Record<string, unknown>).newText).slice(0, MAX_DOCUMENT_BYTES) }]
        }),
      })
    }
    return { title, kind, files }
  }

  async didSave(handleId: string, fileVersion: string): Promise<void> {
    const document = this.documents.get(handleId)
    if (document === undefined) return
    document.fileVersion = fileVersion
    document.lsp?.notify('textDocument/didSave', { textDocument: { uri: document.uri }, text: document.text })
  }

  async close(handleId: string): Promise<void> {
    const document = this.documents.get(handleId)
    if (document === undefined) return
    this.documents.delete(handleId)
    document.lsp?.notify('textDocument/didClose', { textDocument: { uri: document.uri } })
  }

  dispose(): void {
    for (const document of this.documents.values()) document.lsp?.notify('textDocument/didClose', { textDocument: { uri: document.uri } })
    this.documents.clear()
    for (const pending of this.sessions.values()) void pending.then(session => { session?.dispose() })
    this.sessions.clear()
  }
}

export function createNodeLanguageIntelligenceHost(source: NodeLanguageDocumentSourceV1, options?: NodeLanguageIntelligenceOptionsV1): NodeLanguageIntelligenceHost {
  return new NodeLanguageIntelligenceHost(source, options)
}
