/**
 * DSH Web bundle client entry: re-export the selection & annotation graft so
 * the bundle's client.js carries a single ModuleLoader registration.
 *
 * @module @yeisme/dsh-selection-annotation/client
 */

export {
  apply,
  inject,
  name,
  SELECTION_ANNOTATION_KILL_SWITCH,
  SELECTION_ANNOTATION_SUBMIT_EVENT,
} from '@yeisme/dsh-client-ui-selection-annotation/client'
export type { SelectionAnnotationSubmitDetail } from '@yeisme/dsh-client-ui-selection-annotation/client'
