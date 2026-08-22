/**
 * Profile metadata store (Phase 1). Every mutation funnels through
 * `parseProfileMeta`, so a serialized store provably contains no credential
 * values — deserialize fails closed on any forbidden or invalid entry.
 *
 * @module @yeisme/dsh-client-ui-session-cookie-manager
 */

import { parseProfileMeta, type ProfileMetaV1 } from './profile-types.ts'

export class ProfileStoreError extends Error {
  override readonly name = 'ProfileStoreError'
  constructor(readonly code: 'not_found' | 'invalid', message: string) {
    super(message)
  }
}

export interface ProfileStoreOptions {
  /** Deterministic id factory for tests. */
  idFactory?: (() => string) | undefined
  /** Deterministic clock for tests; ISO string. */
  now?: (() => string) | undefined
}

export interface CreateProfileInput {
  siteScope: string
  displayName: string
  accountSummary?: string
  capabilities?: readonly string[]
}

function defaultIdFactory(): string {
  return `profile-${Math.random().toString(36).slice(2, 10)}`
}

/** In-memory metadata store with fail-closed (de)serialization. */
export class ProfileStore {
  private readonly profiles = new Map<string, ProfileMetaV1>()
  private readonly idFactory: () => string
  private readonly now: () => string

  constructor(options: ProfileStoreOptions = {}) {
    this.idFactory = options.idFactory ?? defaultIdFactory
    this.now = options.now ?? (() => new Date().toISOString())
  }

  list(): readonly ProfileMetaV1[] {
    return [...this.profiles.values()].sort((a, b) => a.profileId.localeCompare(b.profileId))
  }

  create(input: CreateProfileInput): ProfileMetaV1 {
    const timestamp = this.now()
    const candidate = {
      profileId: this.idFactory(),
      siteScope: input.siteScope,
      displayName: input.displayName,
      ...input.accountSummary === undefined ? {} : { accountSummary: input.accountSummary },
      capabilities: [...(input.capabilities ?? ['apply'])],
      createdAt: timestamp,
      updatedAt: timestamp,
    }
    const parsed = parseProfileMeta(candidate)
    if (!parsed.ok) throw new ProfileStoreError('invalid', parsed.error)
    this.profiles.set(parsed.value.profileId, parsed.value)
    return parsed.value
  }

  rename(profileId: string, displayName: string): ProfileMetaV1 {
    const current = this.profiles.get(profileId)
    if (current === undefined) throw new ProfileStoreError('not_found', `profile ${profileId} not found`)
    const parsed = parseProfileMeta({ ...current, displayName, updatedAt: this.now() })
    if (!parsed.ok) throw new ProfileStoreError('invalid', parsed.error)
    this.profiles.set(profileId, parsed.value)
    return parsed.value
  }

  remove(profileId: string): boolean {
    return this.profiles.delete(profileId)
  }

  /** Serialize: only parser-validated metadata ever reaches the string. */
  serialize(): string {
    return JSON.stringify(this.list())
  }

  /** Deserialize: any forbidden or invalid entry fails the whole load. */
  static deserialize(text: string): ProfileStore {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      throw new ProfileStoreError('invalid', 'store payload is not JSON')
    }
    if (!Array.isArray(parsed)) throw new ProfileStoreError('invalid', 'store payload must be an array')
    const store = new ProfileStore()
    for (const entry of parsed) {
      const result = parseProfileMeta(entry)
      if (!result.ok) throw new ProfileStoreError('invalid', result.error)
      store.profiles.set(result.value.profileId, result.value)
    }
    return store
  }
}
