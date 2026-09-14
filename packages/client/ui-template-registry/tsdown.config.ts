import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const clientExternals = [
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime/client',
  // ui-primitives 由宿主 ModuleLoader 提供（内联会拖入 katex css）。
  '@deepseek-ai/dsh-client-ui-primitives',
] as const

// tsc 先产 lib/types；tsdown 复用同目录且不 clean，避免互删。
export default defineConfig([
  { entry: { index: 'src/index.tsx' }, outDir: 'lib', format: 'esm', dts: true, clean: false, platform: 'neutral', external: [...clientExternals] },
  { entry: { client: 'src/client.tsx' }, outDir: 'lib', format: 'esm', dts: true, clean: false, platform: 'browser', external: [...clientExternals] },
])
