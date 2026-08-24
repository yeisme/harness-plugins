import { describe, expect, it } from 'vitest';
import {
  evaluateDangerGate,
  gradeCommandDanger,
  refusePluginRecursiveDelete,
  requiresOwnerPreview,
  type OwnerImpactPreview,
} from '../src/index';

const preview: OwnerImpactPreview = {
  targetRef: 'session:opaque-1',
  impactSummary: 'Archive one saved session',
  reversible: true,
  owner: 'dsh',
  capability: 'session.archive.preview',
};

describe('danger matrix', () => {
  it('grades safe, confirm, and destructive commands', () => {
    expect(gradeCommandDanger('help')).toBe('safe');
    expect(gradeCommandDanger('/archive')).toBe('confirm');
    expect(gradeCommandDanger('delete')).toBe('destructive');
  });

  it('keeps /archive staged without owner preview', () => {
    const gate = evaluateDangerGate({
      command: '/archive',
      preview: null,
      receiptCapable: true,
    });

    expect(gate.allowed).toBe(false);
    expect(gate.staged).toBe(true);
    expect(gate.reason).toContain('/archive');
    expect(gate.reason).toContain('preview');
  });

  it('keeps /delete staged without receipt capability', () => {
    const gate = evaluateDangerGate({
      command: '/delete',
      preview,
      receiptCapable: false,
    });

    expect(gate.allowed).toBe(false);
    expect(gate.staged).toBe(true);
    expect(gate.reason).toContain('receipt');
  });

  it('allows /delete only with owner preview and receipt', () => {
    const gate = evaluateDangerGate({
      command: '/delete',
      preview: { ...preview, reversible: false, impactSummary: 'Permanently delete one session' },
      receiptCapable: true,
    });

    expect(requiresOwnerPreview('/delete')).toBe(true);
    expect(gate.allowed).toBe(true);
    expect(gate.staged).toBe(false);
    expect(gate.grade).toBe('destructive');
  });

  it('refuses plugin recursive delete and descendant enumeration', () => {
    expect(refusePluginRecursiveDelete({
      targetRef: 'session:opaque-1',
      recursive: true,
    }).ok).toBe(false);

    expect(refusePluginRecursiveDelete({
      targetRef: 'session:opaque-1',
      descendants: [{ ref: 'child' }],
    }).ok).toBe(false);

    expect(refusePluginRecursiveDelete({
      targetRef: 'session:opaque-1',
      paths: ['/tmp/session'],
    }).ok).toBe(false);

    expect(refusePluginRecursiveDelete({
      targetRef: 'session:opaque-1',
    })).toEqual({ ok: true, targetRef: 'session:opaque-1' });
  });
});
