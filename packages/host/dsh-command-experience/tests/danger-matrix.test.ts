import { describe, expect, it } from 'vitest';
import {
  createArchiveRequest,
  createDeleteRequest,
  createMockAdapter,
  createRestoreRequest,
  prepareDestructiveSubmit,
  type OwnerImpactPreview,
} from '../src/index';

const preview: OwnerImpactPreview = {
  targetRef: 'session:opaque-1',
  impactSummary: 'Affects one saved session',
  reversible: false,
  capability: 'session.delete.preview',
};

describe('owner preview danger matrix', () => {
  it('creates archive and delete requests with owner preview attached', () => {
    const archive = createArchiveRequest('session:opaque-1', 'corr-a', preview);
    const del = createDeleteRequest('session:opaque-1', 'corr-d', preview);

    expect(archive.action.type).toBe('archive-session');
    expect(archive.action.danger).toBe('confirm');
    expect(archive.action.preview?.targetRef).toBe('session:opaque-1');
    expect(del.action.danger).toBe('destructive');
    expect(del.action.preview?.capability).toBe('session.delete.preview');
  });

  it('keeps /archive staged without preview', () => {
    const decision = prepareDestructiveSubmit({
      command: 'archive',
      sessionRef: 'session:opaque-1',
      correlationId: 'corr-1',
      preview: null,
      receiptCapable: true,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.staged).toBe(true);
    expect(decision.request).toBeNull();
    expect(decision.reason).toContain('preview');
  });

  it('keeps /delete staged without receipt capability', () => {
    const decision = prepareDestructiveSubmit({
      command: 'delete',
      sessionRef: 'session:opaque-1',
      correlationId: 'corr-2',
      preview,
      receiptCapable: false,
    });

    expect(decision.allowed).toBe(false);
    expect(decision.staged).toBe(true);
    expect(decision.reason).toContain('receipt');
  });

  it('refuses recursive descendant deletion from the plugin', () => {
    const decision = prepareDestructiveSubmit({
      command: 'delete',
      sessionRef: 'session:opaque-1',
      correlationId: 'corr-3',
      preview,
      receiptCapable: true,
      descendants: [{ ref: 'child' }],
    });

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe('Plugin must not recursively delete');
    expect(decision.request).toBeNull();
  });

  it('creates restore requests as safe receipt-gated actions without preview', () => {
    const restore = createRestoreRequest('session:opaque-1', 'corr-r');

    expect(restore.action.type).toBe('restore-session');
    expect(restore.action.danger).toBe('safe');
    expect(restore.action.targetRef).toBe('session:opaque-1');
    expect(restore.action.preview).toBeUndefined();
    expect(restore.correlationId).toBe('corr-r');
  });

  it('submits only the owner-authored target after preview', async () => {
    const adapter = createMockAdapter({
      capabilities: new Set(['delete-session']),
      previews: new Map([['delete-session:session:opaque-1', preview]]),
    });

    const fetched = await adapter.getActionPreview?.({
      type: 'delete-session',
      targetRef: 'session:opaque-1',
      parameters: {},
      danger: 'destructive',
    });
    const decision = prepareDestructiveSubmit({
      command: 'delete',
      sessionRef: 'session:opaque-1',
      correlationId: 'corr-ok',
      preview: fetched ?? null,
      receiptCapable: true,
    });

    expect(decision.allowed).toBe(true);
    expect(decision.request?.action.targetRef).toBe('session:opaque-1');
    expect(decision.request?.action.parameters).toEqual({});
  });
});
