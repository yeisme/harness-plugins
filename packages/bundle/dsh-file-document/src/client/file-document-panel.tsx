/**
 * File/Document Workbench panel placeholder.
 *
 * This panel is a minimal Workbench Core module view. It renders a safe
 * placeholder until the DSH fs/owner seam is connected.
 *
 * @module @yeisme/dsh-file-document/client
 */

export interface FileDocumentPanelProps {
  tabId: 'files' | 'documents'
}

export function FileDocumentPanel({ tabId }: FileDocumentPanelProps) {
  return (
    <section aria-label={tabId} data-dsh-file-document-panel>
      <h3>{tabId === 'files' ? 'File Explorer' : 'Document Preview'}</h3>
      <p>Workbench Core module placeholder. The canonical file tree and document extraction stay with DSH/domain owners.</p>
    </section>
  )
}

export default FileDocumentPanel
