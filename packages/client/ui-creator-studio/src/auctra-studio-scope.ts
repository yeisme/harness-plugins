/** Scope identity for discarding late owner responses after a project, session, or version switch. */
export function auctraStudioScopeKey(input: { readonly projectRef?: string | undefined; readonly sessionRef?: string | undefined; readonly artifactVersion?: string | undefined }): string {
  return JSON.stringify([input.projectRef ?? '', input.sessionRef ?? '', input.artifactVersion ?? ''])
}

export function auctraStudioAcceptsResponse(current: string, origin: string): boolean {
  return current === origin && current !== ''
}
