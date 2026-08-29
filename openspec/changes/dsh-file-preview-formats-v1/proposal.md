# dsh-file-preview-formats-v1

## Why

DSH Web 的媒体预览当前只覆盖 image/audio/video/pdf（`MediaPreviewPane` 的 kind 分发）与 `./table` 入口导出的 owner-paged CSV 网格（尚无生产接线）。文件树/桌面工作台里最常见的产物——CSV/TSV、DOCX、XLSX、纯文本、JSON、Markdown 源码——全部无法在 pane 内预览：`dsh-desktop-workbench` 的 `mediaKindOf` 对这些扩展名返回 `undefined`，文件根本进不了媒体列表。旧 change `dsh-file-document-v1` 5.3 与 `dsh-rich-media-plugin-v1` 4.3 均因"PDF.js/Office 集成需要新增依赖，本 lane 不允许"被阻塞。

本 change 解除该阻塞：在 `@yeisme/dsh-rich-media` 预览平台（registry/access/session 已建成）之上补齐格式渲染器，并接通生产 pane。

## What Changes

- 新增零依赖 `csv-parse.ts`：有界 RFC4180 CSV/TSV 解析（引号、转义引号、内嵌换行、CRLF），行/列/字节预算与 truncated 标志。
- 新增零依赖 `text-source.tsx`：有界文本源码预览（行号、64KB 窗口增量加载、JSON pretty-print、Markdown 源码视图）。
- 新增懒加载 Office 渲染器：DOCX（`mammoth` → HTML → `DOMPurify` 消毒 → 受控渲染）与 XLSX/XLSM（`@e965/xlsx` → sheet 列表 + 有界分页网格，复用 `PreviewTableRenderer`）。
- `createPreviewAccessHandle` 输入新增可选 `columns`，`readTablePage` 页面携带列 schema（additive）。
- `MediaPreviewPane.ActiveMedia` 扩展为 text/table/office 分发 + 诚实降级（PPTX/legacy office → typed unsupported + 打开/下载）。
- `preview/descriptors.ts` 统一注册 `yeisme:text/csv/docx/sheet/pdf` 到 `PreviewRendererRegistry`；`adapters.ts` `mediaFamilyOf` 增加 OOXML 与 document-kind CSV 映射。
- `dsh-desktop-workbench` `mediaKindOf`/`fallbackMediaType` 扩展：csv/tsv/txt/md/json/log/yaml/xml→可预览 kind，docx/xlsx/xlsm→OOXML mediaType。
- 依赖策略遵循 mermaid 先例：`mammoth`/`@e965/xlsx`/`dompurify` 进 rich-media dependencies，tsdown alwaysBundle 内联但保持 `import()` 懒工厂，首次打开该格式才求值。

## Format Matrix

| 格式 | family | 渲染器 | 依赖 | 预算 | 降级 |
| --- | --- | --- | --- | --- | --- |
| CSV/TSV | table | 本地解析→网格 | 无 | 4MB / 20k 行 / 256 列 | 截断提示 |
| PDF | pdf | 浏览器原生 iframe（既有） | 无 | — | 打开/下载 |
| DOCX | binary | mammoth+DOMPurify | mammoth, dompurify | 16MB | typed unsupported |
| XLSX/XLSM | table | @e965/xlsx→网格 | @e965/xlsx | 16MB / 10k 行/sheet / 256 列 | 截断提示 |
| TXT/JSON/MD/源码 | text | 有界源码视图 | 无 | 2MB fetch / 64KB 窗口 | 截断提示 |
| SVG | image | `<img>`（既有，无脚本执行面） | 无 | 既有 decode 预算 | 既有 |
| PPTX/DOC/XLS/ODT | binary | 诚实降级 | 无 | — | unsupported+打开/下载 |

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 格式渲染器（text/csv/docx/sheet） | required | Harness Plugins | deliver-now | vitest + build |
| 重依赖懒加载边界 | required | Harness Plugins | deliver-now | tsdown 内联懒工厂 + 首用求值 |
| 媒体字节/鉴权 | required | DSH/领域 owner | moved behind contract | 既有 short-time URL seam |
| PDF 渲染 | required | Harness Plugins | deliver-now（既有 iframe，不引入 PDF.js） | 既有测试 |
| Office 文件写入/编辑 | required | 领域 owner | moved behind contract | 各 owner OpenSpec |

## Capabilities

### New Capabilities

- `file-preview-formats`: 多格式文件预览渲染器矩阵、预算、懒加载边界与诚实降级合同。

### Modified Capabilities

无。`MediaRefV1`、`PreviewResourceV1` 字段集不变；`createPreviewAccessHandle` 仅 additive 可选输入。
