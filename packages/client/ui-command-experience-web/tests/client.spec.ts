/**
 * Official command-menu contribution seam tests.
 *
 * Drive the shipped client adapter. Missing official DSH host seams fail closed.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  applyCommandExperienceClient,
  createCommandMenuContribution,
  createLocalCommandMenuHost,
  createMenuController,
  probeCommandExperienceCapabilities,
  registerCommandMenuContribution,
} from '../src/client';
import { resolveAssistQuery } from '@yeisme/dsh-client-ui-command-experience-core';
import { WEB_COMMAND_CATALOG } from './fixtures';

describe('registerCommandMenuContribution', () => {
  it('registers through the official contribution host without DOM patching', () => {
    const local = createLocalCommandMenuHost();
    const contribution = createCommandMenuContribution(WEB_COMMAND_CATALOG);
    const registration = registerCommandMenuContribution(local.host, contribution);

    expect(registration.registered).toBe(true);
    expect(registration.officialSeam).toBe(true);
    expect(registration.contribution.rpcOnFirstDiscovery).toBe(false);
    expect(local.getContribution()?.commands).toEqual(WEB_COMMAND_CATALOG);
    expect(document.querySelectorAll('[data-command-menu-patch]')).toHaveLength(0);
  });

  it('fails closed when the official command-menu seam is missing', () => {
    const probe = probeCommandExperienceCapabilities({});
    const registration = applyCommandExperienceClient({}, WEB_COMMAND_CATALOG);

    expect(probe.available).toBe(false);
    expect(probe.reason).toContain('fail-closed');
    expect(registration.registered).toBe(false);
    expect(registration.reason).toContain('unavailable');
  });

  it('resolves /, exact command, unique prefix, disabled reason, and category with zero RPC', () => {
    let rpcCalls = 0;
    const fetchSpy = vi.fn(async () => {
      rpcCalls += 1;
      throw new Error('discovery must not RPC');
    });
    vi.stubGlobal('fetch', fetchSpy);

    const slash = resolveAssistQuery(WEB_COMMAND_CATALOG, '/');
    const exact = resolveAssistQuery(WEB_COMMAND_CATALOG, '/resume');
    const prefix = resolveAssistQuery(WEB_COMMAND_CATALOG, '/hel');
    const disabled = resolveAssistQuery(WEB_COMMAND_CATALOG, '/status');

    expect(slash.rpcIssued).toBe(false);
    expect(slash.categories).toEqual(expect.arrayContaining(['discovery', 'session']));
    expect(exact.exact?.canonicalName).toBe('resume');
    expect(prefix.uniquePrefix?.canonicalName).toBe('help');
    expect(disabled.disabledReasons.status).toContain('not available');
    expect(rpcCalls).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('lets the shared reducer own menu transitions after contribution', () => {
    const controller = createMenuController();
    const slash = resolveAssistQuery(WEB_COMMAND_CATALOG, '/');
    controller.dispatch({ type: 'START_ASSIST', query: '/', draft: '/' });
    const resume = slash.candidates.find((command) => command.canonicalName === 'resume');
    expect(resume).toBeDefined();
    const selected = controller.dispatch({ type: 'SELECT_COMMAND', command: resume! });
    expect(selected.state).toBe('selected');
    expect(selected.selectedCommand?.canonicalName).toBe('resume');
  });
});
