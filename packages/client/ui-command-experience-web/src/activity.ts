/**
 * Durable Activity is restored only from official command/run|done events.
 * The client never keeps a second log and never injects results into the
 * model transcript.
 */

export function commandResultEntersTranscript(): false {
  return false;
}

export function activityContainsForbidden(payload: unknown): boolean {
  return /(raw prompt|provider payload|private args|api[_-]?key|authorization|sk-[a-z0-9]|\/home\/)/iu
    .test(JSON.stringify(payload));
}
