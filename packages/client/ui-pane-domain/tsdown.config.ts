import { defineConfig } from 'tsdown'
import { inlineCssPlugin } from '../../../scripts/inline-css-plugin.mjs'

export default defineConfig({ plugins: [inlineCssPlugin()] })
