/**
 * Sanitize untrusted plugin command descriptors.
 *
 * Description/icon/category are display-only. ANSI, HTML, remote code,
 * dynamic import, and global shortcut injection cannot change execution
 * or terminal control.
 */

export interface DescriptorSanitizeInput {
  readonly description?: unknown;
  readonly icon?: unknown;
  readonly category?: unknown;
  readonly shortcut?: unknown;
  readonly execute?: unknown;
  readonly importSpecifier?: unknown;
}

export interface SanitizedDescriptor {
  readonly description: string;
  readonly icon: string | null;
  readonly category: string;
  readonly rejected: readonly string[];
  readonly trustedForExecution: false;
}

const ANSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]|\u001b[()][AB012]|[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const HTML_PATTERN = /<\/?[a-z][\s\S]*>/i;
const REMOTE_CODE_PATTERN = /\b(?:https?:|data:|javascript:|vbscript:|file:)/i;
const DYNAMIC_IMPORT_PATTERN = /\bimport\s*\(|\bFunction\s*\(|\beval\s*\(|new\s+Function\b|\brequire\s*\(/i;
const GLOBAL_SHORTCUT_PATTERN =
  /\b(?:globalShortcut|registerHotkey|addEventListener|onkeydown|process\.stdin|rawMode|\\x1b)\b/i;
const SAFE_ICON = /^[a-z0-9][a-z0-9:_-]{0,47}$/i;
const SAFE_CATEGORY = /^[a-z0-9][a-z0-9 _/-]{0,47}$/i;

export function stripAnsi(value: string): string {
  return value.replace(ANSI_PATTERN, '');
}

export function escapeDisplayText(value: string): string {
  return stripAnsi(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export function sanitizeCommandDescriptor(
  input: DescriptorSanitizeInput,
): SanitizedDescriptor {
  const rejected: string[] = [];
  const rawDescription = asString(input.description);
  const rawIcon = asString(input.icon);
  const rawCategory = asString(input.category);
  const rawShortcut = asString(input.shortcut);
  const importSpecifier = asString(input.importSpecifier);

  const inspect = `${rawDescription}\n${rawIcon}\n${rawCategory}\n${rawShortcut}\n${importSpecifier}`;

  if (inspect.replace(ANSI_PATTERN, '') !== inspect) {
    rejected.push('ansi');
  }
  if (HTML_PATTERN.test(inspect)) {
    rejected.push('html');
  }
  if (REMOTE_CODE_PATTERN.test(inspect)) {
    rejected.push('remote-code');
  }
  if (DYNAMIC_IMPORT_PATTERN.test(inspect) || importSpecifier.length > 0) {
    rejected.push('dynamic-import');
  }
  if (GLOBAL_SHORTCUT_PATTERN.test(inspect) || rawShortcut.length > 0) {
    rejected.push('global-shortcut');
  }
  if (typeof input.execute === 'function') {
    rejected.push('untrusted-execute');
  }

  const description = escapeDisplayText(rawDescription).slice(0, 240);
  const icon = rawIcon.length > 0 && SAFE_ICON.test(rawIcon) && rejected.length === 0
    ? rawIcon
    : null;
  const category = SAFE_CATEGORY.test(rawCategory.trim())
    ? rawCategory.trim().toLowerCase()
    : 'other';

  if (rawIcon.length > 0 && icon === null && !rejected.includes('html')) {
    rejected.push('unsafe-icon');
  }

  return {
    description,
    icon,
    category,
    rejected: Array.from(new Set(rejected)),
    trustedForExecution: false,
  };
}
