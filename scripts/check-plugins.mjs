// pnpm check:plugins 统一入口（G18 §1.3）：委托 packages/tool/dsh-plugin-toolchain CLI。
// 参数透传：--baseline / --only=a,b / --report-root=... / --no-report。
import { main } from '@yeisme/dsh-plugin-toolchain/cli'

process.exitCode = await main(process.argv.slice(2))
