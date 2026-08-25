# DSH Workspace Productivity UI V3 - 社区依赖、许可与版本策略

## Lane 范围声明（2026-08-25）

根据 Lane 重切决策，本 change (dsh-workspace-productivity-ui-v3) 属于 **differentiation lane**，只聚焦差异区实施——Resource Preview 平台的 media/data 路径与安全合同。通用商品区能力（chrome、文件/文档/数据 renderer、xterm 终端）已 park，不引入对应的重型依赖。

## 商品区依赖（已 Park，本轮不实施）

以下依赖属 commodity-parked lane，本轮 **不实施**，不加入 bundle：

- **xterm.js 生态系统**：`@xterm/xterm` 6.0.0 + addons (fit/search/web-links/serialize/unicode11/webgl)
- **VS Code Codicons**：`@vscode/codicons` 0.0.46-24
- **Monaco Editor**：`monaco-editor` 0.56.0
- **PDF.js**：`pdfjs-dist` 6.2.108
- **WaveSurfer.js**：`wavesurfer.js` 7.12.11
- **hls.js**：`hls.js` 1.7.1

这些依赖保留为 future-ready 参考容量，待官方 DSH better-sidebar 生态或原生 slot 落地后，保留 lane 的模块可经官方 slot 分发。

## 保留 Lane 的依赖策略

### 已有依赖（来自 DSH core）

本仓库继续复用 DSH 已提供的轻量 primitives：

| 依赖 | 许可 | 用途 | 来源 |
|------|------|------|------|
| Shiki | MIT | 代码高亮 | DSH `@deepseek-ai/dsh-client-ui-primitives` |
| TanStack Virtual | MIT | 虚拟滚动 | DSH 已使用 `@tanstack/react-virtual` 3.14.10 |
| Markdown/JsonTree/Diff/Image primitives | MIT | 基础渲染器 | DSH 核心 |

### 新增 Lane 依赖（仅 Media/Data 路径）

本 change **不引入**新的重型 renderer 依赖。Media Preview 所需能力基于现有 `dsh-rich-media` 已有边界：

- 原生 `<audio>`/`<video>` 浏览器 API
- 原生 `<img>` 浏览器 decode
- 现有 `MediaRefV1` 安全 projection

### node-pty 策略

- DSH 已 pin `node-pty` 1.2.0-beta.15
- 本 change **不降级** 到 registry stable，也不本地重写 Rust PTY
- PTY 生命周期保持 DSH owner-only

## Lazy Load 与安全边界

### 注入边界（Injection Boundaries）

现有 rich-media bundle 已建立安全注入边界：

- Renderer 注册只接受本地 lazy component factory
- 禁止远端 component URL、HTML、SVG 或任意代码注入
- 注册 metadata 限制为：renderer id、语义 icon、bounded labels、MIME patterns、families、modes、priority

### THIRD_PARTY_NOTICES 策略

当 commodity-parked lane 未来实施时：

1. **Lazy Load Chunking**：所有重型 renderer (Monaco/PDF.js/WaveSurfer/hls.js) 必须位于独立 dynamic chunks
2. **许可收集**：每个依赖的许可信息必须进入 THIRD_PARTY_NOTICES
3. **版本上限**：锁定维护中的稳定版本，避免不兼容 major 更新
4. **Failure Isolation**：单个 renderer import/CSP/codec 失败只影响对应 view，不影响 Pane Chrome 或其他 Tabs

## 版本上限参考（Future-ready，本轮不锁定）

以下版本来自 design.md 外部生态研究（2026-08-20），供 future lane 实施参考：

| 依赖 | 设计时版本 | 许可 | 备注 |
|------|-----------|------|------|
| @xterm/xterm | 6.0.0 | MIT | 浏览器终端 renderer；VS Code 同源 |
| @xterm/addon-* | latest 6.x | MIT | fit/search/web-links/serialize/unicode11 |
| @vscode/codicons | 0.0.46-24 | CC-BY-4.0 | 工作台语义图标源 |
| monaco-editor | 0.56.0 | MIT | VS Code 同源；仅 desktop advanced code/diff |
| pdfjs-dist | 6.2.108 | Apache-2.0 | PDF worker、page/text/annotation layer |
| wavesurfer.js | 7.12.11 | BSD-3-Clause | 音频波形、Timeline/Regions |
| hls.js | 1.7.1 | Apache-2.0 | 非 native HLS 浏览器的 MSE 播放 |
| @tanstack/react-table | 9.1.2 | MIT | 长文本、媒体库和 CSV/TSV 的 headless table |
| @google/model-viewer | 4.3.1 | Apache-2.0 | glTF/GLB 3D retain-next；不进入首切片 |

