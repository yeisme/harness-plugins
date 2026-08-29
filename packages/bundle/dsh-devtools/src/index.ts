import { apply as hostApply, inject as hostInject } from '@yeisme/dsh-devtools-host'

export const name = 'dsh-devtools'
export const inject = hostInject
export const apply = hostApply

const DshDevtoolsPlugin = { name, inject, apply }
export default DshDevtoolsPlugin
