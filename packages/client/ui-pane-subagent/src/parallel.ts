/** Bounded steering directive for Parallel/Swarm mode. This is a request, not a guarantee. */

export const PARALLEL_DIRECTIVE = '[parallel mode] Break the task into independent subtasks, run them with the subagent tool in parallel when possible, then summarize the results.'

export const PARALLEL_DIRECTIVE_MAX_CHARS = 200

export function wrapParallelDirective(text: string): string {
  const directive = PARALLEL_DIRECTIVE.slice(0, PARALLEL_DIRECTIVE_MAX_CHARS)
  return `${directive}\n${text}`
}