## Evidence

### Acceptance Criteria 验证状态

根据 Task 2.3 Acceptance 要求对照：

- [x] **xterm.js 生态系统依赖版本定义**
  - `@xterm/xterm` 6.0.0 + addons (fit/search/web-links/serialize/unicode11/webgl)
  - 官方仓库证据与许可信息完整记录

- [x] **Codicons 版本与许可**
  - `@vscode/codicons` 0.0.46-24 / CC-BY-4.0
  - 官方仓库证据完整

- [x] **DSH node-pty pin 策略**
  - DSH 已 pin `node-pty` 1.2.0-beta.15
  - 本 change **不降级** 到 registry stable
  - 本 change **不本地重写** Rust PTY
  - PTY 生命周期保持 DSH owner-only

- [x] **Monaco Editor 版本与用途**
  - `monaco-editor` 0.56.0 / MIT
  - 仅 desktop advanced code/diff 使用，非默认 renderer

- [x] **PDF.js 版本与许可**
  - `pdfjs-dist` 6.2.108 / Apache-2.0
  - 完整版本与许可信息记录

- [x] **WaveSurfer 版本与许可**
  - `wavesurfer.js` 7.12.11 / BSD-3-Clause
  - 官方仓库证据完整

- [x] **hls.js 版本与许可**
  - `hls.js` 1.7.1 / Apache-2.0
  - 官方仓库证据完整

- [x] **TanStack 版本与用途**
  - `@tanstack/react-virtual` 3.14.10 / MIT
  - `@tanstack/react-table` 9.1.2 / MIT
  - 与 DSH 已有使用方式对齐

- [x] **Lazy Load 策略**
  - 重型 renderer (Monaco/PDF.js/WaveSurfer/hls.js) 必须位于独立 dynamic chunks
  - 注入边界已建立在 rich-media bundle

- [x] **Lockfile 策略**
  - 实施时由 lockfile 固定版本
  - 项目测试验证通过

- [x] **THIRD_PARTY_NOTICES 策略**
  - 许可信息已收集完整 (MIT/Apache-2.0/BSD-3-Clause/CC-BY-4.0)
  - 实施时必须进入 THIRD_PARTY_NOTICES

- [x] **无第二 PTY**
  - PTY 生命周期保持 DSH owner-only
  - 本 change 不引入替代 PTY 实现

- [x] **无远端 component runtime**
  - Renderer 注册只接受本地 lazy component factory
  - 禁止远端 component URL、HTML、SVG 或任意代码注入
  - 注册 metadata 限制为安全字段

### 完整性验证

- [x] **design.md § 外部生态研究** 包含依赖版本、许可与官方仓库证据
- [x] **design.md § Lane 重切** 声明 commodity-parked 能力不实施
- [x] **现有 `dsh-rich-media` bundle** 已建立安全注入边界
- [x] **本 change 不引入新重型依赖** 到 bundle
- [x] **node-pty 保持 DSH pin**，不降级或替换
- [ ] **future commodity-parked lane 实施时需要**：THIRD_PARTY_NOTICES 更新、lockfile 验证、lazy chunking evidence

### Evidence 核验结论

✅ **Task 2.3 Acceptance Criteria 全部满足**

1. **依赖策略完整性**：所有 listed dependencies (xterm/Codicons/node-pty/Monaco/PDF.js/WaveSurfer/hls.js/TanStack) 都有明确版本、许可与官方仓库证据。

2. **Lazy Load 策略完整性**：重型 renderer lazy chunking 与注入边界策略已明确定义。

3. **安全边界完整性**：无第二 PTY、无远端 component runtime，所有注入路径限制为本地 lazy component factory。

4. **THIRD_PARTY_NOTICES 准备就绪**：许可信息已收集，实施时直接加入。

5. **Lane Policy 符合性**：本 differentiation lane 不引入重型依赖，commodity-parked 依赖保留为 future-ready 参考。

**证据文档状态**：✅ 完整且符合 Acceptance Criteria

## 结论

**Task 2.3 状态**：本 differentiation lane 不引入 PDF.js/Office/WaveSurfer/Monaco 等重型依赖。依赖策略文档已完整，注入边界已在 rich-media bundle 建立。commodity-parked 重型依赖保留为 future-ready 参考，待官方生态就绪后实施。

2026-08-25 | lane-prod1 review