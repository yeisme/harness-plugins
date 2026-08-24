/**
 * Telemetry, preference, and evidence field allowlist.
 *
 * Allowed: canonical command, coverage/capability, receipt status,
 * redacted digest, correlation id.
 * Never persist prompt, full args, titles, paths, credentials,
 * provider payloads, or private tool args.
 */

export const TELEMETRY_ALLOWED_FIELDS = [
  'canonicalCommand',
  'coverage',
  'capability',
  'receiptStatus',
  'redactedDigest',
  'correlationId',
] as const;

export type TelemetryAllowedField = (typeof TELEMETRY_ALLOWED_FIELDS)[number];

export type TelemetryRecord = {
  readonly [K in TelemetryAllowedField]?: string | null;
};

const FORBIDDEN_KEY_PATTERN =
  /(prompt|args?|title|path|file|credential|password|secret|token|authorization|cookie|provider|payload|toolArgs?|privateTool|sessionTitle)/i;

const FORBIDDEN_VALUE_HINTS = [
  'sk-',
  'bearer ',
  'authorization:',
  '-----begin',
];

export interface RedactionResult {
  readonly record: TelemetryRecord;
  readonly droppedFields: readonly string[];
}

export function redactDigest(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `redacted:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function redactTelemetry(input: Record<string, unknown>): RedactionResult {
  const record: Record<string, string | null> = {};
  const droppedFields: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if ((TELEMETRY_ALLOWED_FIELDS as readonly string[]).includes(key)) {
      if (value === null || value === undefined) {
        record[key] = null;
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        record[key] = String(value);
      } else {
        droppedFields.push(key);
      }
      continue;
    }
    droppedFields.push(key);
  }

  return { record, droppedFields };
}

export function createUsageRecord(input: {
  readonly canonicalCommand: string;
  readonly coverage?: string | null;
  readonly capability?: string | null;
  readonly receiptStatus?: string | null;
  readonly correlationId?: string | null;
  readonly digestSource?: string;
}): TelemetryRecord {
  return redactTelemetry({
    canonicalCommand: input.canonicalCommand.replace(/^\//, ''),
    coverage: input.coverage ?? null,
    capability: input.capability ?? null,
    receiptStatus: input.receiptStatus ?? null,
    correlationId: input.correlationId ?? null,
    redactedDigest: input.digestSource === undefined ? null : redactDigest(input.digestSource),
  }).record;
}

export function collectForbiddenTelemetryKeys(
  value: unknown,
  path = '',
): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectForbiddenTelemetryKeys(entry, `${path}[${index}]`),
    );
  }
  if (typeof value !== 'object') {
    if (typeof value === 'string') {
      const lower = value.toLowerCase();
      if (FORBIDDEN_VALUE_HINTS.some((hint) => lower.includes(hint))) {
        return [path || '(value)'];
      }
    }
    return [];
  }

  const leaks: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const nextPath = path.length === 0 ? key : `${path}.${key}`;
    if (FORBIDDEN_KEY_PATTERN.test(key) && !(TELEMETRY_ALLOWED_FIELDS as readonly string[]).includes(key)) {
      leaks.push(nextPath);
    }
    leaks.push(...collectForbiddenTelemetryKeys(child, nextPath));
  }
  return leaks;
}

export function assertTelemetryAllowlist(value: unknown): {
  readonly ok: boolean;
  readonly leaks: readonly string[];
} {
  const leaks = collectForbiddenTelemetryKeys(value);
  return { ok: leaks.length === 0, leaks };
}
