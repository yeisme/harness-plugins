import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService, remoteMethods } from '@deepseek-ai/dsh-typert-protocol'
import type { DevtoolsService } from './service.ts'
import { DEVTOOLS_SERVICE_KEY, type DevtoolsCpuProfileAnswerV1, type DevtoolsCpuProfileInputV1, type DevtoolsSnapshotAnswerV1, type DevtoolsSnapshotInputV1 } from './types.ts'

export class DevtoolsRemoteService extends TypertRemoteService {
  constructor(ctx: Context, private readonly service: DevtoolsService) {
    super(ctx, DEVTOOLS_SERVICE_KEY)
  }

  @Remote
  async snapshot(input: DevtoolsSnapshotInputV1 = {}): Promise<DevtoolsSnapshotAnswerV1> {
    return this.service.snapshot(input)
  }

  @Remote
  async captureCpuProfile(input: DevtoolsCpuProfileInputV1 = {}): Promise<DevtoolsCpuProfileAnswerV1> {
    return this.service.captureCpuProfile(input)
  }
}

export function devtoolsRemoteMarkers(service: DevtoolsRemoteService) {
  return remoteMethods(service)
}
