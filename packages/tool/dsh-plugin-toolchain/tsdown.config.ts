import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/cli.ts'],
  outDir: 'lib',
  format: 'esm',
  dts: true,
  // 保持与既有 check 脚本一致的 Node 侧运行形态：单文件入口、无外部运行时依赖。
  // clean 只清 tsdown 自身产物阶段；tsc 先行作为类型门。
  clean: true,
})
