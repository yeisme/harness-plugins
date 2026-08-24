/**
 * Directory utilities tests
 */

import { describe, it, expect } from 'vitest';
import {
  normalizeCommandEntry,
  filterCommands,
  sortCommands,
  findExactMatch,
  findUniquePrefixMatch,
  getCategories,
  groupByCategory,
  isCommandExecutable,
  requiresConfirmation,
  isCommandDestructive,
} from '../src/directory';

import type { CommandExperienceEntryV1 } from '../src/types';

describe('directory', () => {
  const mockCommands: CommandExperienceEntryV1[] = [
    {
      canonicalName: 'help',
      aliases: ['h', '?'],
      description: 'Show command help',
      category: 'discovery',
      input: {},
      surfaces: ['web', 'tui'],
      actionKind: 'local',
      owner: 'client',
      danger: 'safe',
      availability: { state: 'available' },
      coverage: 'equivalent',
    },
    {
      canonicalName: 'resume',
      aliases: ['r'],
      description: 'Resume a session',
      category: 'session',
      input: { selectorKey: 'sessionId' },
      surfaces: ['web', 'tui'],
      actionKind: 'owner-action',
      owner: 'dsh',
      danger: 'safe',
      availability: { state: 'available' },
      coverage: 'equivalent',
    },
    {
      canonicalName: 'delete',
      aliases: [],
      description: 'Delete a session',
      category: 'session',
      input: { selectorKey: 'sessionId' },
      surfaces: ['web', 'tui'],
      actionKind: 'owner-action',
      owner: 'dsh',
      danger: 'destructive',
      availability: { state: 'available' },
      coverage: 'adapted',
    },
    {
      canonicalName: 'disabled-cmd',
      aliases: [],
      description: 'Disabled command',
      category: 'test',
      input: {},
      surfaces: ['web'],
      actionKind: 'local',
      owner: 'client',
      danger: 'safe',
      availability: { state: 'disabled', reason: 'Not implemented' },
      coverage: 'staged',
    },
  ];

  describe('normalizeCommandEntry', () => {
    it('should normalize command entry', () => {
      const entry: CommandExperienceEntryV1 = {
        canonicalName: '  Help  ',
        aliases: [' H ', '?'],
        description: '  Show help  ',
        category: '  Discovery  ',
        input: {},
        surfaces: ['web'],
        actionKind: 'local',
        owner: 'client',
        danger: 'safe',
        availability: { state: 'available' },
        coverage: 'equivalent',
      };

      const normalized = normalizeCommandEntry(entry);

      expect(normalized.canonicalName).toBe('help');
      expect(normalized.aliases).toEqual(['h', '?']);
      expect(normalized.description).toBe('Show help');
      expect(normalized.category).toBe('Discovery');
    });
  });

  describe('filterCommands', () => {
    it('should filter by surface', () => {
      const filtered = filterCommands(mockCommands, { surface: 'tui' });
      expect(filtered).toHaveLength(3);
      expect(filtered.every(c => c.surfaces.includes('tui'))).toBe(true);
    });

    it('should filter by availability', () => {
      const filtered = filterCommands(mockCommands, { minAvailability: 'available' });
      expect(filtered).toHaveLength(3);
      expect(filtered.every(c => c.availability.state === 'available')).toBe(true);
    });

    it('should filter by category', () => {
      const filtered = filterCommands(mockCommands, { category: 'session' });
      expect(filtered).toHaveLength(2);
      expect(filtered.every(c => c.category === 'session')).toBe(true);
    });

    it('should filter by query', () => {
      const filtered = filterCommands(mockCommands, { query: 'del' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].canonicalName).toBe('delete');
    });

    it('should exclude hidden by default', () => {
      const commands = [...mockCommands];
      commands.push({
        canonicalName: 'hidden',
        aliases: [],
        description: 'Hidden command',
        category: 'test',
        input: {},
        surfaces: ['web'],
        actionKind: 'local',
        owner: 'client',
        danger: 'safe',
        availability: { state: 'hidden' },
        coverage: 'not-applicable',
      });

      const filtered = filterCommands(commands);
      expect(filtered.every(c => c.availability.state !== 'hidden')).toBe(true);
    });

    it('should include hidden when requested', () => {
      const commands = [...mockCommands];
      commands.push({
        canonicalName: 'hidden',
        aliases: [],
        description: 'Hidden command',
        category: 'test',
        input: {},
        surfaces: ['web'],
        actionKind: 'local',
        owner: 'client',
        danger: 'safe',
        availability: { state: 'hidden' },
        coverage: 'not-applicable',
      });

      const filtered = filterCommands(commands, { includeHidden: true });
      expect(filtered.some(c => c.availability.state === 'hidden')).toBe(true);
    });
  });

  describe('sortCommands', () => {
    it('should sort alphabetically', () => {
      const sorted = sortCommands(mockCommands, 'alphabetical');
      expect(sorted[0].canonicalName).toBe('delete');
      expect(sorted[sorted.length - 1].canonicalName).toBe('resume');
    });

    it('should sort by category', () => {
      const sorted = sortCommands(mockCommands, 'category');
      expect(sorted[0].category).toBe('discovery');
      expect(sorted[sorted.length - 1].category).toBe('test');
    });
  });

  describe('findExactMatch', () => {
    it('should find by canonical name', () => {
      const found = findExactMatch(mockCommands, 'help');
      expect(found?.canonicalName).toBe('help');
    });

    it('should find by alias', () => {
      const found = findExactMatch(mockCommands, 'h');
      expect(found?.canonicalName).toBe('help');
    });

    it('should return null if not found', () => {
      const found = findExactMatch(mockCommands, 'nonexistent');
      expect(found).toBeNull();
    });

    it('should be case insensitive', () => {
      const found = findExactMatch(mockCommands, 'HELP');
      expect(found?.canonicalName).toBe('help');
    });

    it('should handle whitespace', () => {
      const found = findExactMatch(mockCommands, '  help  ');
      expect(found?.canonicalName).toBe('help');
    });
  });

  describe('findUniquePrefixMatch', () => {
    it('should find unique prefix match', () => {
      const found = findUniquePrefixMatch(mockCommands, 'he');
      expect(found?.canonicalName).toBe('help');
    });

    it('should return null if multiple matches', () => {
      const found = findUniquePrefixMatch(mockCommands, 'd');
      expect(found).toBeNull(); // delete and disabled-cmd
    });

    it('should return null if no match', () => {
      const found = findUniquePrefixMatch(mockCommands, 'xyz');
      expect(found).toBeNull();
    });
  });

  describe('getCategories', () => {
    it('should return unique sorted categories', () => {
      const categories = getCategories(mockCommands);
      expect(categories).toEqual(['discovery', 'session', 'test']);
    });
  });

  describe('groupByCategory', () => {
    it('should group commands by category', () => {
      const groups = groupByCategory(mockCommands);

      expect(groups.size).toBe(3);
      expect(groups.get('discovery')).toHaveLength(1);
      expect(groups.get('session')).toHaveLength(2);
      expect(groups.get('test')).toHaveLength(1);
    });
  });

  describe('isCommandExecutable', () => {
    it('should return true for available commands', () => {
      expect(isCommandExecutable(mockCommands[0])).toBe(true);
    });

    it('should return false for disabled commands', () => {
      expect(isCommandExecutable(mockCommands[3])).toBe(false);
    });
  });

  describe('requiresConfirmation', () => {
    it('should return true for confirm commands', () => {
      const cmd = { ...mockCommands[0], danger: 'confirm' as const };
      expect(requiresConfirmation(cmd)).toBe(true);
    });

    it('should return true for destructive commands', () => {
      expect(requiresConfirmation(mockCommands[2])).toBe(true);
    });

    it('should return false for safe commands', () => {
      expect(requiresConfirmation(mockCommands[0])).toBe(false);
    });
  });

  describe('isCommandDestructive', () => {
    it('should return true for destructive commands', () => {
      expect(isCommandDestructive(mockCommands[2])).toBe(true);
    });

    it('should return false for non-destructive commands', () => {
      expect(isCommandDestructive(mockCommands[0])).toBe(false);
    });
  });
});
