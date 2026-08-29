# @yeisme/dsh-rich-media

CSV/TSV 的可选 owner-paged renderer 从 `@yeisme/dsh-rich-media/table` 导入；
它不进入主 DSH client face，避免未打开表格时把 TanStack Table/Virtual 打进
通用媒体 bundle。owner 未提供 columns 或 global query capability 时诚实降级。

DSH Web 富媒体展示插件的统一安装包。当前已提供安全 `MediaRefV1` 合同、Pane 内 `MediaPreviewPane`、Rich Media Card 与可安装 bundle row；媒体存储、模型多模态输入和领域媒体编辑仍归 DSH/领域 owner。

## 多格式文件预览（file-preview-formats）

`MediaPreviewPane` 按 mediaType 分发到格式渲染器；`PreviewRendererRegistry`
侧通过 `registerFilePreviewRenderers` 注册同名 descriptors（exact MIME 优先）：

| 格式 | 渲染 | 依赖（懒求值） | 预算 | 降级 |
| --- | --- | --- | --- | --- |
| CSV/TSV | RFC4180 解析→分页网格（首行提升表头） | 无 | 4MB / 20000 行 / 256 列 | 截断提示 |
| XLSX/XLSM | `@e965/xlsx`→sheet 切换+分页网格 | @e965/xlsx | 16MB / 10000 行·sheet / 256 列 | 截断提示 |
| DOCX | `mammoth`→DOMPurify 消毒→受控 HTML | mammoth, dompurify | 16MB（HTML 4MB） | typed unsupported |
| PDF | 浏览器原生 iframe（无 PDF.js） | 无 | — | 打开/下载 |
| TXT/JSON/MD/源码 | 行号+64KB 窗口源码视图（JSON pretty） | 无 | 2MB fetch | 截断提示 |
| SVG | `<img>`（无脚本执行面） | 无 | 既有 decode 预算 | 既有 |
| PPTX/DOC/XLS/ODT | 诚实降级+打开/下载 | 无 | — | typed unsupported |

- 重依赖按 mermaid 先例内联进 `client.js` 单文件、`import()` 懒工厂首用才求值；
  mammoth/jszip 经 pnpm patch 走浏览器变体（Node `fs` 分支不进 bundle）。
- 文件名→kind/mediaType 映射统一走 `classifyFileEntry`；desktop-workbench
  的 `mediaKindOf` 复用同一张表。
- 切换选区即 abort 在途 fetch；所有预算超限显示明确提示，不静默截断。

## 安装

```bash
# 本地 checkout
dsh plugin --profile web add ./packages/bundle/dsh-rich-media

# 或发布后
dsh plugin --profile web add @yeisme/dsh-rich-media
```

## 包边界

- `src/host/types.ts`：headless `MediaRefV1` 校验与类型，禁止 raw path、凭据、无界文本。
- `src/host/types.ts`：同时提供可选 `MediaHostV1` owner seam；通过 `dsh.mediaHost` context key 提供媒体列表与短时 URL 解析。
- `src/host/plugin.ts`：Host 面骨架，具体媒体存储/传输仍由领域 owner 挂载。
- `src/client/media-card.tsx`：纯 React 媒体卡片，支持 image/audio/video 的短时 URL 展示。
- `src/client/media-preview-pane.tsx`：Pane 内资源列表与当前媒体预览，支持筛选、图片/音频/视频/PDF、owner 授权的短时 URL、打开和下载。
- `src/client/workbench.tsx`：仅保留给 story/迁移测试的 legacy Rich Media Workbench，不再注册生产 sidebar action。
- `src/client/media-node.tsx`：`media/ref` 会话事件到 Chat `media-ref` 节点的折叠与渲染器。
- `src/client/index.ts`：浏览器入口，注册 conversationEvents 与 chat node renderer；有 `paneWorkbench` 时卡片提供「在窗格打开」。
- `src/client/preview-seed.ts`：会话内 overlay 预览种子，只存已校验 `MediaRefV1`。

## 开发

```bash
pnpm install
pnpm --filter @yeisme/dsh-rich-media run typecheck
pnpm --filter @yeisme/dsh-rich-media run test
pnpm --filter @yeisme/dsh-rich-media run build
```

## 检查与回滚

```bash
dsh --profile web --dump-config
dsh plugin --profile web remove @yeisme/dsh-rich-media
```

骨架不写入持久化数据、不修改 DSH core、不创建浏览器 domain store。
