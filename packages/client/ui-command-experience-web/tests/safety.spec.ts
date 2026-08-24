/**
 * Web safety tests: danger matrix, telemetry allowlist, malicious fixtures.
 */

import { describe, expect, it } from 'vitest';
import {
  assertTelemetryAllowlist,
  createUsageRecord,
  evaluateDangerGate,
  refusePluginRecursiveDelete,
  sanitizeCommandDescriptor,
} from '@yeisme/dsh-client-ui-command-experience-core';
import { MALICIOUS_PLUGIN_DESCRIPTOR, ownerActionHandlers } from './fixtures';

describe('danger matrix on shipped commands', () => {
  it('keeps /archive and /delete staged without preview or receipt', () => {
    const archive = evaluateDangerGate({
      command: 'archive',
      preview: null,
      receiptCapable: true,
    });
    const del = evaluateDangerGate({
      command: 'delete',
      preview: {
        targetRef: 'session:opaque-1',
        impactSummary: 'delete one session',
        reversible: false,
        owner: 'dsh',
        capability: 'session.delete.preview',
      },
      receiptCapable: false,
    });

    expect(archive.staged).toBe(true);
    expect(del.staged).toBe(true);
    expect(refusePluginRecursiveDelete({
      targetRef: 'session:opaque-1',
      recursive: true,
    }).ok).toBe(false);
  });
});

describe('telemetry fixture scan', () => {
  it('redacts usage records and rejects fixture leaks', () => {
    const record = createUsageRecord({
      canonicalCommand: '/resume',
      coverage: 'equivalent',
      capability: 'session.open',
      receiptStatus: 'success',
      correlationId: 'corr-web-1',
      digestSource: 'session:opaque-1',
    });

    expect(assertTelemetryAllowlist(record).ok).toBe(true);
    expect(JSON.stringify(record)).not.toMatch(/opaque-1|prompt|title|\//);

    const leakScan = assertTelemetryAllowlist({
      recentCommands: [
        { canonicalCommand: 'delete', title: 'Family photos', prompt: 'do not store' },
      ],
    });
    expect(leakScan.ok).toBe(false);
  });

  it('scans owner-action fixtures for forbidden field names', () => {
    const serialized = JSON.stringify(ownerActionHandlers.map((handler) => handler.info?.path ?? ''));
    expect(serialized).not.toMatch(/Authorization|sk-live|cookie=/i);
    const scan = assertTelemetryAllowlist({
      canonicalCommand: 'resume',
      coverage: 'equivalent',
      capability: 'session.open',
      receiptStatus: 'pending',
      redactedDigest: 'redacted:test',
      correlationId: 'corr',
    });
    expect(scan.ok).toBe(true);
  });
});

describe('malicious descriptor', () => {
  it('cannot change execution or terminal control', () => {
    const sanitized = sanitizeCommandDescriptor(MALICIOUS_PLUGIN_DESCRIPTOR);
    expect(sanitized.trustedForExecution).toBe(false);
    expect(sanitized.rejected.length).toBeGreaterThan(0);
    expect(typeof MALICIOUS_PLUGIN_DESCRIPTOR.execute).toBe('function');
    expect(sanitized.category).toBe('other');
  });
});
