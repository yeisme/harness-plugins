/** Thin Typert Remote adapter for `sessionOrganization` v1. */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { SESSION_ORGANIZATION_REMOTE_SERVICE_KEY } from './constants.ts'
import type { SessionOrganizationSidecar } from './organization-service.ts'
import type {
  BatchActionV1,
  PutFunctionTypeInputV1,
  PutRuleInputV1,
  PutTagCatalogInputV1,
  SetAssignmentInputV1,
} from './organization-wire.ts'

export class SessionOrganizationRemoteService extends TypertRemoteService {
  private readonly sidecar: SessionOrganizationSidecar

  constructor(ctx: Context, sidecar: SessionOrganizationSidecar) {
    super(ctx, SESSION_ORGANIZATION_REMOTE_SERVICE_KEY)
    this.sidecar = sidecar
  }

  @Remote
  snapshot() {
    return this.sidecar.snapshot()
  }

  @Remote
  setAssignment(input: SetAssignmentInputV1) {
    return this.sidecar.setAssignment(input)
  }

  @Remote
  putFunctionType(input: PutFunctionTypeInputV1) {
    return this.sidecar.putFunctionType(input)
  }

  @Remote
  putTagCatalog(input: PutTagCatalogInputV1) {
    return this.sidecar.putTagCatalog(input)
  }

  @Remote
  putRule(input: PutRuleInputV1) {
    return this.sidecar.putRule(input)
  }

  @Remote
  classify(input: {
    readonly sessionId: string
    readonly workspaceRef: string
    readonly title: string
    readonly userMessages: readonly string[]
    readonly force?: boolean | undefined
  }) {
    return this.sidecar.classify(input)
  }

  @Remote
  planBatch(input: { readonly targets: readonly { readonly sessionId: string; readonly workspaceRef: string }[]; readonly action: BatchActionV1 }) {
    return this.sidecar.planBatch(input)
  }

  @Remote
  unlockAdmin() {
    return this.sidecar.unlockAdmin()
  }

  @Remote
  executeBatch(input: {
    readonly planId: string
    readonly decisionRef: string
    readonly confirmationText?: string | undefined
    readonly adminToken?: string | undefined
  }) {
    return this.sidecar.executeBatch(input)
  }

  @Remote
  undoBatch(input: { readonly receiptId: string }) {
    return this.sidecar.undoBatch(input)
  }
}

export function sessionOrganizationRemoteMarkers(service: SessionOrganizationRemoteService) {
  return remoteMethods(service)
}
