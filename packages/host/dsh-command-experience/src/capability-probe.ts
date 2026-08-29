/**
 * DSH Capability Probe
 *
 * Probes DSH runtime for required capabilities and exports.
 */

import type { CapabilityProbeResult } from './types';

/**
 * Target DSH version for this bundle
 */
export const TARGET_DSH_VERSION = '0.1.0-rc.8';

/**
 * Probe DSH runtime capabilities
 *
 * This function checks for the presence of required exports and capabilities
 * from the DSH runtime. Returns detailed probe results for bundle activation.
 */
export async function probeCapabilities(): Promise<CapabilityProbeResult> {
  const result: CapabilityProbeResult = {
    canActivate: true,
    dshVersion: null,
    capabilities: {
      commandDirectory: false,
      threadProjection: false,
      sessionProjection: false,
      ownerActions: false,
      actionReceipts: false,
    },
    missingCapabilities: [],
    unavailableCommands: [],
    errors: [],
  };

  try {
    // Try to detect DSH version
    // @ts-ignore - dynamic probe
    if (typeof __DSH_VERSION__ !== 'undefined') {
      // @ts-ignore
      result.dshVersion = String(__DSH_VERSION__);
    }

    // Probe for @deepseek-ai/dsh-commands
    try {
      // @ts-ignore - runtime probe
      await import('@deepseek-ai/dsh-commands');
      result.capabilities.commandDirectory = true;
    } catch {
      result.missingCapabilities.push('@deepseek-ai/dsh-commands');
    }

    // Probe for @deepseek-ai/dsh-client-runtime
    let dshRuntime: any = null;
    try {
      // @ts-ignore - runtime probe
      dshRuntime = await import('@deepseek-ai/dsh-client-runtime');
      result.capabilities.ownerActions = true;
      result.capabilities.actionReceipts = true;
    } catch {
      result.missingCapabilities.push('@deepseek-ai/dsh-client-runtime');
    }

    // Probe for session/subagent capabilities if runtime is available
    if (dshRuntime) {
      // Check for session projection
      if (dshRuntime.sessions || dshRuntime.getSessionProjection) {
        result.capabilities.sessionProjection = true;
      } else {
        result.unavailableCommands.push({
          command: '/resume',
          reason: 'Session projection not available in DSH runtime',
        });
        result.unavailableCommands.push({
          command: '/session',
          reason: 'Session projection not available in DSH runtime',
        });
        result.unavailableCommands.push({
          command: '/new',
          reason: 'Session action not available in DSH runtime',
        });
        result.unavailableCommands.push({
          command: '/fork',
          reason: 'Session action not available in DSH runtime',
        });
      }

      // Check for thread projection
      if (dshRuntime.subagents || dshRuntime.getThreadProjection) {
        result.capabilities.threadProjection = true;
      } else {
        result.unavailableCommands.push({
          command: '/agent',
          reason: 'Thread projection not available in DSH runtime',
        });
      }
    }

    // Determine if bundle can activate
    // We need at minimum the command directory capability
    if (!result.capabilities.commandDirectory) {
      result.canActivate = false;
      result.errors.push(
        'Required @deepseek-ai/dsh-commands export not available'
      );
    }

    // Version compatibility check
    if (result.dshVersion) {
      const current = result.dshVersion;
      if (current !== TARGET_DSH_VERSION) {
        // Log version mismatch but don't fail activation
        // Future: implement semver compatibility checking
        result.unavailableCommands.push({
          command: '*',
          reason: `DSH version ${current} differs from target ${TARGET_DSH_VERSION}`,
        });
      }
    }

  } catch (error) {
    result.canActivate = false;
    result.errors.push(
      `Capability probe failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  return result;
}

/**
 * Create a capability probe result that indicates activation failure
 */
export function createActivationFailure(errors: string[]): CapabilityProbeResult {
  return {
    canActivate: false,
    dshVersion: null,
    capabilities: {
      commandDirectory: false,
      threadProjection: false,
      sessionProjection: false,
      ownerActions: false,
      actionReceipts: false,
    },
    missingCapabilities: [],
    unavailableCommands: [],
    errors,
  };
}

/**
 * Format probe result for user-facing error message
 */
export function formatProbeError(result: CapabilityProbeResult): string {
  if (result.canActivate) {
    return 'All required capabilities are available';
  }

  const lines = [
    'Command Experience bundle cannot activate:',
    '',
  ];

  if (result.errors.length > 0) {
    lines.push('Errors:');
    for (const error of result.errors) {
      lines.push(`  - ${error}`);
    }
    lines.push('');
  }

  if (result.missingCapabilities.length > 0) {
    lines.push('Missing capabilities:');
    for (const cap of result.missingCapabilities) {
      lines.push(`  - ${cap}`);
    }
    lines.push('');
  }

  lines.push(`Target DSH version: ${TARGET_DSH_VERSION}`);
  if (result.dshVersion) {
    lines.push(`Detected DSH version: ${result.dshVersion}`);
  }

  return lines.join('\n');
}
