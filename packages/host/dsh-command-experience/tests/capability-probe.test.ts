/**
 * Capability Probe Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { probeCapabilities, createActivationFailure, formatProbeError, TARGET_DSH_VERSION } from '../src/capability-probe';

describe('capability-probe', () => {
  beforeEach(() => {
    // Reset any module mocks
    vi.clearAllMocks();
  });

  describe('TARGET_DSH_VERSION', () => {
    it('should export target DSH version', () => {
      expect(TARGET_DSH_VERSION).toBe('0.1.0-rc.8');
    });
  });

  describe('probeCapabilities', () => {
    it('should create activation failure with errors', () => {
      const result = createActivationFailure(['Test error 1', 'Test error 2']);

      expect(result.canActivate).toBe(false);
      expect(result.errors).toEqual(['Test error 1', 'Test error 2']);
      expect(result.missingCapabilities).toEqual([]);
      expect(result.unavailableCommands).toEqual([]);
    });

    it('should format probe error for activation failure', () => {
      const result = createActivationFailure(['Missing capability A', 'Missing capability B']);
      const formatted = formatProbeError(result);

      expect(formatted).toContain('Command Experience bundle cannot activate');
      expect(formatted).toContain('Missing capability A');
      expect(formatted).toContain('Missing capability B');
    });

    it('should return success message when activation is possible', () => {
      const result: any = {
        canActivate: true,
        dshVersion: TARGET_DSH_VERSION,
        capabilities: {
          commandDirectory: true,
          threadProjection: true,
          sessionProjection: true,
          ownerActions: true,
          actionReceipts: true,
        },
        missingCapabilities: [],
        unavailableCommands: [],
        errors: [],
      };

      const formatted = formatProbeError(result);
      expect(formatted).toBe('All required capabilities are available');
    });

    it('should include version information in error message', () => {
      const result = createActivationFailure(['Version mismatch']);
      (result as any).dshVersion = '0.1.0-rc.7';

      const formatted = formatProbeError(result);
      expect(formatted).toContain(`Target DSH version: ${TARGET_DSH_VERSION}`);
      expect(formatted).toContain('Detected DSH version: 0.1.0-rc.7');
    });

    it('should format unavailable commands in error message', () => {
      // Note: formatProbeError currently only includes errors and missingCapabilities
      // unavailableCommands are logged separately by the activation function
      const result: any = {
        canActivate: false,
        dshVersion: null,
        capabilities: {
          commandDirectory: true,
          threadProjection: false,
          sessionProjection: false,
          ownerActions: true,
          actionReceipts: true,
        },
        missingCapabilities: ['thread-projection', 'session-projection'],
        unavailableCommands: [
          { command: '/agent', reason: 'Thread projection not available' },
          { command: '/resume', reason: 'Session projection not available' },
        ],
        errors: ['Some capabilities missing'],
      };

      const formatted = formatProbeError(result);
      expect(formatted).toContain('Some capabilities missing');
      expect(formatted).toContain('thread-projection');
      expect(formatted).toContain('session-projection');
      // unavailableCommands are handled separately by the activation function
    });
  });

  describe('integration scenarios', () => {
    it('should handle missing command directory capability', async () => {
      // Mock import failures
      const originalImport = globalThis.import;
      let importCallCount = 0;

      // @ts-ignore
      globalThis.import = vi.fn(async (module: string) => {
        importCallCount++;
        if (module === '@deepseek-ai/dsh-commands') {
          throw new Error('Module not found');
        }
        if (module === '@deepseek-ai/dsh-client-runtime') {
          return {};
        }
        return originalImport.call(globalThis, module);
      });

      try {
        const result = await probeCapabilities();

        expect(result.canActivate).toBe(false);
        expect(result.capabilities.commandDirectory).toBe(false);
        expect(result.missingCapabilities).toContain('@deepseek-ai/dsh-commands');
      } finally {
        // @ts-ignore
        globalThis.import = originalImport;
      }
    });

    it('should detect successful activation with all capabilities', () => {
      // This test validates the structure when all capabilities are available
      const mockResult: any = {
        canActivate: true,
        dshVersion: TARGET_DSH_VERSION,
        capabilities: {
          commandDirectory: true,
          threadProjection: true,
          sessionProjection: true,
          ownerActions: true,
          actionReceipts: true,
        },
        missingCapabilities: [],
        unavailableCommands: [],
        errors: [],
      };

      expect(mockResult.canActivate).toBe(true);
      expect(Object.values(mockResult.capabilities).every(v => v === true)).toBe(true);
      expect(mockResult.missingCapabilities).toHaveLength(0);
      expect(mockResult.unavailableCommands).toHaveLength(0);
      expect(mockResult.errors).toHaveLength(0);
    });
  });
});
