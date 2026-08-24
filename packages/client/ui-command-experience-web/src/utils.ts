/**
 * Command Experience Web Utilities
 *
 * Helper functions for accessibility, labels, and command discovery.
 */

import type { CommandExperienceEntryV1 } from '@yeisme/dsh-client-ui-command-experience-core';
import { isCommandExecutable, requiresConfirmation, isCommandDestructive } from '@yeisme/dsh-client-ui-command-experience-core';

/**
 * Get accessibility label for command
 * Combines canonical name, description, and disabled state
 */
export function getCommandAccessibilityLabel(command: CommandExperienceEntryV1): string {
  const parts: string[] = [];

  // Canonical command name
  parts.push(command.canonicalName);

  // Description if available
  if (command.description) {
    parts.push('-');
    parts.push(command.description);
  }

  // Disabled reason
  const disabledReason = getCommandDisabledReason(command);
  if (disabledReason) {
    parts.push(`(Disabled: ${disabledReason})`);
  }

  // Destructive warning
  if (isCommandDestructive(command)) {
    parts.push('(Destructive action)');
  }

  return parts.join(' ');
}

/**
 * Get localized category label
 */
export function getCommandCategoryLabel(category: string): string {
  const categoryLabels: Record<string, string> = {
    'session': 'Session Commands',
    'model': 'Model & Reasoning',
    'permission': 'Permissions',
    'work': 'Work & Review',
    'utility': 'Utility Commands',
    'other': 'Other Commands',
  };

  return categoryLabels[category] || category;
}

/**
 * Get disabled reason for command
 * Returns null if command is executable
 */
export function getCommandDisabledReason(command: CommandExperienceEntryV1): string | null {
  if (isCommandExecutable(command)) {
    return null;
  }

  // Check availability state
  if (command.availability.state === 'disabled') {
    return command.availability.reason || 'Command is disabled';
  }

  if (command.availability.state === 'hidden') {
    return command.availability.reason || 'Command is hidden';
  }

  return 'Command not available';
}

/**
 * Check if command is unavailable (disabled or unavailable state)
 */
export function isCommandUnavailable(command: CommandExperienceEntryV1): boolean {
  return command.availability.state === 'disabled' || command.availability.state === 'hidden';
}

/**
 * Get command icon class (for future icon support)
 */
export function getCommandIconClass(command: CommandExperienceEntryV1): string {
  // Future: map command categories to icon classes
  return `command-icon command-icon--${command.category || 'other'}`;
}

/**
 * Sanitize command description for safe rendering
 * Prevents HTML injection and removes ANSI codes
 */
export function sanitizeCommandDescription(description: string): string {
  // Remove ANSI escape codes
  const ansiRemoved = description.replace(/\x1b\[[0-9;]*m/g, '');
  // Basic HTML escaping
  return ansiRemoved
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Format command canonical name for display
 * Adds `/` prefix if missing
 */
export function formatCommandCanonical(canonical: string): string {
  return canonical.startsWith('/') ? canonical : `/${canonical}`;
}

/**
 * Extract command name from canonical string
 * `/agent codex` -> `agent`
 */
export function extractCommandName(canonical: string): string {
  return canonical.replace(/^\//, '').split(/\s+/)[0];
}

/**
 * Check if command is a session command
 */
export function isSessionCommand(command: CommandExperienceEntryV1): boolean {
  return command.category === 'session' ||
         ['new', 'resume', 'fork', 'rename', 'compact', 'archive', 'delete'].includes(
           extractCommandName(command.canonicalName)
         );
}

/**
 * Check if command is a model/policy command
 */
export function isModelCommand(command: CommandExperienceEntryV1): boolean {
  return command.category === 'model' ||
         ['model', 'reasoning', 'permissions'].includes(
           extractCommandName(command.canonicalName)
         );
}

/**
 * Check if command requires owner action confirmation
 */
export function requiresOwnerConfirmation(command: CommandExperienceEntryV1): boolean {
  return requiresConfirmation(command) || isCommandDestructive(command);
}
