/**
 * Official TUI command-console contribution seam tests.
 *
 * Drive the shipped TUI adapter. Missing official DSH host seams fail closed.
 */

import { describe, expect, it } from 'vitest';
import {
  applyCommandExperienceTui,
  applyTuiAssist,
  commandExperienceTuiAdapter,
  createCommandConsoleContribution,
  createConsoleController,
  createLocalCommandConsoleHost,
  probeTuiCommandExperienceCapabilities,
  registerCommandConsoleContribution,
  resolveTuiAssistQuery,
} from '../src/index';
import { TUI_COMMAND_CATALOG, TUI_P0_CATALOG } from './fixtures';

describe('commandExperienceTuiAdapter', () => {
  it('is a real shipped adapter object, not a null stub', () => {
    expect(commandExperienceTuiAdapter).not.toBeNull();
    expect(commandExperienceTuiAdapter.surface).toBe('tui');
    expect(commandExperienceTuiAdapter.rpcOnFirstDiscovery).toBe(false);
    expect(typeof commandExperienceTuiAdapter.probe).toBe('function');
    expect(typeof commandExperienceTuiAdapter.register).toBe('function');
    expect(typeof commandExperienceTuiAdapter.apply).toBe('function');
  });

  it('registers through the public TUI contribution host without RPC on first discovery', () => {
    const local = createLocalCommandConsoleHost();
    const contribution = createCommandConsoleContribution(TUI_COMMAND_CATALOG);
    const registration = registerCommandConsoleContribution(local.host, contribution);

    expect(registration.registered).toBe(true);
    expect(registration.officialSeam).toBe(true);
    expect(registration.contribution.surface).toBe('tui');
    expect(registration.contribution.rpcOnFirstDiscovery).toBe(false);
    expect(local.getContribution()?.commands).toEqual(TUI_COMMAND_CATALOG);
    expect(local.disposed()).toBe(false);

    registration.dispose();
    expect(local.getContribution()).toBeNull();
    expect(local.disposed()).toBe(true);
  });

  it('fails closed when the official TUI contribution seam is missing', () => {
    const probe = probeTuiCommandExperienceCapabilities({});
    const registration = applyCommandExperienceTui({}, TUI_COMMAND_CATALOG);

    expect(probe.available).toBe(false);
    expect(probe.reason).toContain('fail-closed');
    expect(registration.registered).toBe(false);
    expect(registration.reason).toContain('unavailable');
    expect(registration.contribution.rpcOnFirstDiscovery).toBe(false);
  });

  it('fails closed against a null host without inventing a fake console', () => {
    const probe = probeTuiCommandExperienceCapabilities(undefined);
    const registration = applyCommandExperienceTui(null);

    expect(probe.available).toBe(false);
    expect(registration.registered).toBe(false);
    expect(registration.reason).toMatch(/fail-closed|unavailable/);
  });

  it('resolves canonical / assist and the : legacy alias with a migration hint', () => {
    const slash = resolveTuiAssistQuery(TUI_COMMAND_CATALOG, '/');
    const colon = resolveTuiAssistQuery(TUI_COMMAND_CATALOG, ':');

    expect(slash.rpcIssued).toBe(false);
    expect(slash.prefix).toBe('/');
    expect(slash.migrationHint).toBeNull();
    expect(slash.candidates.map((command) => command.canonicalName)).toEqual(
      expect.arrayContaining(['help', 'agent', 'resume', 'status']),
    );

    expect(colon.rpcIssued).toBe(false);
    expect(colon.prefix).toBe(':');
    expect(colon.migrationHint).toContain('legacy alias');
    expect(colon.candidates.map((command) => command.canonicalName)).toEqual(
      slash.candidates.map((command) => command.canonicalName),
    );
  });

  it('resolves exact /resume as the session picker and /agent as the thread picker', () => {
    const resume = resolveTuiAssistQuery(TUI_COMMAND_CATALOG, '/resume');
    const agent = resolveTuiAssistQuery(TUI_COMMAND_CATALOG, '/agent');
    const colonResume = resolveTuiAssistQuery(TUI_COMMAND_CATALOG, ':resume');

    expect(resume.exact?.canonicalName).toBe('resume');
    expect(resume.selected?.canonicalName).toBe('resume');
    expect(resume.selector).toBe('session');
    expect(resume.rpcIssued).toBe(false);

    expect(agent.exact?.canonicalName).toBe('agent');
    expect(agent.selected?.canonicalName).toBe('agent');
    expect(agent.selector).toBe('thread');

    expect(colonResume.selected?.canonicalName).toBe('resume');
    expect(colonResume.migrationHint).toContain('use / instead');
    expect(colonResume.selector).toBe('session');
  });

  it('keeps a missing owner action visible and disabled with a reason', () => {
    const status = resolveTuiAssistQuery(TUI_COMMAND_CATALOG, '/status');
    const catalogStatus = TUI_P0_CATALOG.find((entry) => entry.canonicalName === 'status');

    expect(status.candidates.some((command) => command.canonicalName === 'status')).toBe(true);
    expect(status.disabled).toBe(true);
    expect(status.disabledReason).toContain('missing owner action');
    expect(status.selected?.availability.state).toBe('disabled');
    expect(catalogStatus?.availability.state).toBe('disabled');
    expect(catalogStatus?.availability.reason).toContain('missing owner action');
  });

  it('lets the shared reducer own assist → select after contribution', () => {
    const controller = createConsoleController();
    const { state, resolution } = applyTuiAssist(controller, TUI_COMMAND_CATALOG, '/resume');

    expect(resolution.selected?.canonicalName).toBe('resume');
    expect(state.state).toBe('selector');
    expect(state.selectedCommand?.canonicalName).toBe('resume');
  });

  it('opens the thread picker for /agent through the shared reducer', () => {
    const controller = createConsoleController();
    const { state, resolution } = applyTuiAssist(controller, TUI_COMMAND_CATALOG, '/agent');

    expect(resolution.selector).toBe('thread');
    expect(state.state).toBe('selector');
    expect(state.selectedCommand?.canonicalName).toBe('agent');
  });

  it('does not select a disabled command from the reducer', () => {
    const controller = createConsoleController();
    const { state, resolution } = applyTuiAssist(controller, TUI_COMMAND_CATALOG, '/status');

    expect(resolution.disabled).toBe(true);
    expect(resolution.disabledReason).toContain('missing owner action');
    expect(state.state).toBe('assist');
    expect(state.selectedCommand).toBeNull();
  });
});
