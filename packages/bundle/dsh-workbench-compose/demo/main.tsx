/**
 * Runnable demo page for the composed DSH Workbench.
 *
 * This demo uses `createStaticHostProjection` to show media, file, terminal,
 * and Git-status content inside the composed Workbench without requiring a
 * live DSH Host.
 *
 * @module @yeisme/dsh-workbench-compose/demo
 */

import { createRoot } from 'react-dom/client'
import { ComposedWorkbench } from '../src/client/composed-workbench.tsx'
import type { ComposedWorkbenchProps, ComposedWorkbenchExtraProps } from '../src/client/composed-workbench.tsx'
import { createStaticHostProjection } from '../src/host-projection.ts'
import type { FileEntryV1 } from '@yeisme/dsh-file-document'
import type { MediaRefV1 } from '@yeisme/dsh-rich-media'

const media: MediaRefV1[] = [
  {
    owner: 'demo',
    kind: 'image',
    ref: 'demo-image-1',
    version: 'v1',
    mediaType: 'image/png',
    width: 640,
    height: 400,
    title: '示例图片',
    summary: '来自静态 Host 投影的示例图片',
    capabilities: ['preview', 'download'],
  },
  {
    owner: 'demo',
    kind: 'video',
    ref: 'demo-video-1',
    version: 'v1',
    mediaType: 'video/mp4',
    duration: 12000,
    title: '示例视频',
    summary: '来自静态 Host 投影的示例视频',
    capabilities: ['play', 'preview', 'download'],
  },
  {
    owner: 'demo',
    kind: 'audio',
    ref: 'demo-audio-1',
    version: 'v1',
    mediaType: 'audio/mpeg',
    duration: 30000,
    title: '示例音频',
    summary: '来自静态 Host 投影的示例音频',
    capabilities: ['play', 'download'],
  },
  {
    owner: 'demo',
    kind: 'pdf',
    ref: 'demo-pdf-1',
    version: 'v1',
    mediaType: 'application/pdf',
    size: 2048,
    title: '示例 PDF',
    summary: '来自静态 Host 投影的示例 PDF',
    capabilities: ['preview', 'open', 'download'],
  },
]

const fileEntries: FileEntryV1[] = [
  {
    id: 'demo-dir',
    name: 'project',
    kind: 'directory',
    summary: '示例项目目录',
    capabilities: [],
  },
  {
    id: 'demo-file-1',
    parentId: 'demo-dir',
    name: '示例文档.txt',
    kind: 'text',
    mediaType: 'text/plain',
    size: 1024,
    summary: '来自静态 Host 投影的示例文本文件',
    capabilities: ['preview', 'open'],
  },
  {
    id: 'demo-git-status',
    parentId: 'demo-dir',
    name: 'git-status.txt',
    kind: 'text',
    mediaType: 'text/plain',
    size: 256,
    summary: 'Git 状态：1 staged · 2 modified · 0 conflicts',
    capabilities: ['preview', 'open'],
  },
  {
    id: 'demo-doc-1',
    name: '设计文档.md',
    kind: 'document',
    mediaType: 'text/markdown',
    size: 4096,
    summary: '示例文档',
    capabilities: ['preview', 'open'],
  },
]

const projection = createStaticHostProjection({
  media,
  fileEntries,
  resolveMediaUrl: item => Promise.resolve(`https://cdn.example/safe/${item.owner}/${item.ref}`),
  resolveFilePreviewUrl: entry => entry.kind === 'text' ? `https://cdn.example/preview/${entry.id}` : undefined,
})

const zh: Record<string, string> = {
  trigger: '工作台',
  aria: '组合工作台',
  commands: '命令',
  empty: '暂无媒体，等待 Host 投影接入。',
  placeholderTitle: '预留接入位',
  placeholderBody: '该 Tab 尚未接入 owner seam。',
}

const props = {
  wide: true,
  t: (key: string) => zh[key] ?? key,
  hostProjection: projection,
  terminalState: 'connected',
  terminalStatus: 'session 3 · exit 0',
  useSessions: () => ({ current: undefined }),
  useWorkspaces: () => ({ items: [] }),
} as unknown as ComposedWorkbenchProps & ComposedWorkbenchExtraProps

const root = document.getElementById('root')
if (root !== null) {
  createRoot(root).render(<ComposedWorkbench {...props} />)
}
