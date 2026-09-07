import {build} from 'tsdown'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'temp/ui-visual-native-menu')
const require=createRequire(resolve(root,'packages/client/ui-mcp-inspector/package.json'))
await mkdir(output,{recursive:true})
await writeFile(resolve(output,'entry.mjs'),`export { Menu } from ${JSON.stringify(require.resolve('@deepseek-ai/dsh-client-ui-primitives'))};\nexport { ExplorerTree } from ${JSON.stringify(resolve(root,'packages/client/ui-pane-workbench/src/explorer/tree-ui.tsx'))};\nexport { createExplorerTreeState, reduceExplorerTree } from ${JSON.stringify(resolve(root,'packages/client/ui-pane-workbench/src/explorer/tree-state.ts'))};\n`)
await build({config:false,entry:{'native-menu':resolve(output,'entry.mjs')},outDir:output,format:'esm',platform:'browser',dts:false,clean:false,sourcemap:false,outputOptions:{codeSplitting:false},logLevel:'silent',deps:{neverBundle:['react','react/jsx-runtime','react-dom','@yeisme/dsh-client-ui-surface','@yeisme/dsh-client-ui-visual-kit']},plugins:[{name:'unused-markdown-css',resolveId(id){if(id==='katex/dist/katex.min.css')return '\0fixture-unused-markdown-css'},load(id){if(id==='\0fixture-unused-markdown-css')return 'export {}'}}]})
