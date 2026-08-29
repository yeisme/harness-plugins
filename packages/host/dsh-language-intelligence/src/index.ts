/**
 * Pre-1.0 safe language intelligence contracts.
 *
 * Browser consumers receive opaque refs, host-issued model URIs and bounded
 * projections only. Raw LSP payloads, filesystem paths and server commands are
 * intentionally absent from this surface.
 */

export const LANGUAGE_INTELLIGENCE_CONTEXT_KEY = 'dsh.languageIntelligence' as const
export const LANGUAGE_INTELLIGENCE_CAPABILITY = 'LanguageIntelligenceHostV1' as const

export type LanguageEngineState = 'lsp+ast' | 'ast-only' | 'source-only' | 'unavailable'

export interface TextPositionV1 {
  readonly line: number
  readonly character: number
}

export interface TextRangeV1 {
  readonly start: TextPositionV1
  readonly end: TextPositionV1
}

export interface LanguageDocumentRefV1 {
  readonly sessionId: string
  readonly ref: string
}

export type LanguageFeatureV1 =
  | 'semanticTokens'
  | 'symbols'
  | 'foldingRanges'
  | 'diagnostics'
  | 'hover'
  | 'completion'
  | 'signatureHelp'
  | 'definition'
  | 'references'
  | 'inlayHints'
  | 'format'
  | 'rename'
  | 'codeActions'
  | 'structure'

export interface LanguageCapabilitySnapshotV1 {
  readonly capability: typeof LANGUAGE_INTELLIGENCE_CAPABILITY
  readonly engine: LanguageEngineState
  readonly languageId: string
  readonly features: readonly LanguageFeatureV1[]
  readonly reason: string
}

export interface LanguageDocumentSnapshotV1 extends LanguageCapabilitySnapshotV1 {
  readonly handleId: string
  /** Host-issued opaque URI used only as a Monaco model identity. */
  readonly modelUri: string
  readonly title: string
  readonly text: string
  readonly truncated: boolean
  readonly readOnly: boolean
  readonly fileVersion: string
  readonly documentVersion: number
}

export interface LanguageDocumentChangeV1 {
  readonly handleId: string
  readonly documentVersion: number
  readonly text: string
}

export interface SyntaxNodeProjectionV1 {
  readonly id: string
  readonly parentId?: string
  readonly kind: string
  readonly field?: string
  readonly range: TextRangeV1
  readonly depth: number
  readonly named: boolean
  readonly error: boolean
  readonly missing: boolean
  readonly label?: string
}

export interface SyntaxTreeProjectionV1 {
  readonly engine: string
  readonly languageId: string
  readonly documentVersion: number
  readonly rootId?: string
  readonly nodes: readonly SyntaxNodeProjectionV1[]
  readonly partial: boolean
  readonly reason?: string
}

export type DiagnosticSeverityV1 = 'error' | 'warning' | 'information' | 'hint'

export interface LanguageDiagnosticV1 {
  readonly range: TextRangeV1
  readonly severity: DiagnosticSeverityV1
  readonly message: string
  readonly source?: string
  readonly code?: string
}

export interface DocumentSymbolV1 {
  readonly name: string
  readonly detail?: string
  readonly kind: number
  readonly range: TextRangeV1
  readonly selectionRange: TextRangeV1
  readonly children?: readonly DocumentSymbolV1[]
}

export interface SemanticTokenV1 {
  readonly line: number
  readonly character: number
  readonly length: number
  readonly tokenType: string
  readonly modifiers: readonly string[]
}

export interface HoverProjectionV1 {
  readonly markdown: string
  readonly range?: TextRangeV1
}

export interface CompletionItemProjectionV1 {
  readonly label: string
  readonly detail?: string
  readonly documentation?: string
  readonly insertText?: string
  readonly sortText?: string
  readonly kind?: number
}

export interface LanguageTargetV1 {
  readonly ref: string
  readonly range: TextRangeV1
}

export interface WorkspaceTextEditV1 {
  readonly ref: string
  readonly expectedVersion?: string
  readonly edits: readonly { readonly range: TextRangeV1; readonly newText: string }[]
}

export interface WorkspaceTextEditDraftV1 {
  readonly title: string
  readonly kind: 'format' | 'rename' | 'codeAction'
  readonly files: readonly WorkspaceTextEditV1[]
  readonly rejectedReason?: string
}

export type LanguageQueryV1 =
  | { readonly kind: 'structure' }
  | { readonly kind: 'diagnostics' }
  | { readonly kind: 'symbols' }
  | { readonly kind: 'semanticTokens' }
  | { readonly kind: 'hover'; readonly position: TextPositionV1 }
  | { readonly kind: 'completion'; readonly position: TextPositionV1 }
  | { readonly kind: 'definition'; readonly position: TextPositionV1 }
  | { readonly kind: 'references'; readonly position: TextPositionV1 }
  | { readonly kind: 'format'; readonly tabSize: number; readonly insertSpaces: boolean }
  | { readonly kind: 'rename'; readonly position: TextPositionV1; readonly newName: string }
  | { readonly kind: 'codeAction'; readonly range: TextRangeV1 }

export type LanguageQueryResultV1 =
  | { readonly kind: 'structure'; readonly value: SyntaxTreeProjectionV1 }
  | { readonly kind: 'diagnostics'; readonly value: readonly LanguageDiagnosticV1[] }
  | { readonly kind: 'symbols'; readonly value: readonly DocumentSymbolV1[] }
  | { readonly kind: 'semanticTokens'; readonly value: readonly SemanticTokenV1[] }
  | { readonly kind: 'hover'; readonly value?: HoverProjectionV1 }
  | { readonly kind: 'completion'; readonly value: readonly CompletionItemProjectionV1[] }
  | { readonly kind: 'definition' | 'references'; readonly value: readonly LanguageTargetV1[] }
  | { readonly kind: 'workspaceEdit'; readonly value: WorkspaceTextEditDraftV1 }

export interface LanguageIntelligenceHostV1 {
  readonly version: '0.1.0-rc.1'
  readonly capability: typeof LANGUAGE_INTELLIGENCE_CAPABILITY
  probe(input: LanguageDocumentRefV1): Promise<LanguageCapabilitySnapshotV1>
  open(input: LanguageDocumentRefV1): Promise<LanguageDocumentSnapshotV1>
  change(input: LanguageDocumentChangeV1): Promise<{ readonly accepted: boolean; readonly documentVersion: number }>
  query(handleId: string, documentVersion: number, query: LanguageQueryV1): Promise<LanguageQueryResultV1>
  didSave(handleId: string, fileVersion: string): Promise<void>
  close(handleId: string): Promise<void>
}

export function isLanguageIntelligenceHostV1(value: unknown): value is LanguageIntelligenceHostV1 {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<LanguageIntelligenceHostV1>
  return candidate.version === '0.1.0-rc.1'
    && candidate.capability === LANGUAGE_INTELLIGENCE_CAPABILITY
    && typeof candidate.probe === 'function'
    && typeof candidate.open === 'function'
    && typeof candidate.change === 'function'
    && typeof candidate.query === 'function'
    && typeof candidate.close === 'function'
}
