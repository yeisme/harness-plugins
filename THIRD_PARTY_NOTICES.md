# Third-Party Notices

本文件按 `dsh-pane-workspace-experience-v3` 任务 1.6 固化 Resource Preview 渲染链的第三方依赖边界：直接运行时依赖的 license 汇总、懒加载边界（lazy boundary）声明、以及 worker/CSP 运行注意事项。完整 license 文本以各包 `node_modules/<pkg>/LICENSE` 为准。

## 1. 预览平台直接运行时依赖（`@yeisme/dsh-rich-media`）

| 包 | 版本 | License | 用途 |
|---|---|---|---|
| `@tanstack/react-table` | ^9.2.3 | MIT | 表格预览列模型/列宽/列显隐/固定列 |
| `@tanstack/react-virtual` | ^3.14.10 | MIT | 表格行虚拟化 |
| `@e965/xlsx` | ^0.20.3 | Apache-2.0 | XLSX/XLSM sheet 预览（动态 `import()`，仅浏览器变体） |
| `mammoth` | ^1.12.1 | BSD-2-Clause | DOCX → 受限 HTML 预览（经 pnpm patch 的浏览器变体） |
| `dompurify` | ^3.4.14 | (MPL-2.0 OR Apache-2.0) | 渲染输出 sanitize，禁 active content |

传递依赖（由上表引入，未直接 import）：`jszip` ^3.7.1（MIT，mammoth 内部）等；以 lockfile 为准。

## 2. 懒加载边界（不随 core 静态打包）

以下重型渲染器**不是**本仓库任何预览包的静态依赖；它们只通过注入式 loader（dynamic `import()` / host 注入）在对应 renderer 内按需加载，缺失时按 `unsupported`/降级路径处理（见 `packages/bundle/dsh-rich-media/src/client/preview/` 各 renderer）：

| 包 | License | renderer |
|---|---|---|
| `monaco-editor` | MIT | 高级源码/结构化编辑（desktop 显式 advanced mode） |
| `pdfjs-dist` | Apache-2.0 | PDF 分页/缩略图/搜索/text layer |
| `wavesurfer.js` | BSD-3-Clause | 音频波形/Timeline/Regions |
| `hls.js` | Apache-2.0 | MSE 播放（仅 native HLS 不可用时） |

锁定策略：core registry/chrome entry 零上述静态引用（由 `tests/bundle-runtime-smoke.spec.ts` 与 chunk 产物双重钉住）；未来 3D 渲染依赖同样只允许进入本边界，不进入 V3 core。

## 3. Worker 与 CSP 注意事项

- `pdfjs-dist` 需要 worker（`worker-src`/`script-src` 允许 bundler 生成的 worker chunk 或 blob:）；worker/CSP 加载失败时 renderer 必须走明确降级（原生 iframe PDF 或 unsupported），不得在主线程模拟。
- `monaco-editor` 的 language/json workers 同样按需加载；390px/窄窗与受限 profile 回退轻量 source viewer。
- `@e965/xlsx`/`mammoth` 在浏览器变体上运行于主线程受限预算内（字节/行/列预算见 renderer 常量），不使用 worker。
- 任何 renderer 不得因 CSP 拒绝而降级为内联 `<script>`/`eval` 执行。

## 4. 维护约定

- 新增预览格式依赖时：先判懒边界（能否 dynamic import + 降级），再更新本表与 lockfile；静态依赖仅允许轻量（≤ MIT/Apache/BSD 级 permissive 且无 worker 强制）。
- 版本以 `pnpm-lock.yaml` 为准；本表版本号为写作时锁定值。
