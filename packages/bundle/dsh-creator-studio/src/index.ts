/**
 * Single install surface for the DSH Creator Studio.
 *
 * This package composes safe owner projections and a browser Pane client. The
 * six domain owners retain canonical resources, actions, jobs, approvals, and
 * receipts; this bundle never creates a second ledger or scheduler.
 */

import type { Context } from '@deepseek-ai/cordis'
import {
  CREATOR_STUDIO_OWNER_DIRECTORY,
  CreatorStudioGateway,
  CreatorStudioOwnerDirectory,
  type CreatorOwnerAdapterV1,
  type CreatorStudioTransportPolicyV1,
} from '@yeisme/dsh-creator-studio-host'

export {
  CREATOR_STUDIO_EXPECTED_CONTEXT,
  CREATOR_STUDIO_OWNER_DIRECTORY,
  CreatorStudioGateway,
  CreatorStudioOwnerDirectory,
  validateCreatorActionDescriptor,
  validateCreatorActionReceipt,
  validateCreatorMediaAccess,
  validateCreatorOwnerSnapshot,
  validateCreatorStudioContext,
  validateCreatorStudioSnapshot,
} from '@yeisme/dsh-creator-studio-host'
export type {
  CreatorJobV1,
  CreatorMediaAccessV1,
  CreatorOwnerAdapterV1,
  CreatorOwnerProjectionV1,
  CreatorOwnerSnapshotV1,
  CreatorProductionV1,
  CreatorResourceV1,
  CreatorReviewV1,
  CreatorStudioContextV1,
  CreatorStudioOwner,
  CreatorStudioSnapshotV1,
  CreatorStudioTask,
  CreatorStudioTransportPolicyV1,
} from '@yeisme/dsh-creator-studio-host'

type FiberHandle = { dispose(): Promise<void> }

type SharedCreatorStudioMount = {
  references: number
  tail: Promise<void>
  bridge?: FiberHandle | undefined
  directory?: CreatorStudioOwnerDirectory | undefined
  disposeDirectory?: (() => void) | undefined
}

const CREATOR_STUDIO_MOUNTS = Symbol.for('yeisme.dsh-creator-studio.host-mounts.v1')
const CREATOR_STUDIO_TRANSPORT_POLICY = 'creatorStudioTransportPolicy'

function mounts(): WeakMap<object, SharedCreatorStudioMount> {
  const store = globalThis as typeof globalThis & Record<symbol, unknown>
  const existing = store[CREATOR_STUDIO_MOUNTS]
  if (existing instanceof WeakMap) return existing as WeakMap<object, SharedCreatorStudioMount>
  const created = new WeakMap<object, SharedCreatorStudioMount>()
  store[CREATOR_STUDIO_MOUNTS] = created
  return created
}

function isTransportPreference(value: unknown): value is 'auto' | 'local' | 'service' {
  return value === 'auto' || value === 'local' || value === 'service'
}

function transportPolicyOf(root: Context): CreatorStudioTransportPolicyV1 {
  const candidate = root.get(CREATOR_STUDIO_TRANSPORT_POLICY) as Partial<CreatorStudioTransportPolicyV1> | undefined
  if (candidate === undefined || !isTransportPreference(candidate.default)) return { default: 'auto' }
  const owners = candidate.owners
  if (owners !== undefined && Object.values(owners).some(value => value !== undefined && !isTransportPreference(value))) return { default: 'auto' }
  return { default: candidate.default, ...(owners === undefined ? {} : { owners }) }
}

function directoryOf(root: Context): CreatorStudioOwnerDirectory | undefined {
  const candidate = root.get(CREATOR_STUDIO_OWNER_DIRECTORY) as CreatorStudioOwnerDirectory | undefined
  if (candidate === undefined) return undefined
  if (typeof candidate.register !== 'function' || typeof candidate.selected !== 'function') {
    throw new TypeError('creatorStudioOwnerDirectory does not implement the Creator Studio directory contract')
  }
  return candidate
}

async function acquireCreatorStudio(ctx: Context): Promise<() => Promise<void>> {
  const root = ctx.root
  const store = mounts()
  let mount = store.get(root)
  if (mount === undefined) {
    mount = { references: 0, tail: Promise.resolve() }
    store.set(root, mount)
  }
  mount.references += 1
  const current = mount
  const setup = current.tail.then(async () => {
    if (current.directory === undefined) {
      const existing = directoryOf(root)
      if (existing !== undefined) current.directory = existing
      else {
        const directory = new CreatorStudioOwnerDirectory(transportPolicyOf(root))
        current.directory = directory
        current.disposeDirectory = root.provide(CREATOR_STUDIO_OWNER_DIRECTORY, directory)
      }
    }
    if (current.bridge === undefined && root.get('creatorStudio') === undefined) {
      current.bridge = await root.plugin(CreatorStudioGateway)
    }
  })
  current.tail = setup.catch(() => undefined)
  try {
    await setup
  } catch (error) {
    await releaseCreatorStudio(root, current)
    throw error
  }
  let released = false
  return async () => {
    if (released) return
    released = true
    await releaseCreatorStudio(root, current)
  }
}

async function releaseCreatorStudio(root: Context, mount: SharedCreatorStudioMount): Promise<void> {
  if (mount.references > 0) mount.references -= 1
  if (mount.references !== 0) return
  const teardown = mount.tail.then(async () => {
    const bridge = mount.bridge
    const disposeDirectory = mount.disposeDirectory
    mount.bridge = undefined
    mount.directory = undefined
    mount.disposeDirectory = undefined
    await bridge?.dispose()
    disposeDirectory?.()
    const store = mounts()
    if (mount.references === 0 && store.get(root) === mount) store.delete(root)
  })
  mount.tail = teardown.catch(() => undefined)
  await teardown
}

/** Register a local or service owner adapter after this bundle has mounted. */
export function registerCreatorStudioOwner(ctx: Context, adapter: CreatorOwnerAdapterV1): () => void {
  const directory = directoryOf(ctx.root)
  if (directory === undefined) throw new Error('Creator Studio is not mounted; install the bundle before registering an owner adapter')
  return directory.register(adapter)
}

export const creatorStudioBundleV1 = {
  id: 'dsh-creator-studio',
  version: '0.1.0-rc.1',
  owners: ['eikona', 'scaena', 'sonora', 'auctra', 'pinax', 'anatomia'],
  tasks: ['text', 'image', 'audio', 'video', 'review', 'analysis', 'context', 'operations'],
} as const

export type CreatorStudioBundleV1 = typeof creatorStudioBundleV1

export const name = 'dsh-creator-studio'
export const inject: readonly string[] = []

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  return acquireCreatorStudio(ctx)
}

const CreatorStudioPlugin = { name, inject, apply }
export default CreatorStudioPlugin
