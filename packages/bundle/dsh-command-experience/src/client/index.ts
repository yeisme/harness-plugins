/**
 * DSH Command Experience Client Entry Point
 *
 * ModuleLoader face. Workspace packages are inlined by tsdown so this
 * file stays self-contained: no external @yeisme require at runtime.
 */

import { bindSlashRuntime, type SlashBindContext } from '../slash-bind.ts';

export { commandExperienceTuiAdapter } from '@yeisme/dsh-client-ui-command-experience-tui';

/**
 * The React web adapter cannot ship inside this ModuleLoader bundle:
 * React stays external by contract. Hosts consume it directly from
 * @yeisme/dsh-client-ui-command-experience-web. This descriptor names that
 * handoff instead of faking an adapter value.
 */
export const commandExperienceWebAdapterRef = {
  packageName: '@yeisme/dsh-client-ui-command-experience-web',
  bundled: false,
  reason: 'React is an external peer dependency; the web adapter ships as its own package',
} as const;

export const name = 'dsh-command-experience';
export const inject: readonly string[] = [];

/** Live slash directory on the web client. Missing pane/commands seams fail closed. */
export function apply(ctx: SlashBindContext): () => void {
  return bindSlashRuntime(ctx).dispose;
}

const DshCommandExperienceClientPlugin = { name, inject, apply };
export default DshCommandExperienceClientPlugin;
