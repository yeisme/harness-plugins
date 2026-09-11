## 1. 格式矩阵与渲染器（dsh-rich-media）

- [x] 1.1 [Owner: Harness Plugins；Scope: `src/client/preview/format-kinds.ts`；Dependencies: none] EXTENSION_MEDIA_TYPES additive 新行：音频 flac/opus/aac/aif/aiff/wma/mid/midi、视频 mkv/avi/flv/mts/m2ts/3gp/ogm、归档 zip/jar/tar/gz/tgz/bz2/xz/7z/rar（zip 族带标准 MIME）。Acceptance: 新扩展正确分类、文本族分类不变；Validation: `pnpm --filter @yeisme/dsh-rich-media run test`。
- [x] 1.2 [Owner: Harness Plugins；Scope: `src/client/preview/archive-view.tsx`（新）；Dependencies: 1.1] 实现 `MediaArchiveRenderer`：经 `accessSource` 有界读取字节 → `parseZipEntryList` → entry 表格（名/未压缩大小/目录标记/totalEntries/truncated/malformed 事实）；解析失败降级 hex 视图；`--vk-*` token。Acceptance: 正常/空/截断/malformed 用例过；Validation: 同上。
- [x] 1.3 [Owner: Harness Plugins；Scope: `src/client/preview/binary-hex.tsx`（新）；Dependencies: none] 实现 `MediaBinaryHexRenderer`：256B hex/ASCII 有界视图 + totalBytes/truncated 事实。Acceptance: cap/事实断言过；Validation: 同上。
- [x] 1.4 [Owner: Harness Plugins；Scope: `src/client/preview/descriptors.tsx`；Dependencies: 1.2, 1.3] 新 descriptors `yeisme:audio`/`yeisme:video`（MediaPlaybackRenderer + allowBlobUrl）、`yeisme:archive`（exact zip MIME）、`yeisme:binary-hex`（binary family，priority 低于 exact），并入 `FILE_PREVIEW_DESCRIPTORS`；`src/client/index.ts` 补 export（registry/host/adapters/descriptors）。Acceptance: 解析顺序测试（zip exact 压过 binary-hex、audio/video family 命中、loadBest 降级）；Validation: 同上。

## 2. per-file 分派面（ui-desktop-workbench）

- [x] 2.1 [Owner: Harness Plugins；Scope: `src/client/file-preview-dispatch.tsx`（新）；Dependencies: 1.4] 实现 `FilePreviewDispatchPane`：FileEntryV1 → `fileEntryToPreviewResource`（owner mediaType 优先、扩展表补位、generic file kind 归一）→ `readBinary` 一次性读取 → `createPreviewAccessHandle`（bytes + 短时 object URL，对称 release）→ registry resolve/loadBest → Surface + SurfaceContextBar + 状态机（loading/ready/unsupported/oversized/error）。Acceptance: 组件测试覆盖 render/拒绝/超上限/释放；Validation: `pnpm --filter @yeisme/dsh-client-ui-desktop-workbench run test`。

## 3. 生产接线（dsh-desktop-workbench）

- [x] 3.1 [Owner: Harness Plugins；Scope: `src/client/apply.ts`；Dependencies: 2.1] 注册 `desktop.preview` 视图（singleton: false、snapshot、resourceKey=ref）；`openFile` 把 classified kind ∈ {audio,video,pdf,document} 或 entry.kind ∈ {archive,binary,document,pdf} 路由到该视图；文本/图片路由不变。Acceptance: 映射测试更新 + 新路由断言；Validation: `pnpm --filter @yeisme/dsh-desktop-workbench run test`。
- [x] 3.2 [Owner: Harness Plugins；Scope: `src/client/apply.ts`；Dependencies: 3.1] `sidebar.footer.action` 注册「媒体」按钮（icon media，order 42）打开 `desktop.media` 库视图；`desktop.media` 不再是文件打开目标。Acceptance: 注册存在 + 无重复 id；Validation: 同上。
- [x] 3.3 [Owner: Harness Plugins；Scope: tests；Dependencies: 3.1] `file-preview-mapping.spec.ts` 扩展：mkv/flac/zip/未知二进制 → `desktop.preview`；md/json/ts → undefined（desktop.file）；zip MIME 断言。Acceptance: 全绿；Validation: 同上。

## 4. explorer 树图标（ui-pane-workbench）

- [x] 4.1 [Owner: Harness Plugins；Scope: `src/icon.ts` + `src/explorer/tree-ui.tsx`；Dependencies: none] additive 图标名 image/audio/video/pdf/archive/code（type+list+PATHS）；`iconForRow` 扩展名→图标 presentation 映射（目录 folder、未知 file）。Acceptance: 图标解析测试过；Validation: `pnpm --filter @yeisme/dsh-client-ui-pane-workbench run test`。

## 5. 文档与门

- [x] 5.1 [Owner: Harness Plugins；Scope: `openspec/changes/dsh-file-preview-dispatch-v1/`；Dependencies: 1.x-4.x] proposal/design（含 §12 UI Contract）/tasks/spec 齐备。Acceptance: `openspec validate dsh-file-preview-dispatch-v1 --strict --no-interactive` 通过。
- [x] 5.2 [Owner: Harness Plugins；Scope: 仓库门；Dependencies: 1.x-4.x] 本 lane 包门全绿；仓库级门如实记录并行 lane 状态。Evidence (2026-09-10): 本 lane 四包 typecheck/test/build 全绿（dsh-rich-media test 187/187 + build、ui-desktop-workbench test 72/72 + build、dsh-desktop-workbench test 45/45 + build、ui-pane-workbench typecheck/build + explorer specs green）；check:bundles 29/29 PASS；check:plugins 六检查器中 declaration-lint/dispose-hmr/personal-coding/visual-token PASS（visual-token 经补齐并行 lane 新包 surface 分类与 dynamicStyle allowlist 后转绿）；safe-projection-audit 剩 2 findings 均在并行 lane 未跟踪的 dsh-context fork 包；test:visual 90/126 通过，36 失败全部为并行 lane fixture 页 boot 失败（visual-selection-actions 27 + visual-tools 9，data-ready 未置位），本 lane rich-media/desktop fixture 全过、未更新任何基线；ui-pane-workbench dsh-projection.spec 因 dsh-session rc.6 × dsh-llm rc.1 多实例 CallId 运行时导出缺失失败（并行 lane 依赖图问题，与本 change 无关，media-node 已本地加宽类型兼容）。
