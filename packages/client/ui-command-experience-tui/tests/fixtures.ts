import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';
import { buildP0Catalog } from '@yeisme/dsh-client-ui-command-experience-core';

export function commandFixture(
  partial: Partial<CommandExperienceEntryV1> & Pick<CommandExperienceEntryV1, 'canonicalName'>,
): CommandExperienceEntryV1 {
  return {
    aliases: [],
    description: `${partial.canonicalName} command`,
    category: 'session',
    input: {},
    surfaces: ['web', 'tui'],
    actionKind: 'owner-action',
    owner: 'dsh',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'equivalent',
    ...partial,
  };
}

export const TUI_COMMAND_CATALOG: CommandExperienceEntryV1[] = [
  commandFixture({
    canonicalName: 'help',
    category: 'discovery',
    actionKind: 'local',
    owner: 'client',
    description: 'Show command help',
  }),
  commandFixture({
    canonicalName: 'agent',
    aliases: ['subagents'],
    description: 'Pick the main agent or a subagent thread',
    input: { selectorKey: 'threadRef' },
  }),
  commandFixture({
    canonicalName: 'resume',
    aliases: ['r'],
    description: 'Resume a saved session',
    input: { selectorKey: 'sessionId' },
  }),
  commandFixture({
    canonicalName: 'status',
    category: 'discovery',
    actionKind: 'inspect',
    availability: { state: 'disabled', reason: 'missing owner action status' },
  }),
];

export const TUI_P0_CATALOG = buildP0Catalog();
