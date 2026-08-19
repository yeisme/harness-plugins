/**
 * File/Document Workbench module.
 *
 * This module demonstrates Workbench Core extensibility: it registers a File
 * tab and a Document tab without owning filesystem state. The real file tree,
 * watcher, and document extraction remain with DSH/domain owners.
 *
 * @module @yeisme/dsh-file-document/module
 */

import type { WorkbenchModuleDefinitionV1 } from '@yeisme/dsh-workbench-core'

export const fileDocumentModule: WorkbenchModuleDefinitionV1 = {
  id: 'dsh-file-document',
  version: '0.1.0-rc.1',
  title: 'File & Document',
  description: 'File tree, document preview, and text extraction workbench module',
  requiredCapabilities: [],
  tabs: [
    { id: 'files', moduleId: 'dsh-file-document', title: '文件', order: 100, closable: true, scope: 'session-maybe' },
    { id: 'documents', moduleId: 'dsh-file-document', title: '文档', order: 110, closable: true, scope: 'session-maybe' },
  ],
  commands: [
    { id: 'file.open', moduleId: 'dsh-file-document', title: '打开文件' },
    { id: 'document.extract', moduleId: 'dsh-file-document', title: '提取文档文本' },
  ],
}
