# Tasks

## 1. CSV/TSV 与文本源码

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/client/preview/csv-parse.ts`；Dependencies: none] 实现有界 RFC4180 解析器：引号、转义引号、内嵌换行、CRLF、TSV；行/列/字节预算与 truncated。Acceptance: 边角用例全过；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: `src/client/preview/text-source.tsx`；Dependencies: none] 实现有界源码视图：行号、64KB 窗口增量加载、JSON pretty、2MB fetch 上限、abort。Acceptance: 窗口递增与截断提示可见；Validation: 同上。
- [x] 1.3 [Owner: Harness Plugins；Scope: tests] csv-parse 与 text-source 测试。Acceptance: 新测试通过；Validation: 同上。

## 2. Office 渲染器（懒加载）

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/client/preview/access.ts`；Dependencies: none] `createPreviewAccessHandle` 输入增加可选 `columns`，`readTablePage` 页面携带。Acceptance: additive，既有测试不破；Validation: 同上。
- [x] 2.2 [Owner: Harness Plugins；Scope: `src/client/preview/docx-renderer.tsx`；Dependencies: mammoth, dompurify] mammoth 懒工厂 + DOMPurify 消毒 + 16MB 预算 + typed 降级。Acceptance: 消毒失败→unsupported；Validation: 同上（mock 重库）。
- [x] 2.3 [Owner: Harness Plugins；Scope: `src/client/preview/sheet-renderer.tsx`；Dependencies: @e965/xlsx] sheet 列表 + 有界分页网格（10k 行/256 列/2000 字符单元格）。Acceptance: 多 sheet 可切换；Validation: 同上（mock 重库）。
- [x] 2.4 [Owner: Harness Plugins；Scope: tests] docx/sheet 渲染器测试（mock 懒加载边界）。Acceptance: 新测试通过；Validation: 同上。

## 3. 分发与注册

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/preview/descriptors.ts`；Dependencies: 1.x, 2.x] 注册 `yeisme:text/csv/docx/sheet/pdf` descriptors；`adapters.ts` `mediaFamilyOf` 扩展 OOXML 与 document+csv 映射。Acceptance: registry 解析确定性不回退（exact MIME 优先）；Validation: 同上。
- [x] 3.2 [Owner: Harness Plugins；Scope: `src/client/media-preview-pane.tsx`；Dependencies: 3.1] `ActiveMedia` 扩展 text/table/office 分发与诚实降级；选区切换 abort。Acceptance: pptx 显示 typed unsupported+打开/下载；Validation: 同上。
- [x] 3.3 [Owner: Harness Plugins；Scope: tests] pane 分发/降级/abort 测试。Acceptance: 新测试通过；Validation: 同上。

## 4. 依赖与构建

- [x] 4.1 [Owner: Harness Plugins；Scope: `package.json`, `tsdown.config.ts`；Dependencies: 2.x] 增 mammoth/@e965/xlsx/dompurify 依赖；alwaysBundle 内联保持懒工厂；类型 shim。Acceptance: build 产物含懒工厂且 client.js 单文件合同不破；Validation: `pnpm --filter @yeisme/dsh-rich-media run build && pnpm run check:bundles`。

## 5. 生产接线

- [x] 5.1 [Owner: Harness Plugins；Scope: `packages/bundle/dsh-desktop-workbench/src/client/apply.ts`；Dependencies: 3.x] `mediaKindOf`/`fallbackMediaType` 扩展新格式映射。Acceptance: csv/docx/xlsx/txt 文件进入媒体列表并正确 kind/mediaType；Validation: `pnpm --filter @yeisme/dsh-desktop-workbench run test`。
- [x] 5.2 [Owner: Harness Plugins；Scope: tests] desktop-workbench 映射测试。Acceptance: 新测试通过；Validation: 同上。

## 6. 文档与收口

- [x] 6.1 [Owner: Harness Plugins；Scope: README；Dependencies: all] rich-media README 格式矩阵更新；`dsh-file-document-v1` 5.3 与 `dsh-rich-media-plugin-v1` 4.3 标注去向。Acceptance: 文档与实现一致；Validation: review。
- [x] 6.2 [Owner: Harness Plugins；Scope: openspec；Dependencies: all] `openspec validate dsh-file-preview-formats-v1 --strict --no-interactive` 通过。
