/**
 * Official TUI command-console contribution seam adapter.
 *
 * Probes the published DSH host for a register/contribute function.
 * Missing seams fail closed. This module never patches the host, never
 * invents a fake console, and does not issue RPC on first discovery.
 */

import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';
import { commandReducer, createInitialState } from '@yeisme/dsh-client-ui-command-experience-core';
import { applyTuiAssist, resolveTuiAssistQuery } from './assist';
import { applyTuiConsoleKey } from './keys';
import type { TuiConsoleKeyInput } from './keys';

export {
  COLON_MIGRATION_HINT,
  applyTuiAssist,
  getCommandDisabledReason,
  isColonAssistInput,
  normalizeTuiAssistInput,
  resolveTuiAssistQuery,
  selectorKindFor,
  splitSessionHubInput,
} from './assist';
export type {
  TuiAssistController,
  TuiAssistPrefix,
  TuiAssistResolution,
  TuiSelectorKind,
} from './assist';

export {
  parseTerminalKey,
  applyTuiConsoleKey,
  isToggleFromIdle,
} from './keys';
export type { TuiConsoleKeyInput } from './keys';

export const OFFICIAL_TUI_CONSOLE_PACKAGE = '@deepseek-ai/dsh-client-tui';

export interface CommandConsoleContribution {
  readonly id: string;
  readonly surface: 'tui';
  readonly commands: readonly CommandExperienceEntryV1[];
  readonly render: 'command-experience-console';
  readonly rpcOnFirstDiscovery: false;
}

export interface CommandConsoleContributionHost {
  readonly registerCommandConsole?: (contribution: CommandConsoleContribution) => () => void;
  readonly contributeCommandConsole?: (contribution: CommandConsoleContribution) => () => void;
}

export interface TuiCommandExperienceCapabilityProbe {
  readonly available: boolean;
  readonly officialSeam: boolean;
  readonly reason: string | null;
  readonly missing: readonly string[];
  readonly capabilities: readonly string[];
  readonly dshVersion: string | null;
}

export interface CommandConsoleRegistration {
  readonly registered: boolean;
  readonly officialSeam: boolean;
  readonly reason: string | null;
  readonly dispose: () => void;
  readonly contribution: CommandConsoleContribution;
}

export interface LocalCommandConsoleHost {
  readonly host: CommandConsoleContributionHost;
  readonly getContribution: () => CommandConsoleContribution | null;
  readonly disposed: () => boolean;
}

function isFunction(value: unknown): value is (...args: never[]) => unknown {
  return typeof value === 'function';
}

export function inspectCommandConsoleHost(host: unknown): {
  readonly official: boolean;
  readonly register: ((contribution: CommandConsoleContribution) => () => void) | null;
  readonly missing: readonly string[];
} {
  if (host === null || host === undefined || typeof host !== 'object') {
    return {
      official: false,
      register: null,
      missing: [OFFICIAL_TUI_CONSOLE_PACKAGE, 'registerCommandConsole'],
    };
  }

  const candidate = host as CommandConsoleContributionHost;
  const register = candidate.registerCommandConsole ?? candidate.contributeCommandConsole;
  if (!isFunction(register)) {
    return {
      official: false,
      register: null,
      missing: ['registerCommandConsole'],
    };
  }

  return {
    official: true,
    register: register.bind(candidate),
    missing: [],
  };
}

export function probeTuiCommandExperienceCapabilities(
  host?: unknown,
): TuiCommandExperienceCapabilityProbe {
  const inspected = inspectCommandConsoleHost(host);
  if (inspected.register === null) {
    return {
      available: false,
      officialSeam: false,
      reason: 'Official TUI command-console contribution seam is unavailable; TUI adapter stays fail-closed',
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
    capabilities: ['command-console', 'slash-assist', 'legacy-colon-alias'],
    dshVersion: null,
  };
}

export function createLocalCommandConsoleHost(): LocalCommandConsoleHost {
  let contribution: CommandConsoleContribution | null = null;
  let disposed = false;
  const host: CommandConsoleContributionHost = {
    registerCommandConsole(next) {
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

export function createCommandConsoleContribution(
  commands: readonly CommandExperienceEntryV1[],
): CommandConsoleContribution {
  return {
    id: '@yeisme/dsh-client-ui-command-experience-tui',
    surface: 'tui',
    commands,
    render: 'command-experience-console',
    rpcOnFirstDiscovery: false,
  };
}

export function registerCommandConsoleContribution(
  host: unknown,
  contribution: CommandConsoleContribution,
): CommandConsoleRegistration {
  const inspected = inspectCommandConsoleHost(host);
  if (inspected.register === null) {
    return {
      registered: false,
      officialSeam: false,
      reason: 'Official TUI command-console contribution seam is unavailable; TUI adapter stays fail-closed',
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
 * Honest local apply() used by the bundle TUI entry.
 * Official `dsh --profile tui` boot is not claimed. Missing host seams fail closed.
 */
export function applyCommandExperienceTui(
  host: unknown,
  commands: readonly CommandExperienceEntryV1[] = [],
): CommandConsoleRegistration {
  const probe = probeTuiCommandExperienceCapabilities(host);
  const contribution = createCommandConsoleContribution(commands);
  if (!probe.available) {
    return {
      registered: false,
      officialSeam: false,
      reason: probe.reason,
      dispose: () => {},
      contribution,
    };
  }
  return registerCommandConsoleContribution(host, contribution);
}

export function createConsoleController() {
  let state = createInitialState();
  const controller = {
    getState: () => state,
    dispatch(action: Parameters<typeof commandReducer>[1]) {
      state = commandReducer(state, action);
      return state;
    },
  };
  return {
    ...controller,
    /**
     * Official-host integration point: feed one terminal key sequence
     * through the shared keymap. No stdin, no rawMode — the host owns the
     * input surface and stays fail-closed until the seam ships.
     */
    handleKeyEvent(
      sequence: string,
      context: Omit<TuiConsoleKeyInput, 'controller' | 'sequence'>,
    ) {
      return applyTuiConsoleKey({ controller, sequence, ...context });
    },
  };
}

export const commandExperienceTuiAdapter = {
  id: '@yeisme/dsh-client-ui-command-experience-tui',
  surface: 'tui' as const,
  rpcOnFirstDiscovery: false as const,
  probe: probeTuiCommandExperienceCapabilities,
  register: registerCommandConsoleContribution,
  apply: applyCommandExperienceTui,
  resolveAssist: resolveTuiAssistQuery,
  applyAssist: applyTuiAssist,
  createLocalHost: createLocalCommandConsoleHost,
  createContribution: createCommandConsoleContribution,
  createController: createConsoleController,
};

export type CommandExperienceTuiAdapter = typeof commandExperienceTuiAdapter;
