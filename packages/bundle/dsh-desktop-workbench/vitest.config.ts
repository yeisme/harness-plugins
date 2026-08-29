import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    server: {
      deps: {
        // Markdown/structured-content reaches KaTeX CSS through primitives;
        // inline lets Vite consume the CSS import instead of Node ESM.
        inline: ['@deepseek-ai/dsh-client-ui-primitives'],
      },
    },
  },
  resolve: {
    alias: [
      { find: /^@yeisme\/dsh-client-ui-desktop-workbench\/client$/, replacement: fileURLToPath(new URL('../../client/ui-desktop-workbench/src/client/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-client-ui-desktop-workbench$/, replacement: fileURLToPath(new URL('../../client/ui-desktop-workbench/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-client-ui-session-tags\/client$/, replacement: fileURLToPath(new URL('../../client/ui-session-tags/src/client/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-client-ui-session-tags$/, replacement: fileURLToPath(new URL('../../client/ui-session-tags/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-workbench-core\/client$/, replacement: fileURLToPath(new URL('../dsh-workbench-core/src/client/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-workbench-core$/, replacement: fileURLToPath(new URL('../dsh-workbench-core/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-file-document$/, replacement: fileURLToPath(new URL('../dsh-file-document/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-rich-media$/, replacement: fileURLToPath(new URL('../dsh-rich-media/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-rich-media\/client$/, replacement: fileURLToPath(new URL('../dsh-rich-media/src/client/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-terminal$/, replacement: fileURLToPath(new URL('../dsh-terminal/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-session-manager$/, replacement: fileURLToPath(new URL('../../host/dsh-session-manager/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-file-host\/node$/, replacement: fileURLToPath(new URL('../../host/dsh-file-host/src/node.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-client-ui-pane-workbench\/client$/, replacement: fileURLToPath(new URL('../../client/ui-pane-workbench/src/client.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-client-ui-pane-workbench$/, replacement: fileURLToPath(new URL('../../client/ui-pane-workbench/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-file-host$/, replacement: fileURLToPath(new URL('../../host/dsh-file-host/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-terminal-host$/, replacement: fileURLToPath(new URL('../../host/dsh-terminal-host/src/index.ts', import.meta.url)) },
      { find: /^@yeisme\/dsh-notify-host$/, replacement: fileURLToPath(new URL('../../host/dsh-notify-host/src/index.ts', import.meta.url)) },
    ],
  },
})
