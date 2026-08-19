/**
 * @yeisme/dsh-rich-media root entry.
 *
 * The package is an installable DSH Web bundle. It exports the headless
 * MediaRef contract plus the Host/Client plugin faces. Media storage,
 * multimodal model intake, and domain media editing remain with their owners.
 *
 * @module @yeisme/dsh-rich-media
 */

export {
  MEDIA_CAPABILITIES,
  MEDIA_KINDS,
  isMediaRefV1,
  validateMediaRefV1,
} from './host/types.ts'
export type {
  MediaCapability,
  MediaKind,
  MediaRefV1,
  MediaRefValidation,
  MediaResolveUrl,
} from './host/types.ts'
export { apply as applyHost, name as hostName } from './host/plugin.ts'

import RichMediaHostPlugin from './host/plugin.ts'
export default RichMediaHostPlugin
