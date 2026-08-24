/**
 * Command Experience Web Redaction Utilities
 *
 * Safe data redaction for telemetry, preferences, and evidence.
 * Only retains canonical command, coverage/capability, receipt status,
 * redacted digest, and correlation id.
 */

import type { CommandExperienceEntryV1, CommandReducerState } from '@yeisme/dsh-client-ui-command-experience-core';

/**
 * Redacted telemetry data - only safe, non-sensitive information
 */
export interface RedactedTelemetry {
  /** Canonical command name only */
  readonly canonicalCommand: string;
  /** Command coverage level */
  readonly coverage: string;
  /** Capability status */
  readonly capability: 'available' | 'disabled' | 'missing';
  /** Receipt status if available */
  readonly receiptStatus?: string | null;
  /** Redacted digest for matching */
  readonly redactedDigest: string;
  /** Correlation ID for tracing */
  readonly correlationId?: string;
  /** Timestamp (no absolute dates) */
  readonly timestamp: number;
}

/**
 * Sensitive patterns that must be redacted from logs/evidence
 */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/=]*[A-Za-z0-9\-._~+/]/gi, // Bearer tokens
  /sk-[A-Za-z0-9]{20,}/gi, // API keys
  /[A-Za-z0-9\-._~+/]{20,}/g, // Long token-like strings
  /password["\s:=]+[^\s"']+/gi, // Password fields
  /token["\s:=]+[^\s"']+/gi, // Token fields
  /secret["\s:=]+[^\s"']+/gi, // Secret fields
  /prompt["\s:=]+[^\s"']+/gi, // Prompt content
  /credential["\s:=]+[^\s"']+/gi, // Credential fields
  /\/\/[^@/]+@[^@/]+\//g, // URLs with userinfo
  /\/home\/[^\/]+/g, // Home directory paths
  /\/Users\/[^\/]+/g, // Users directory paths
  /\/tmp\/[^\/]+/g, // Temp file paths (some)
  /private.*tool.*args/gi, // Private tool arguments
  /provider.*payload/gi, // Provider payloads
  /raw.*prompt/gi, // Raw prompts
  /note.*body/gi, // Note bodies
  /title.*[:=].+/gi, // Titles with content
  /path.*[:=].+/gi, // Path values
  /\{[^}]*"model"[^}]*\}/gi, // Model provider objects
  /\{[^}]*"messages"[^}]*\}/gi, // Message arrays
];

/**
 * Generate redacted digest for matching without revealing content
 */
export function generateRedactedDigest(command: CommandExperienceEntryV1, state: CommandReducerState): string {
  const components = [
    command.canonicalName,
    command.coverage,
    command.actionKind,
    command.owner,
    state.state,
  ];

  // Simple hash - don't use crypto to avoid leaking patterns
  let hash = 0;
  const input = components.join('|');
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return `digest_${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

/**
 * Redact sensitive information from command state for telemetry
 */
export function redactCommandState(command: CommandExperienceEntryV1, state: CommandReducerState): RedactedTelemetry {
  return {
    canonicalCommand: command.canonicalName,
    coverage: command.coverage,
    capability: command.availability.state === 'available' ? 'available' :
               command.availability.state === 'disabled' ? 'disabled' : 'missing',
    receiptStatus: state.receipt?.status || undefined,
    redactedDigest: generateRedactedDigest(command, state),
    correlationId: state.correlationId || undefined,
    timestamp: Date.now(),
  };
}

/**
 * Redact sensitive information from text content (logs, evidence, etc.)
 */
export function redactTextContent(content: string): string {
  let redacted = content;

  // Apply all sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED]');
  }

  // Additional specific redactions
  return redacted
    .replace(/--\w+=[^\s]+/g, (match) => {
      // Keep flag names but redact values
      if (match.includes('--prompt=') || match.includes('--message=') || match.includes('--input=')) {
        return match.split('=')[0] + '=[REDACTED]';
      }
      return match;
    })
    .replace(/\/[\/a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/g, (match) => {
      // Redact potential file paths but keep structure
      if (match.includes('/home/') || match.includes('/Users/') || match.includes('/tmp/')) {
        return match.replace(/\/[^\/]+(?=\/|$)/g, '/[REDACTED]');
      }
      return match;
    });
}

/**
 * Validate that evidence or logs don't contain sensitive information
 */
export function validateNoSensitiveInfo(content: string): { valid: boolean; violations: string[] } {
  const violations: string[] = [];

  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      violations.push(...matches);
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}

/**
 * Create safe command log entry for evidence
 */
export function createSafeCommandLog(
  command: CommandExperienceEntryV1,
  state: CommandReducerState,
  additionalInfo?: Record<string, unknown>
): string {
  const telemetry = redactCommandState(command, state);
  const info = additionalInfo ? redactTextContent(JSON.stringify(additionalInfo)) : '';

  return `Command: ${telemetry.canonicalCommand} | ` +
         `Coverage: ${telemetry.coverage} | ` +
         `Capability: ${telemetry.capability} | ` +
         `Status: ${telemetry.receiptStatus || 'pending'} | ` +
         `Digest: ${telemetry.redactedDigest}` +
         (telemetry.correlationId ? ` | Correlation: ${telemetry.correlationId}` : '') +
         (info ? ` | Info: ${info}` : '');
}

/**
 * Redact evidence object for safe storage/transmission
 */
export function redactEvidence(evidence: {
  command: CommandExperienceEntryV1;
  state: CommandReducerState;
  stdout?: string;
  stderr?: string;
  env?: Record<string, string>;
  argv?: string[];
}): {
  safeTelemetry: RedactedTelemetry;
  redactedStdout?: string;
  redactedStderr?: string;
  redactedEnv?: Record<string, string>;
  redactedArgv?: string[];
} {
  const safeTelemetry = redactCommandState(evidence.command, evidence.state);

  const redactedEnv = evidence.env ? Object.fromEntries(
    Object.entries(evidence.env).map(([key, value]) => [
      key.toLowerCase().includes('secret') ||
      key.toLowerCase().includes('password') ||
      key.toLowerCase().includes('token') ||
      key.toLowerCase().includes('key')
        ? [key, '[REDACTED]']
        : [key, value]
    ])
  ) : undefined;

  const redactedArgv = evidence.argv ? evidence.argv.map(arg =>
    arg.includes('=') && arg.includes('--')
      ? arg.split('=')[0] + '=[REDACTED]'
      : redactTextContent(arg)
  ) : undefined;

  return {
    safeTelemetry,
    redactedStdout: evidence.stdout ? redactTextContent(evidence.stdout) : undefined,
    redactedStderr: evidence.stderr ? redactTextContent(evidence.stderr) : undefined,
    redactedEnv,
    redactedArgv,
  };
}
