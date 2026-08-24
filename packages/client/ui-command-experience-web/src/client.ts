/**
 * Official command-menu / client contribution seam adapter.
 *
 * Probes the published DSH host for a register/contribute function.
 * Missing seams fail closed. This module never patches the DOM and
 * does not claim official `dsh web` boot.
 */

import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';
import { createInitialState, commandReducer } from '@yeisme/dsh-client-ui-command-experience-core';

export const OFFICIAL_COMMAND_MENU_PACKAGE = '@deepseek-ai/dsh-client-ui-commands';

export interface CommandMenuContribution {
  readonly id: string;
  readonly surface: 'web';
  readonly commands: readonly CommandExperienceEntryV1[];
  readonly render: 'command-experience-menu';
  readonly rpcOnFirstDiscovery: false;
}

export interface CommandMenuContributionHost {
  readonly registerCommandMenu?: (contribution: CommandMenuContribution) => () => void;
  readonly contributeCommandMenu?: (contribution: CommandMenuContribution) => () => void;
}

export interface CommandExperienceCapabilityProbe {
  readonly available: boolean;
  readonly officialSeam: boolean;
  readonly reason: string | null;
  readonly missing: readonly string[];
  readonly capabilities: readonly string[];
  readonly dshVersion: string | null;
}

export interface CommandMenuRegistration {
  readonly registered: boolean;
  readonly officialSeam: boolean;
  readonly reason: string | null;
  readonly dispose: () => void;
  readonly contribution: CommandMenuContribution;
}

export interface LocalCommandMenuHost {
  readonly host: CommandMenuContributionHost;
  readonly getContribution: () => CommandMenuContribution | null;
  readonly disposed: () => boolean;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

export function inspectCommandMenuHost(host: unknown): {
  readonly official: boolean;
  readonly register: ((contribution: CommandMenuContribution) => () => void) | null;
  readonly missing: readonly string[];
} {
  if (host === null || host === undefined || typeof host !== 'object') {
    return {
      official: false,
      register: null,
      missing: [OFFICIAL_COMMAND_MENU_PACKAGE, 'registerCommandMenu'],
    };
  }

  const candidate = host as CommandMenuContributionHost & {
    readonly commands?: unknown;
    readonly uiCommands?: unknown;
  };
  const register = candidate.registerCommandMenu ?? candidate.contributeCommandMenu;
  if (!isFunction(register)) {
    return {
      official: false,
      register: null,
      missing: ['registerCommandMenu'],
    };
  }

  return {
    official: true,
    register: register.bind(candidate),
    missing: [],
  };
}

export function probeCommandExperienceCapabilities(
  host?: unknown,
): CommandExperienceCapabilityProbe {
  const inspected = inspectCommandMenuHost(host);
  if (inspected.register === null) {
    return {
      available: false,
      officialSeam: false,
      reason: 'Official command-menu contribution seam is unavailable; Web adapter stays fail-closed',
      missing: inspected.missing,
      capabilities: [],
      dshVersion: null,
    };
  }

  return {
    available: true,
    officialSeam: inspected.official,
    reason: null,
    missing: [],
    capabilities: ['command-menu', 'keyboard-navigation', 'react-components'],
    dshVersion: null,
  };
}

export function createLocalCommandMenuHost(): LocalCommandMenuHost {
  let contribution: CommandMenuContribution | null = null;
  let disposed = false;
  const host: CommandMenuContributionHost = {
    registerCommandMenu(next) {
      contribution = next;
      disposed = false;
      return () => {
        contribution = null;
        disposed = true;
      };
    },
  };
  return {
    host,
    getContribution: () => contribution,
    disposed: () => disposed,
  };
}

export function createCommandMenuContribution(
  commands: readonly CommandExperienceEntryV1[],
): CommandMenuContribution {
  return {
    id: '@yeisme/dsh-client-ui-command-experience-web',
    surface: 'web',
    commands,
    render: 'command-experience-menu',
    rpcOnFirstDiscovery: false,
  };
}

export function registerCommandMenuContribution(
  host: unknown,
  contribution: CommandMenuContribution,
): CommandMenuRegistration {
  const inspected = inspectCommandMenuHost(host);
  if (inspected.register === null) {
    return {
      registered: false,
      officialSeam: false,
      reason: 'Official command-menu contribution seam is unavailable',
      dispose: () => {},
      contribution,
    };
  }

  const dispose = inspected.register(contribution);
  return {
    registered: true,
    officialSeam: inspected.official,
    reason: null,
    dispose,
    contribution,
  };
}

/**
 * Honest local apply() used by the bundle client entry.
 * Official `dsh web` boot is not claimed. Missing host seams fail closed.
 */
export function applyCommandExperienceClient(host: unknown, commands: readonly CommandExperienceEntryV1[] = []): CommandMenuRegistration {
  const probe = probeCommandExperienceCapabilities(host);
  const contribution = createCommandMenuContribution(commands);
  if (!probe.available) {
    return {
      registered: false,
      officialSeam: false,
      reason: probe.reason,
      dispose: () => {},
      contribution,
    };
  }
  return registerCommandMenuContribution(host, contribution);
}

export function createMenuController() {
  let state = createInitialState();
  return {
    getState: () => state,
    dispatch(action: Parameters<typeof commandReducer>[1]) {
      state = commandReducer(state, action);
      return state;
    },
  };
}
