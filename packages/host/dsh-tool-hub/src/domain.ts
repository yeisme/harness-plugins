/**
 * `yeisme_tool_hub_v1` storage domain: one prefs row of disabled item ids.
 *
 * @module @yeisme/dsh-tool-hub-host/domain
 */

import { z } from 'zod'
import type { DomainSpec, DomainTableSpec } from '@deepseek-ai/dsh-storage-domain'
import { TOOL_HUB_DOMAIN } from './constants.ts'

export type PrefsKey = string

export interface ToolHubPrefsRowV1 {
  readonly disabled: readonly string[]
  readonly version: string
  readonly updatedAt: number
}

export const toolHubPrefsRowSchema: z.ZodType<ToolHubPrefsRowV1> = z.object({
  disabled: z.array(z.string()).max(400),
  version: z.string(),
  updatedAt: z.number(),
}).strict()

export interface ToolHubDomainSpec extends DomainSpec {
  readonly name: typeof TOOL_HUB_DOMAIN
  readonly version: 1
  readonly tables: {
    readonly prefs: DomainTableSpec<PrefsKey, ToolHubPrefsRowV1>
  }
}

const NAME_RE = /^[a-z][a-z0-9_]*$/

function buildSpec(): ToolHubDomainSpec {
  if (!NAME_RE.test(TOOL_HUB_DOMAIN)) {
    throw new Error(`invalid tool-hub domain name: ${TOOL_HUB_DOMAIN}`)
  }
  return {
    name: TOOL_HUB_DOMAIN,
    version: 1,
    tables: {
      prefs: { valueSchema: toolHubPrefsRowSchema },
    },
  }
}

export const toolHubDomainSpec: ToolHubDomainSpec = Object.freeze(buildSpec())
