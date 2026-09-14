/**
 * `toolHub` Typert Remote. Thin forwarder; sidecar owns state.
 *
 * @module @yeisme/dsh-tool-hub-host/remote
 */

import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import { TOOL_HUB_REMOTE_SERVICE_KEY } from './constants.ts'
import type { ToolHubSidecar } from './service.ts'
import type { ToolHubCatalogAnswerV1, ToolHubConnectDocAnswerV1, ToolHubRediscoverAnswerV1, ToolHubSetEnabledAnswerV1, ToolHubSetEnabledInputV1 } from './wire.ts'

export class ToolHubRemoteService extends TypertRemoteService {
  private readonly sidecar: ToolHubSidecar

  constructor(ctx: Context, sidecar: ToolHubSidecar) {
    super(ctx, TOOL_HUB_REMOTE_SERVICE_KEY)
    this.sidecar = sidecar
  }

  @Remote
  async list(): Promise<ToolHubCatalogAnswerV1> {
    return this.sidecar.list()
  }

  @Remote
  async setEnabled(input: ToolHubSetEnabledInputV1): Promise<ToolHubSetEnabledAnswerV1> {
    return this.sidecar.setEnabled(input)
  }

  @Remote
  async connectDoc(): Promise<ToolHubConnectDocAnswerV1> {
    return this.sidecar.connectDocRead()
  }

  @Remote
  async rediscover(): Promise<ToolHubRediscoverAnswerV1> {
    return this.sidecar.rediscover()
  }
}

export function toolHubRemoteMarkers(service: ToolHubRemoteService) {
  return remoteMethods(service)
}
