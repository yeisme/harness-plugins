import {
  LANGUAGE_INTELLIGENCE_CAPABILITY,
  type LanguageDocumentChangeV1,
  type LanguageDocumentRefV1,
  type LanguageIntelligenceHostV1,
  type LanguageQueryResultV1,
  type LanguageQueryV1,
} from '@yeisme/dsh-language-intelligence-host'
import type { FileWorkspaceEditPreviewV1, FileWorkspaceEditReceiptV1 } from '@yeisme/dsh-file-host'
import type { WorkspaceTextEditDraftV1 } from '@yeisme/dsh-language-intelligence-host'

interface SemanticApiEnvelope<T> {
  readonly ok: boolean
  readonly value?: T
  readonly error?: { readonly message?: string }
}

export interface RemoteLanguageIntelligenceOptions {
  readonly baseUrl?: string
  readonly fetcher?: typeof fetch
}

export interface SemanticWorkspaceEditHostV1 {
  preview(sessionId: string, draft: WorkspaceTextEditDraftV1): Promise<FileWorkspaceEditPreviewV1>
  apply(sessionId: string, previewId: string): Promise<FileWorkspaceEditReceiptV1>
}

/** Same-origin browser facade. It never sends a filesystem path or server command. */
export function createRemoteLanguageIntelligenceHost(options: RemoteLanguageIntelligenceOptions = {}): LanguageIntelligenceHostV1 {
  const baseUrl = (options.baseUrl ?? '/yeisme-language/api').replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch
  const call = async <T>(method: string, body: unknown): Promise<T> => {
    const response = await fetcher(`${baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await response.json() as SemanticApiEnvelope<T>
    if (!response.ok || payload.ok !== true || !('value' in payload)) {
      throw new Error(payload.error?.message ?? 'semantic file capability is unavailable')
    }
    return payload.value as T
  }
  return {
    version: '0.1.0-rc.1',
    capability: LANGUAGE_INTELLIGENCE_CAPABILITY,
    probe: input => call('probe', input),
    open: input => call('open', input),
    change: input => call('change', input),
    query: (handleId: string, documentVersion: number, query: LanguageQueryV1): Promise<LanguageQueryResultV1> => call('query', { handleId, documentVersion, query }),
    didSave: async (handleId, fileVersion) => { await call<null>('didSave', { handleId, fileVersion }) },
    close: async handleId => { await call<null>('close', { handleId }) },
  }
}

export function createRemoteSemanticWorkspaceEditHost(options: RemoteLanguageIntelligenceOptions = {}): SemanticWorkspaceEditHostV1 {
  const baseUrl = (options.baseUrl ?? '/yeisme-language/api').replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch
  const call = async <T>(method: string, body: unknown): Promise<T> => {
    const response = await fetcher(`${baseUrl}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const payload = await response.json() as SemanticApiEnvelope<T>
    if (!response.ok || payload.ok !== true || !('value' in payload)) throw new Error(payload.error?.message ?? 'workspace edit capability is unavailable')
    return payload.value as T
  }
  return {
    preview: (sessionId, draft) => call('workspaceEditPreview', { sessionId, draft }),
    apply: (sessionId, previewId) => call('workspaceEditApply', { sessionId, previewId }),
  }
}

export type { LanguageDocumentChangeV1, LanguageDocumentRefV1 }
