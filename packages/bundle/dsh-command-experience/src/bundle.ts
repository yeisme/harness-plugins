/**
 * Command Experience Bundle
 *
 * Bundle activation, capability probing, and registration.
 */

import { probeCapabilities, formatProbeError, TARGET_DSH_VERSION } from '@yeisme/dsh-command-experience-host';

/**
 * Bundle activation function
 *
 * Called by DSH when the bundle is loaded.
 * This function probes capabilities and either activates successfully
 * or fails with a detailed error message.
 */
export async function activate(): Promise<void> {
  const probeResult = await probeCapabilities();

  if (!probeResult.canActivate) {
    const errorMessage = formatProbeError(probeResult);
    throw new Error(errorMessage);
  }

  // Log successful activation with capability details
  // eslint-disable-next-line no-console
  console.log(`DSH Command Experience activated for DSH ${probeResult.dshVersion || TARGET_DSH_VERSION}`);
  // eslint-disable-next-line no-console
  console.log('Available capabilities:', Object.keys(probeResult.capabilities).filter(k =>
    probeResult.capabilities[k as keyof typeof probeResult.capabilities]
  ));

  if (probeResult.unavailableCommands.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('Some commands are unavailable:');
    for (const cmd of probeResult.unavailableCommands) {
      // eslint-disable-next-line no-console
      console.warn(`  - ${cmd.command}: ${cmd.reason}`);
    }
  }
}

/**
 * Bundle deactivation function
 *
 * Called by DSH when the bundle is unloaded.
 * Should clean up any resources and subscriptions.
 */
export async function deactivate(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('DSH Command Experience deactivated');
}

/**
 * Get bundle metadata
 */
export function getMetadata() {
  return {
    id: '@yeisme/dsh-command-experience',
    version: '0.1.0-rc.1',
    name: 'Codex Command Experience',
    description: 'Unified command experience across Web and TUI',
    targetDSHVersion: TARGET_DSH_VERSION,
  };
}

/**
 * Export bundle activation contract for DSH
 */
export const bundle = {
  activate,
  deactivate,
  getMetadata,
};
