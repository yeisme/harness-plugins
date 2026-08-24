/**
 * Safe / confirm / destructive grading and owner-preview gates.
 *
 * `/archive` and `/delete` stay staged/disabled unless the owner supplies
 * a preview and a receipt path. The plugin never recursively deletes.
 */

import type { CommandDanger, CommandExperienceEntryV1 } from './types';

export interface OwnerImpactPreview {
  readonly targetRef: string;
  readonly impactSummary: string;
  readonly reversible: boolean;
  readonly owner: 'dsh' | 'host';
  readonly descendantCount?: number;
  readonly capability: string;
}

export interface DangerGate {
  readonly grade: CommandDanger;
  readonly allowed: boolean;
  readonly staged: boolean;
  readonly reason: string | null;
}

const DESTRUCTIVE_CANONICAL = new Set(['delete', 'archive']);

export function canonicalCommandName(command: string | CommandExperienceEntryV1): string {
  const raw = typeof command === 'string' ? command : command.canonicalName;
  return raw.replace(/^\//, '').trim().toLowerCase();
}

export function gradeCommandDanger(
  command: string | CommandExperienceEntryV1,
): CommandDanger {
  if (typeof command !== 'string') {
    return command.danger;
  }
  const name = canonicalCommandName(command);
  if (name === 'delete') return 'destructive';
  if (name === 'archive') return 'confirm';
  return 'safe';
}

export function requiresOwnerPreview(
  command: string | CommandExperienceEntryV1,
): boolean {
  const name = canonicalCommandName(command);
  if (DESTRUCTIVE_CANONICAL.has(name)) {
    return true;
  }
  return gradeCommandDanger(command) !== 'safe';
}

/**
 * Gate destructive commands. Missing preview or receipt capability keeps
 * `/archive` and `/delete` staged/disabled. The plugin does not invent impact.
 */
export function evaluateDangerGate(input: {
  readonly command: string | CommandExperienceEntryV1;
  readonly preview: OwnerImpactPreview | null;
  readonly receiptCapable: boolean;
}): DangerGate {
  const grade = gradeCommandDanger(input.command);
  const name = canonicalCommandName(input.command);
  const needsPreview = requiresOwnerPreview(input.command);

  if (!needsPreview) {
    return { grade, allowed: true, staged: false, reason: null };
  }

  if (!input.receiptCapable) {
    return {
      grade,
      allowed: false,
      staged: true,
      reason: `/${name} stays staged until owner receipt is available`,
    };
  }

  if (input.preview === null) {
    return {
      grade,
      allowed: false,
      staged: true,
      reason: `/${name} stays staged until owner preview is available`,
    };
  }

  if (input.preview.targetRef.trim().length === 0) {
    return {
      grade,
      allowed: false,
      staged: true,
      reason: `/${name} stays staged because owner preview omitted a target`,
    };
  }

  return { grade, allowed: true, staged: false, reason: null };
}

/**
 * Plugin delete/archive must submit only the owner-authored target ref.
 * Passing descendant lists or paths is rejected so the plugin cannot
 * recursively delete.
 */
export function refusePluginRecursiveDelete(input: {
  readonly targetRef: string;
  readonly descendants?: readonly unknown[];
  readonly paths?: readonly string[];
  readonly recursive?: boolean;
}): { readonly ok: true; readonly targetRef: string } | { readonly ok: false; readonly reason: string } {
  if (input.recursive === true) {
    return { ok: false, reason: 'Plugin must not recursively delete' };
  }
  if (input.descendants !== undefined && input.descendants.length > 0) {
    return { ok: false, reason: 'Plugin must not enumerate or delete descendants' };
  }
  if (input.paths !== undefined && input.paths.length > 0) {
    return { ok: false, reason: 'Plugin must not delete by filesystem path' };
  }
  if (input.targetRef.trim().length === 0) {
    return { ok: false, reason: 'Owner target ref is required' };
  }
  return { ok: true, targetRef: input.targetRef };
}
