import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'
import type { SkillReferenceReader, SkillReferenceReadInputV1, SkillReferenceReadAnswerV1 } from './reference-reader.ts'

/** Dedicated content channel; catalog snapshots never contain document bodies. */
export class SkillReferenceRemoteService extends TypertRemoteService {
  constructor(ctx: Context, private readonly reader: SkillReferenceReader) {
    super(ctx, 'toolReferences')
  }

  @Remote
  readSkill(input: SkillReferenceReadInputV1, signal: AbortSignal): Promise<SkillReferenceReadAnswerV1> {
    return this.reader.readSkill(input, signal)
  }
}
