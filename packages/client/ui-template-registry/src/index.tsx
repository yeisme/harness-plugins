/**
 * @yeisme/dsh-client-ui-template-registry node/host-side entry.
 *
 * Browser logic and pane/command registration live in `./client`; the
 * controllers, views, and the typed host seam are re-exported here for
 * consumers and tests. The host-side face is a no-op so pure host profiles
 * can compose safely.
 *
 * @module @yeisme/dsh-client-ui-template-registry
 */

import type { Context } from '@deepseek-ai/cordis'

export const name = 'client-ui-template-registry'
export const inject: readonly string[] = []

export function apply(_ctx: Context): void {
  // no-op host face
}

const ClientUiTemplateRegistryPlugin = { name, inject, apply }

export default ClientUiTemplateRegistryPlugin

export { TemplateCatalogView } from './catalog-view.js'
export type { TemplateCatalogViewProps } from './catalog-view.js'
export { TemplateCompileView, contractInputText } from './compile-view.js'
export type { TemplateCompileViewProps } from './compile-view.js'
export {
  createTemplateCatalogController,
  createTemplateCatalogState,
  filterTemplates,
  isTemplateCatalogFilterActive,
  moveCatalogSelection,
  templateCatalogFacets,
} from './catalog-controller.js'
export type {
  TemplateCatalogController,
  TemplateCatalogState,
  TemplateCatalogFilters,
  TemplateCatalogPhase,
  TemplateCatalogDetailState,
  TemplateCatalogErrorReason,
} from './catalog-controller.js'
export {
  composeConfirmDecisionRef,
  createTemplateCompileController,
  createTemplateCompileState,
  foldSessionFailure,
  isCompileArmed,
  missingRequiredFields,
  suggestExportName,
} from './compile-controller.js'
export type {
  TemplateCompileController,
  TemplateCompileState,
  TemplateCompilePhase,
  TemplateCompileBusy,
  TemplateCompileErrorState,
} from './compile-controller.js'
export {
  isTemplateRegistryHost,
  probeTemplateRegistryClient,
  TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS,
  TEMPLATE_REGISTRY_HOST_SCHEMA,
  TEMPLATE_REGISTRY_HOST_SERVICE,
} from './seam.js'
export type {
  TemplateRegistryClientDependency,
  TemplateRegistryClientProbeEntryV1,
  TemplateRegistryClientProbeResultV1,
  TemplateRegistryClientProbeResolutionV1,
  TemplateRegistryHostFace,
  TemplateRegistryPaneWorkbenchFace,
  TemplateRegistryLocale,
} from './seam.js'
export { templateRegistryTranslator, templatePreviewReasonText } from './locales.js'
export type { TemplateRegistryMessages, TemplateRegistryTranslator } from './locales.js'
