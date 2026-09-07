/** Same-process reference projection over the existing authorized Creator owner. */
import type { ComposerReferenceOwnerV1 } from '@yeisme/dsh-desktop-workbench'
import { validateCreatorStudioSnapshot, validateCreatorArtifactContent } from '@yeisme/dsh-creator-studio-host/contracts'
import type { CreatorStudioGateway, CreatorStudioOwner } from '@yeisme/dsh-creator-studio-host'

export function createCreatorReferenceOwner(
  gateway: Pick<CreatorStudioGateway, 'snapshot' | 'readArtifactContent'>,
  owner: CreatorStudioOwner,
  workspaceForSession: (sessionId: string) => string | undefined,
): ComposerReferenceOwnerV1 {
  return {
    async resolve(input, signal) {
      signal.throwIfAborted()
      const claim = input.reference
      if (claim.owner !== owner || claim.intent !== 'content' || claim.scope !== 'artifact/body'
        || !['file', 'selection', 'directory'].includes(claim.kind) || claim.region !== undefined) return undefined
      const snapshot = validateCreatorStudioSnapshot(await gateway.snapshot())
      signal.throwIfAborted()
      if (snapshot?.context?.sessionRef !== input.sessionId
        || snapshot.context.workspaceRef !== workspaceForSession(input.sessionId)) return undefined
      const projection = snapshot.owners.find(candidate => candidate.owner === owner)
      if (projection?.status !== 'ready' || projection.freshness !== 'fresh') return undefined
      const matches = (projection.artifactWorkspace?.artifacts ?? []).flatMap(item => [
        { artifact: item.artifact, proof: item.referenceProof },
        ...item.candidates.map(candidate => ({ artifact: candidate.artifact, proof: candidate.referenceProof })),
      ]).filter(({ artifact, proof }) => artifact?.owner === owner && artifact.ref === claim.ref
        && artifact.version === claim.version && proof?.id === claim.id && proof.kind === claim.kind
        && proof.intent === claim.intent && proof.scope === claim.scope && proof.digest === claim.digest
        && (proof.freshness === 'fresh' || proof.freshness === 'frozen'))
      if (matches.length !== 1) return undefined
      const artifact = matches[0]!.artifact!
      const content = validateCreatorArtifactContent(await gateway.readArtifactContent(artifact))
      signal.throwIfAborted()
      if (content?.artifact.owner !== owner || content.artifact.ref !== claim.ref || content.artifact.version !== claim.version
        || workspaceForSession(input.sessionId) !== snapshot.context.workspaceRef) return undefined
      const bytes = new TextEncoder().encode(content.content)
      const window = claim.window
      if (claim.kind === 'selection' && window === undefined) return undefined
      if (window !== undefined && (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end)
        || window.start < 0 || window.end <= window.start || window.end > bytes.byteLength)) return undefined
      const selected = window === undefined ? bytes : bytes.subarray(window.start, window.end)
      if (selected.byteLength > 16_384) return undefined
      let text: string
      try { text = new TextDecoder('utf-8', { fatal: true }).decode(selected) } catch { return undefined }
      return {
        id: claim.id, owner, ref: claim.ref, kind: claim.kind, intent: claim.intent,
        version: claim.version, digest: claim.digest, scope: claim.scope,
        ...(window === undefined ? {} : { window: { ...window } }),
        label: artifact.title, preview: text.replace(/\s+/gu, ' ').trim().slice(0, 240),
        snapshot: { type: 'text', text, truncated: false },
      }
    },
  }
}
