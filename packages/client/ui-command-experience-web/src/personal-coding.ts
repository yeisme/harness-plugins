import {
  decodeDshPluginSurfaceContributionV1,
  type DshPluginActionContributionV1,
  type DshPluginCommandContributionV1,
  type DshPluginContributionStatusV1,
  type DshPluginViewContributionV1,
} from '@yeisme/dsh-plugin-contracts'

export interface PersonalCodingWebSurfaceV1 {
  readonly status: DshPluginContributionStatusV1
  readonly contribution_id: string | null
  readonly generation: number | null
  readonly reason: string
  readonly fix: string
  readonly commands: readonly DshPluginCommandContributionV1[]
  readonly views: readonly DshPluginViewContributionV1[]
  readonly actions: readonly DshPluginActionContributionV1[]
}

/**
 * Web V1 只消费稳定合同并保留宿主渲染；不新增面板，也不从 label/fix
 * 构造命令。未知版本、非 Web contribution 与无效 payload 均 fail closed。
 */
export function consumePersonalCodingWebSurfaceV1(input: unknown): PersonalCodingWebSurfaceV1 {
  const decoded = decodeDshPluginSurfaceContributionV1(input)
  if (!decoded.ok) {
    return { status: 'disabled', contribution_id: null, generation: null, reason: decoded.code, fix: 'Install a compatible dsh.plugin.surface.v1 provider.', commands: [], views: [], actions: [] }
  }
  const contribution = decoded.value
  if (!contribution.surfaces.includes('web')) {
    return { status: 'disabled', contribution_id: contribution.id, generation: contribution.generation, reason: 'surface.web_not_declared', fix: 'Enable the Web target in the contribution contract.', commands: [], views: [], actions: [] }
  }
  return {
    status: contribution.health.status,
    contribution_id: contribution.id,
    generation: contribution.generation,
    reason: contribution.health.reason,
    fix: contribution.health.fix,
    commands: contribution.commands,
    views: contribution.views,
    actions: contribution.actions,
  }
}
