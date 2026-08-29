import { createMessageConnection, StreamMessageReader, StreamMessageWriter } from 'vscode-jsonrpc/node'

const mode = process.argv[2] ?? 'normal'
const connection = createMessageConnection(new StreamMessageReader(process.stdin), new StreamMessageWriter(process.stdout))
const documents = new Map()

connection.onRequest('initialize', () => {
  if (mode === 'crash') setTimeout(() => { process.exit(23) }, 80)
  return {
    capabilities: {
      textDocumentSync: 1,
      documentSymbolProvider: true,
      semanticTokensProvider: { legend: { tokenTypes: ['variable', 'function'], tokenModifiers: ['declaration'] }, full: true },
      hoverProvider: true,
      completionProvider: {},
      definitionProvider: true,
      referencesProvider: true,
      documentFormattingProvider: true,
      renameProvider: true,
      codeActionProvider: true,
    },
  }
})

connection.onNotification('textDocument/didOpen', params => {
  documents.set(params.textDocument.uri, params.textDocument)
  connection.sendNotification('textDocument/publishDiagnostics', {
    uri: params.textDocument.uri,
    diagnostics: [{ range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } }, severity: 2, source: 'fake-lsp', message: 'fixture warning' }],
  })
})
connection.onNotification('textDocument/didChange', params => {
  const current = documents.get(params.textDocument.uri)
  if (current !== undefined) documents.set(params.textDocument.uri, { ...current, version: params.textDocument.version, text: params.contentChanges[0]?.text ?? current.text })
})
connection.onNotification('textDocument/didClose', params => { documents.delete(params.textDocument.uri) })

connection.onRequest('textDocument/documentSymbol', () => [{
  name: 'emoji', kind: 13,
  range: { start: { line: 0, character: 0 }, end: { line: 0, character: 18 } },
  selectionRange: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } },
}])
connection.onRequest('textDocument/semanticTokens/full', () => ({ data: [0, 6, 5, 0, 1] }))
connection.onRequest('textDocument/hover', async () => {
  if (mode === 'slow') await new Promise(resolve => setTimeout(resolve, 300))
  return { contents: { kind: 'markdown', value: '**emoji** fixture hover' } }
})
connection.onRequest('textDocument/completion', () => ({ items: [{ label: 'emoji', detail: 'fixture completion', kind: 6 }] }))
connection.onRequest('textDocument/definition', params => ({ uri: params.textDocument.uri, range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } } }))
connection.onRequest('textDocument/references', params => [{ uri: params.textDocument.uri, range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } } }])
connection.onRequest('textDocument/formatting', () => [{ range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } }, newText: '// formatted\n' }])
connection.onRequest('textDocument/rename', params => mode === 'resource-op'
  ? { documentChanges: [{ kind: 'create', uri: 'file:///outside/generated.ts' }] }
  : { changes: { [params.textDocument.uri]: [{ range: { start: { line: 0, character: 6 }, end: { line: 0, character: 11 } }, newText: params.newName }] } })
connection.onRequest('textDocument/codeAction', params => [{ title: 'Use fixture value', kind: 'quickfix', edit: { changes: { [params.textDocument.uri]: [{ range: params.range, newText: 'fixture' }] } } }])
connection.onRequest('shutdown', () => null)
connection.onNotification('exit', () => { process.exit(0) })
connection.listen()
