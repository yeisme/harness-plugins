/** Same-process reference projection over the existing authorized Creator owner. */
import { createHash } from 'node:crypto'
import type { ComposerReferenceOwnerV1 } from '@yeisme/dsh-desktop-workbench'
import { validateCreatorStudioSnapshot, validateCreatorArtifactContent } from '@yeisme/dsh-creator-studio-host/contracts'
import { validateCreatorArtifactImage } from '@yeisme/dsh-creator-studio-host'
import type { CreatorOwnerProjectionV1, CreatorStudioGateway, CreatorStudioOwner } from '@yeisme/dsh-creator-studio-host'

function ownerAttestation(owner: CreatorOwnerProjectionV1 | undefined): string | undefined {
  if (owner === undefined) return undefined
  return JSON.stringify({ snapshotRef: owner.snapshotRef, snapshotVersion: owner.snapshotVersion,
    cursor: owner.cursor, sequence: owner.sequence, context: owner.context, transport: owner.transport,
    status: owner.status, freshness: owner.freshness, artifactWorkspace: owner.artifactWorkspace })
}

export function createCreatorReferenceOwner(
  gateway: Pick<CreatorStudioGateway, 'snapshot' | 'readArtifactContent'> & Partial<Pick<CreatorStudioGateway, 'readArtifactImage'>>,
  owner: CreatorStudioOwner,
  workspaceForSession: (sessionId: string) => string | undefined,
  isCurrent: () => boolean = () => true,
): ComposerReferenceOwnerV1 {
  const provider: ComposerReferenceOwnerV1 = {
    async resolve(input, signal) {
      signal.throwIfAborted()
      if (!isCurrent()) return undefined
      const claim = { ...input.reference,
        ...(input.reference.window === undefined ? {} : { window: { ...input.reference.window } }),
        ...(input.reference.region === undefined ? {} : { region: { ...input.reference.region } }) }
      const isImage = claim.scope === 'artifact/media' && (claim.kind === 'image' || claim.kind === 'image-region')
      const isBody = claim.scope === 'artifact/body' && ['file', 'selection', 'directory'].includes(claim.kind) && claim.region === undefined
      if (claim.owner !== owner || claim.intent !== 'content' || (!isImage && !isBody)) return undefined
      if (isImage) {
        if (claim.window !== undefined || (claim.kind === 'image' && claim.region !== undefined)) return undefined
        const region = claim.region
        if (claim.kind === 'image-region' && (region === undefined
          || ![region.x, region.y, region.width, region.height].every(Number.isFinite)
          || region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0
          || region.x + region.width > 1 || region.y + region.height > 1)) return undefined
      }
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
      const proof = matches[0]!.proof!
      if (proof.contentRevision === undefined) return undefined
      const content = isImage ? undefined : validateCreatorArtifactContent(await gateway.readArtifactContent(artifact))
      const image = isImage ? validateCreatorArtifactImage(await gateway.readArtifactImage?.(artifact, signal)) : undefined
      const resource = image ?? content
      signal.throwIfAborted()
      if (!isCurrent()) return undefined
      if (resource?.artifact.owner !== owner || resource.artifact.ref !== claim.ref || resource.artifact.version !== claim.version
        || resource.contentRevision !== proof.contentRevision
        || workspaceForSession(input.sessionId) !== snapshot.context.workspaceRef) return undefined
      // Snapshot identity includes directory generation, owner proof and full
      // authorization context. An intervening owner or permission change must
      // not label this independent body read with the previous proof.
      const latest = validateCreatorStudioSnapshot(await gateway.snapshot())
      signal.throwIfAborted()
      const latestOwner = latest?.owners.find(candidate => candidate.owner === owner)
      if (!isCurrent() || latest?.snapshotRef !== snapshot.snapshotRef
        || JSON.stringify(latest.context) !== JSON.stringify(snapshot.context)
        || ownerAttestation(latestOwner) !== ownerAttestation(projection)
        || workspaceForSession(input.sessionId) !== snapshot.context.workspaceRef) return undefined
      const bytes = image?.bytes ?? new TextEncoder().encode(content!.content)
      if (createHash('sha256').update(bytes).digest('hex') !== proof.digest) return undefined
      if (image !== undefined) {
        if (image.mediaType !== artifact.mediaType) return undefined
        return {
          id: claim.id, owner, ref: claim.ref, kind: claim.kind, intent: claim.intent,
          version: claim.version, digest: claim.digest, scope: claim.scope, label: artifact.title,
          ...(claim.region === undefined ? {} : { region: { ...claim.region } }),
          snapshot: { type: 'image', mediaType: image.mediaType, bytes },
        }
      }
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
        snapshot: { type: 'text', text, truncated: window !== undefined && (window.start > 0 || window.end < bytes.byteLength) },
      }
    },
    async refresh(input, signal) {
      signal.throwIfAborted()
      if (!isCurrent()) return undefined
      const reference = { ...input.reference, ...(input.reference.window === undefined ? {} : { window: { ...input.reference.window } }) }
      if (reference.owner !== owner || reference.intent !== 'content' || reference.scope !== 'artifact/body'
        || !['file', 'directory', 'selection'].includes(reference.kind) || reference.region !== undefined) return undefined
      const snapshot = validateCreatorStudioSnapshot(await gateway.snapshot())
      signal.throwIfAborted()
      if (!isCurrent() || snapshot?.context?.sessionRef !== input.sessionId
        || snapshot.context.workspaceRef !== workspaceForSession(input.sessionId)) return undefined
      const projection = snapshot.owners.find(candidate => candidate.owner === owner)
      if (projection?.status !== 'ready' || projection.freshness !== 'fresh') return undefined
      const items = projection.artifactWorkspace?.artifacts ?? []
      // Only a base projection identifies the current head of this same object.
      // A selected immutable candidate can be reauthorized at its own version,
      // but must never redirect to a newer candidate with another opaque ref.
      const heads = items.filter(item => item.artifact.owner === owner && item.artifact.ref === reference.ref)
      const matches = heads.length > 0
        ? heads.map(item => ({ artifact: item.artifact, proof: item.referenceProof }))
        : items.flatMap(item => item.candidates.map(candidate => ({ artifact: candidate.artifact, proof: candidate.referenceProof })))
          .filter(item => item.artifact?.owner === owner && item.artifact.ref === reference.ref && item.artifact.version === reference.version)
      if (matches.length !== 1) return undefined
      const { artifact, proof } = matches[0]!
      if (artifact === undefined || proof === undefined || proof.id !== reference.id || proof.kind !== reference.kind
        || proof.intent !== reference.intent || proof.scope !== reference.scope
        || (proof.freshness !== 'fresh' && proof.freshness !== 'frozen')) return undefined
      // Reuse full body/digest/context revalidation rather than trusting this
      // metadata read or bypassing the bounded selection checks.
      return provider.resolve({ ...input, reference: { ...reference, version: artifact.version, digest: proof.digest } }, signal)
    },
  }
  return provider
}
