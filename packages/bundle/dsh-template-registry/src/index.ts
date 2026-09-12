export * from '@yeisme/dsh-template-registry'

// 装载门：host 入口必须是 cordis 插件形态（apply/inject/name）。
// Template registry 的真实 host face（服务/命令/transport）由后续切片交付；
// 当前为 no-op 占位，schema/类型照常导出供消费方与测试使用。
export const name = 'dsh-template-registry'
export const inject: readonly string[] = []
export function apply(_ctx: unknown): void {}
