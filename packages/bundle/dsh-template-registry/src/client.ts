/**
 * @yeisme/dsh-template-registry-bundle browser entry.
 *
 * Re-exports the template-registry client plugin's browser face (the
 * capability-probed catalog + guided-compile panes). This bundle adds no
 * logic of its own; it exists only as the installable unit — when the
 * `templateRegistryHost` seam is absent the exported apply registers
 * nothing but a probe-only face carrying the disabled reason.
 *
 * @module @yeisme/dsh-template-registry-bundle/client
 */

export { apply } from '@yeisme/dsh-client-ui-template-registry/client'
export {
  probeTemplateRegistryClient,
  TEMPLATE_REGISTRY_CLIENT_PROBE_REASONS,
  TEMPLATE_REGISTRY_COMMAND_SPECS,
  TEMPLATE_REGISTRY_VIEW_KINDS,
} from '@yeisme/dsh-client-ui-template-registry/client'
export type {
  TemplateRegistryPaneFaceV1,
  TemplateRegistryClientProbeResultV1,
} from '@yeisme/dsh-client-ui-template-registry/client'
