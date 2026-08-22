# @yeisme/dsh-file-document

DSH Pane Workbench 的 File / Document 预览视图。

## 包边界

- `src/module.ts`：`fileDocumentModule` Workbench 模块描述符。
- `src/client/file-document-panel.tsx`：文件/文档树 + 当前资源详情预览，支持按需展开目录、键盘导航、图片/PDF/文本预览和安全下载入口。
- `src/file-tree-host.ts`：`FileTreeHostAdapter`，把 Host 目录投影映射为安全 `FileEntryV1`。
- `src/client/use-file-tree.ts`：`useFileTree`，在 workbench 打开或切到 Files Tab 时按需加载。
- 不拥有文件树、watcher、文档解析或 canonical state。

## 开发

```bash
pnpm --filter @yeisme/dsh-file-document run typecheck
pnpm --filter @yeisme/dsh-file-document run test
pnpm --filter @yeisme/dsh-file-document run build
```

## 按需加载

`FileTreeHostAdapter` 通过 `ctx.workspaces.listDirectory`（或未来 DSH fs seam）按需读取目录，
只把显示名与 opaque id 暴露给 UI，绝不把绝对路径放入 `FileEntryV1`。`useFileTree` 在
`enabled=true` 时才发起请求；目录展开通过 `loadChildren` 按需加载子目录。

树行只展示轻量元数据；选中文件后，右侧/下方的 Resource Preview 才请求 owner-authorized URL。PDF iframe 使用受限 sandbox，未获得 preview capability 时保持诚实的等待或不支持状态。
