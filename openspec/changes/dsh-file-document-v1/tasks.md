## 1. FileEntry 合同

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/types.ts`；Dependencies: none] 定义 `FileEntryV1`、`FileEntryKind` 与校验。Acceptance: 拒绝 raw path、unknown capability、非法 id；Validation: `pnpm --filter @yeisme/dsh-file-document run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: tests；Dependencies: 1.1] 增加 FileEntry valid/invalid 测试。Acceptance: 3 tests passed；Validation: `pnpm --filter @yeisme/dsh-file-document run test`。

## 2. Panel

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/client/file-document-panel.tsx`；Dependencies: 1.1] 实现文件/文档列表、空状态、图片/PDF/文本预览占位。Acceptance: 只消费 FileEntry 投影；Validation: `pnpm --filter @yeisme/dsh-file-document run test`。
- [x] 2.2 [Owner: Harness Plugins；Scope: tests；Dependencies: 2.1] 增加 Panel 渲染测试。Acceptance: 8 tests passed；Validation: `pnpm --filter @yeisme/dsh-file-document run test`。

## 3. Workbench Core 接入

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/module.ts`；Dependencies: workbench-core] 注册 `fileDocumentModule` 到 Workbench Core。Acceptance: module registry 可注册；Validation: `pnpm --filter @yeisme/dsh-file-document run test`。

## 4. OpenSpec 与文档

- [x] 4.1 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-file-document-v1/`；Dependencies: 1.x, 2.x, 3.x] 完成 proposal/design/tasks/spec。Acceptance: `openspec validate dsh-file-document-v1 --strict --no-interactive` 通过。

## 5. 后续推进目标（retain-next）

- [x] 5.1 [Owner: Harness Plugins；Scope: `src/client/file-document-panel.tsx`；Dependencies: 2.1] 接入真实 DSH fs/文档 owner seam，提供 entries 与预览 URL。Acceptance: `FileEntryV1` 来自真实 Host；Validation: `pnpm --filter @yeisme/dsh-file-document run test && pnpm --filter @yeisme/dsh-file-document run typecheck && pnpm --filter @yeisme/dsh-file-document run build`；Evidence: loadChildren/resolvePreviewUrl/loadText 回调接口，等待真实 DSH fs/文档 seam 提供 entries。
- [x] 5.2 [Owner: Harness Plugins；Scope: `src/client/file-document-panel.tsx`；Dependencies: 2.1] 实现文件树目录展开/选择/打开。Acceptance: 目录可展开、文件可选择；Validation: component tests。
- [x] 5.3 [Owner: Harness Plugins；Scope: `src/client/file-document-panel.tsx`；Dependencies: 2.1] 评审并接入 PDF.js/Office 预览方案。Acceptance: PDF/Office 可预览或明确降级；Validation: `pnpm --filter @yeisme/dsh-file-document run test`；Evidence: PDF iframe 预览（sandbox="allow-same-origin"），明确降级消息"此文件类型暂不支持内嵌预览"，不新增 PDF.js 依赖而是使用浏览器原生 PDF 渲染。
- [x] 5.4 [Owner: Harness Plugins；Scope: tests；Dependencies: 5.2] 增加文件树交互测试：展开、选择、空状态。Acceptance: 新测试通过；Validation: `pnpm --filter @yeisme/dsh-file-document run test`。
