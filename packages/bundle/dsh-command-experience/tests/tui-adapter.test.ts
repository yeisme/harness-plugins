/**
 * Bundle-level tests for the shipped TUI adapter export.
 *
 * Import the adapter from the bundle client entry (not a reimplementation).
 */

import { describe, expect, it } from 'vitest';
import {
  commandExperienceTuiAdapter,
  commandExperienceWebAdapterRef,
} from '../src/client';
import {
  applyCommandExperienceTui,
  createLocalCommandConsoleHost,
  splitSessionHubInput,
} from '@yeisme/dsh-client-ui-command-experience-tui';
import { buildP0Catalog } from '@yeisme/dsh-client-ui-command-experience-core';

describe('bundle commandExperienceTuiAdapter', () => {
  it('exports a real adapter object rather than a null stub', () => {
    expect(commandExperienceTuiAdapter).not.toBeNull();
    expect(commandExperienceTuiAdapter).toBeTypeOf('object');
    expect(commandExperienceTuiAdapter.surface).toBe('tui');
    expect(commandExperienceTuiAdapter.rpcOnFirstDiscovery).toBe(false);
  });

  it('registers a tui contribution against a local host and fails closed on {}', () => {
    const catalog = buildP0Catalog();
    const local = createLocalCommandConsoleHost();
    const success = applyCommandExperienceTui(local.host, catalog);
    const missing = applyCommandExperienceTui({}, catalog);

    expect(success.registered).toBe(true);
    expect(success.contribution.surface).toBe('tui');
    expect(success.contribution.rpcOnFirstDiscovery).toBe(false);
    expect(missing.registered).toBe(false);
    expect(missing.reason).toMatch(/fail-closed|unavailable/);
  });

  it('names the web adapter handoff instead of faking an adapter value', () => {
    expect(commandExperienceWebAdapterRef).toEqual({
      packageName: '@yeisme/dsh-client-ui-command-experience-web',
      bundled: false,
      reason: expect.stringContaining('React'),
    });
  });

  it('seeds the /session hub and staged archive/delete in the shipped catalog', () => {
    const catalog = buildP0Catalog();
    expect(catalog.find((entry) => entry.canonicalName === 'session')).toMatchObject({
      danger: 'safe',
      coverage: 'adapted',
    });
    expect(catalog.find((entry) => entry.canonicalName === 'archive')?.danger).toBe('confirm');
    expect(catalog.find((entry) => entry.canonicalName === 'delete')?.danger).toBe('destructive');
    expect(splitSessionHubInput('/session archive')).toMatchObject({
      subcommand: { kind: 'archive' },
    });
  });
});
