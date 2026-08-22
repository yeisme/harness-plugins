/**
 * Desktop Workbench composed registry.
 *
 * Registers all desktop workbench modules into one Workbench Core registry:
 * desktop shell, file/document, terminal, and rich media. Domain state stays
 * with DSH/domain owners.
 *
 * @module @yeisme/dsh-desktop-workbench/composed-registry
 */

import { WorkbenchRegistry } from '@yeisme/dsh-workbench-core'
import { desktopWorkbenchModule } from '@yeisme/dsh-client-ui-desktop-workbench'
import { fileDocumentModule } from '@yeisme/dsh-file-document'
import { terminalModule } from '@yeisme/dsh-terminal'
import { richMediaWorkbenchModule } from '@yeisme/dsh-rich-media'

export function createDesktopWorkbenchRegistry(): WorkbenchRegistry {
  const registry = new WorkbenchRegistry()
  registry.register(desktopWorkbenchModule)
  registry.register(fileDocumentModule)
  registry.register(terminalModule)
  registry.register(richMediaWorkbenchModule)
  return registry
}
