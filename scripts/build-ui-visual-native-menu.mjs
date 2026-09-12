import {build} from 'tsdown'
import {createRequire} from 'node:module'
import {mkdir,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'..'),output=resolve(root,'temp/ui-visual-native-menu')
const require=createRequire(resolve(root,'packages/client/ui-mcp-inspector/package.json'))
await mkdir(output,{recursive:true})
await writeFile(resolve(output,'entry.mjs'),`export { Menu } from ${JSON.stringify(require.resolve('@deepseek-ai/dsh-client-ui-primitives'))};\nexport { ExplorerTree } from ${JSON.stringify(resolve(root,'packages/client/ui-pane-workbench/src/explorer/tree-ui.tsx'))};\nexport { createExplorerTreeState, reduceExplorerTree } from ${JSON.stringify(resolve(root,'packages/client/ui-pane-workbench/src/explorer/tree-state.ts'))};\n`)
// Reuse this fixture bundle for the real Eikona page navigation and shared styles.
await writeFile(resolve(output,'entry.mjs'), [
  ['WorkspaceSearchOverlay', 'search-overlay.tsx'],
  ['PaneWorkbenchController', 'controller.ts'],
  ['PaneViewRegistry', 'view-registry.ts'],
  ['PaneCommandRegistry', 'composition.ts'],
  ['setActiveLocale', 'i18n/locale.ts'],
  ['createSessionListConversationSearchHost', 'conversation-search-host.ts'],
  ['searchSourcesFor', 'search-source-registry.ts'],
  ['searchHandoffChannel', 'search-handoff.ts'],
  ['createExplorerRuntimeSource', 'explorer/runtime.ts'],
  ['registerExplorerProvider', 'explorer/provider.ts'],
  ['requestExplorerReveal', 'explorer/reveal-navigation.ts'],
].map(([names,path]) => `export { ${names} } from ${JSON.stringify(resolve(root,'packages/client/ui-pane-workbench/src',path))};`).join('\n') + '\n', {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { createFileSearchSource } from ${JSON.stringify(resolve(root,'packages/bundle/dsh-desktop-workbench/src/client/file-search-source.ts'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { createProjectCanvasSearchSource } from ${JSON.stringify(resolve(root,'packages/client/ui-pane-domain/src/project-canvas-search-source.ts'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { apply as applyToolsOwner, en as toolsOwnerEn } from ${JSON.stringify(resolve(root,'packages/client/ui-mcp-inspector/src/client/index.ts'))};\nexport { ToolHubSidecar } from ${JSON.stringify(resolve(root,'packages/host/dsh-tool-hub/src/service.ts'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { OperationRecoveryNotice } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/operation-recovery-notice.tsx'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { CreatorActionComposer } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/projection-components.tsx'))};\nexport { CreatorStudioController } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/controller.ts'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { CreatorTranscriptionCapabilities } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/transcription-capabilities.tsx'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { CreatorSubtitleResults } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/subtitle-results.tsx'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { EikonaBatchBrowser } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/eikona-batch-browser.tsx'))};\nexport { EikonaPreparationForm } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/eikona-preparation-form.tsx'))};\nexport { EikonaStudioPages, EikonaCapabilityNotice } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/eikona-studio.tsx'))};\nexport { creatorStudioStyles } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/styles.ts'))};\nexport { createCreatorStudioTranslator, zh, en } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/locales.ts'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { CreatorArtifactWorkspace } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/artifact-workspace.tsx'))};\nexport { creatorSnapshot } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/tests/fixtures.ts'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { DomainStudioView } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/domain-studio.tsx'))};\n`, {flag:'a'})
await writeFile(resolve(output,'entry.mjs'), `export { EikonaAssetBrowser } from ${JSON.stringify(resolve(root,'packages/client/ui-creator-studio/src/eikona-asset-browser.tsx'))};\n`, {flag:'a'})
// The production client is a CJS ModuleLoader entry. Use its real renderer sources in the ESM browser fixture.
if (process.env.EIKONA_NATIVE_REMOTE === '1') {
  const staging = resolve(root, 'temp/dsh-unified-host-source')
  await writeFile(resolve(output, 'entry.mjs'), `
import { Context as NativeRemoteContext } from '@deepseek-ai/cordis';
import { apply as applyNativeRegistry } from ${JSON.stringify(resolve(staging, 'packages/typert/registry/src/client/index.ts'))};
import { apply as applyNativeConnection } from ${JSON.stringify(resolve(staging, 'packages/client/connection/src/client/index.ts'))};
import { apply as applyNativeGateway } from ${JSON.stringify(resolve(staging, 'packages/api/gateway/src/client/index.ts'))};
import { resolveCreatorStudioRemote as resolveNativeCreator } from ${JSON.stringify(resolve(root, 'packages/client/ui-creator-studio/src/remote.ts'))};
export async function mountNativeCreatorRemote() {
  const ctx = new NativeRemoteContext();
  await ctx.plugin({ apply: applyNativeRegistry });
  await ctx.plugin({ apply: applyNativeConnection });
  await ctx.plugin({ inject: ['typert', 'connection'], apply: applyNativeGateway });
  const remote = await resolveNativeCreator(ctx);
  if (!remote) { await ctx.fiber.dispose(); throw new Error('Native Creator Remote did not mount'); }
  return { remote, ready: () => ctx.get('connection').generation.getSnapshot() !== undefined, dispose: () => ctx.fiber.dispose() };
}
`, { flag: 'a' })
}
await writeFile(resolve(output,'rich-media.mjs'), [
  ['MediaImageRenderer, MediaCompareRenderer, MediaPlaybackRenderer', 'media-renderers.tsx'],
  ['MediaPreviewPane', 'media-preview-pane.tsx'],
  ['LocalTableGrid, columnsFromHeaderRow, LOCAL_TABLE_BUDGET', 'preview/local-table.tsx'],
  ['StaticHtmlPreview', 'preview/static-html.tsx'],
  ['parseDelimitedTable', 'preview/csv-parse.ts'],
].map(([names,path]) => `export { ${names} } from ${JSON.stringify(resolve(root,'packages/bundle/dsh-rich-media/src/client',path))};`).join('\n'))
await build({config:false,alias:{'@yeisme/dsh-rich-media/client':resolve(output,'rich-media.mjs')},entry:{'native-menu':resolve(output,'entry.mjs')},outDir:output,format:'esm',platform:'browser',dts:false,clean:false,sourcemap:false,outputOptions:{codeSplitting:false},logLevel:'silent',deps:{neverBundle:['react','react/jsx-runtime','react-dom','@yeisme/dsh-client-ui-surface','@yeisme/dsh-client-ui-visual-kit']},plugins:[{name:'unused-markdown-css',resolveId(id){if(id==='katex/dist/katex.min.css')return '\0fixture-unused-markdown-css'},load(id){if(id==='\0fixture-unused-markdown-css')return 'export {}'}}]})
