/**
 * /status command journey over the core slash runtime.
 *
 * The originating sessionRef is frozen at dispatch: focus moving to another
 * session while the command runs never retargets the plan. Lifecycle events
 * (command/run + command/done) carry the frozen sessionRef and correlationId,
 * and the result never enters the model transcript. No plan created here ever
 * issues a model send.
 */

import {
  generateCorrelationId,
  type InspectPlan,
  type SlashRuntime,
} from '@yeisme/dsh-client-ui-command-experience-core';
import { commandResultEntersTranscript } from './activity';
import type { CommandActivityEventV1 } from './shell';

export interface StatusCommandRunInput {
  readonly runtime: SlashRuntime;
  /** Frozen originating session; never a last-activity substitute. */
  readonly sessionRef?: string;
  /** Subcommand text typed after /status (e.g. 'tokens'). */
  readonly arg?: string;
  readonly correlationId?: string;
}

export interface StatusCommandRunResult {
  readonly plan: InspectPlan;
  readonly message: string;
  /** Frozen session binding; null when no session was available. */
  readonly sessionRef: string | null;
  readonly correlationId: string;
  readonly events: readonly CommandActivityEventV1[];
  /**
   * A command run only exists when the command executed against a session.
   * Missing-session and pure syntax answers create no run.
   */
  readonly runCreated: boolean;
  readonly entersTranscript: false;
}

export function runStatusCommand(input: StatusCommandRunInput): StatusCommandRunResult {
  const command = input.runtime.snapshot().commands.find(item => item.canonicalName === 'status');
  if (command === undefined) {
    throw new Error('status command is not registered in the directory');
  }
  const arg = input.arg?.trim() ?? '';
  const query = arg.length === 0 ? '/status' : `/status ${arg}`;
  const sessionRef = input.sessionRef;
  const correlationId = input.correlationId ?? generateCorrelationId();
  const result = input.runtime.execute(
    command,
    query,
    sessionRef === undefined ? undefined : { sessionRef },
  );
  const available = result.plan.kind !== 'unavailable';
  const runCreated = sessionRef !== undefined;
  const events: readonly CommandActivityEventV1[] = runCreated
    ? [
      { type: 'command/run', sessionRef, canonicalName: 'status', correlationId },
      {
        type: 'command/done',
        sessionRef,
        canonicalName: 'status',
        correlationId,
        status: available ? 'success' : 'failed',
        summary: result.message,
        ...(available ? {} : { reasonCode: 'unavailable' }),
      },
    ]
    : [];
  return {
    plan: result.plan,
    message: result.message,
    sessionRef: sessionRef ?? null,
    correlationId,
    events,
    runCreated,
    entersTranscript: commandResultEntersTranscript(),
  };
}
