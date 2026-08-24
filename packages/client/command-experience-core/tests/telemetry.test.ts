import { describe, expect, it } from 'vitest';
import {
  assertTelemetryAllowlist,
  createUsageRecord,
  redactTelemetry,
  TELEMETRY_ALLOWED_FIELDS,
} from '../src/index';

describe('telemetry allowlist', () => {
  it('keeps only canonical command, coverage, capability, receipt, digest, and correlation', () => {
    const result = redactTelemetry({
      canonicalCommand: 'resume',
      coverage: 'equivalent',
      capability: 'session.projection',
      receiptStatus: 'success',
      redactedDigest: 'redacted:abc',
      correlationId: 'cmd-1',
      prompt: 'please resume the secret project',
      args: { title: 'Secret Project' },
      title: 'Secret Project',
      path: '/home/user/secret',
      credential: 'sk-live',
      providerPayload: { model: 'hidden' },
      privateToolArgs: { cmd: 'rm' },
    });

    expect(Object.keys(result.record).sort()).toEqual([...TELEMETRY_ALLOWED_FIELDS].sort());
    expect(result.record.canonicalCommand).toBe('resume');
    expect(result.record.prompt).toBeUndefined();
    expect(result.droppedFields).toEqual(expect.arrayContaining([
      'prompt',
      'args',
      'title',
      'path',
      'credential',
      'providerPayload',
      'privateToolArgs',
    ]));
  });

  it('builds anonymous usage records without titles or paths', () => {
    const record = createUsageRecord({
      canonicalCommand: '/resume',
      coverage: 'equivalent',
      capability: 'session.open',
      receiptStatus: 'rejected',
      correlationId: 'corr-9',
      digestSource: 'session:opaque-ref',
    });

    expect(record.canonicalCommand).toBe('resume');
    expect(record.redactedDigest?.startsWith('redacted:')).toBe(true);
    expect(JSON.stringify(record)).not.toContain('opaque-ref');
    expect(assertTelemetryAllowlist(record).ok).toBe(true);
  });

  it('flags fixture objects that leak forbidden fields', () => {
    const scan = assertTelemetryAllowlist({
      event: {
        canonicalCommand: 'delete',
        title: 'Family photos',
        providerPayload: { prompt: 'hidden' },
      },
    });

    expect(scan.ok).toBe(false);
    expect(scan.leaks.some((path) => path.includes('title'))).toBe(true);
    expect(scan.leaks.some((path) => path.includes('providerPayload'))).toBe(true);
  });
});
