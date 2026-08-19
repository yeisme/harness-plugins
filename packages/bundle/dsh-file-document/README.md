# @yeisme/dsh-file-document

DSH Workbench Core 的第二个模块骨架：File / Document 预览。

## 包边界

- `src/module.ts`：`fileDocumentModule` Workbench 模块描述符。
- `src/client/file-document-panel.tsx`：最小 React 面板占位。
- 不拥有文件树、watcher、文档解析或 canonical state。

## 开发

```bash
pnpm --filter @yeisme/dsh-file-document run typecheck
pnpm --filter @yeisme/dsh-file-document run test
pnpm --filter @yeisme/dsh-file-document run build
```
