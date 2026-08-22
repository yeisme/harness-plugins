/**
 * Composed Workbench registry.
 *
 * Registers the Rich Media, File/Document, and Terminal modules into one
 * Workbench Core registry. The compose package does not own domain state; it
 * only wires modules into a shared shell.
 *
 * @module @yeisme/dsh-workbench-compose
 */

import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { richMediaWorkbenchModule } from '@yeisme/dsh-rich-media'
import { fileDocumentModule } from '@yeisme/dsh-file-document'
import { terminalModule } from '@yeisme/dsh-terminal'

export function createComposedWorkbenchRegistry(): WorkbenchRegistry {
  const registry = new WorkbenchRegistry()
  registry.register(richMediaWorkbenchModule)
  registry.register(fileDocumentModule)
  registry.register(terminalModule)
  return registry
}
