import { describe, expect, it } from 'vitest';
import {
  parseSlashToken,
  resolveAssistQuery,
  type CommandExperienceEntryV1,
} from '../src/index';

function command(
  partial: Partial<CommandExperienceEntryV1> & Pick<CommandExperienceEntryV1, 'canonicalName'>,
): CommandExperienceEntryV1 {
  return {
    aliases: [],
    description: `${partial.canonicalName} command`,
    category: 'session',
    input: {},
    surfaces: ['web', 'tui'],
    actionKind: 'local',
    owner: 'client',
    danger: 'safe',
    availability: { state: 'available' },
    coverage: 'equivalent',
    ...partial,
  };
}

const catalog: CommandExperienceEntryV1[] = [
  command({ canonicalName: 'help', category: 'discovery', description: 'Show help' }),
  command({ canonicalName: 'resume', category: 'session', input: { selectorKey: 'sessionId' } }),
  command({ canonicalName: 'rename', category: 'session' }),
  command({
    canonicalName: 'status',
    category: 'discovery',
    availability: { state: 'disabled', reason: 'System status projection not available' },
  }),
];

describe('resolveAssistQuery', () => {
  it('opens the full local directory on / with zero RPC', () => {
    const resolution = resolveAssistQuery(catalog, '/');

    expect(resolution.rpcIssued).toBe(false);
    expect(resolution.token).toBe('');
    expect(resolution.candidates.map((entry) => entry.canonicalName)).toEqual([
      'help',
      'status',
      'rename',
      'resume',
    ]);
    expect(resolution.categories).toEqual(['discovery', 'session']);
    expect(resolution.disabledReasons.status).toBe('System status projection not available');
  });

  it('selects an exact command on the same input event', () => {
    const resolution = resolveAssistQuery(catalog, '/resume');

    expect(resolution.exact?.canonicalName).toBe('resume');
    expect(resolution.selected?.canonicalName).toBe('resume');
    expect(resolution.rpcIssued).toBe(false);
  });

  it('selects a unique safe prefix without extra navigation', () => {
    const resolution = resolveAssistQuery(catalog, '/hel');

    expect(resolution.uniquePrefix?.canonicalName).toBe('help');
    expect(resolution.selected?.canonicalName).toBe('help');
  });

  it('does not auto-select an ambiguous prefix', () => {
    const resolution = resolveAssistQuery(catalog, '/re');

    expect(resolution.exact).toBeNull();
    expect(resolution.uniquePrefix).toBeNull();
    expect(resolution.selected).toBeNull();
    expect(resolution.candidates.map((entry) => entry.canonicalName)).toEqual(['rename', 'resume']);
  });

  it('keeps disabled commands discoverable with a reason', () => {
    const resolution = resolveAssistQuery(catalog, '/sta');

    expect(resolution.candidates.some((entry) => entry.canonicalName === 'status')).toBe(true);
    expect(resolution.disabledReasons.status).toContain('not available');
    expect(resolution.selected).toBeNull();
  });

  it('parses slash tokens without treating the prefix as the name', () => {
    expect(parseSlashToken('/agent')).toBe('agent');
    expect(parseSlashToken('  /Help  ')).toBe('help');
  });

  it('filters the local directory to the requested surface', () => {
    const mixed: CommandExperienceEntryV1[] = [
      command({ canonicalName: 'help', surfaces: ['web', 'tui'] }),
      command({ canonicalName: 'web-only', surfaces: ['web'] }),
      command({ canonicalName: 'tui-only', surfaces: ['tui'] }),
    ];

    const web = resolveAssistQuery(mixed, '/');
    const tui = resolveAssistQuery(mixed, '/', { surface: 'tui' });

    expect(web.candidates.map((entry) => entry.canonicalName)).toEqual(['help', 'web-only']);
    expect(tui.candidates.map((entry) => entry.canonicalName)).toEqual(['help', 'tui-only']);
  });
});
