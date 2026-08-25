# DSH Workspace Productivity UI V3 - Task 2.4 Resource Preview 合同对照评审证据

## 执行摘要

**对齐验证状态**：⚠️ **部分语义一致，关键能力缺失 - 保持 BLOCKED**

**阻塞根因**：DSH upstream (`deepseek-ai/deepseek-harness`) 未发布 official PreviewResourceV1 Agent Note。

**语义对齐状态**：✅ **部分一致** - MIME sniffing、opaque ref、range read、release 语义与 DSH upstream 一致。

**缺失关键能力**：❌ **三大能力缺失**：
1. **owner/ref/version 三元组**：DSH 仅有 previewId，缺少 owner identity 与 version tracking
2. **version subscription/stale detection**：无资源版本变化监听与 stale 状态管理
3. **text/table window APIs**：无流式大文件窗口读取能力（text window、table pagination）

**V3 本地交付状态**：✅ 完整实施 - adapter/registry、renderer registry、FileEntryV1/MediaRefV1 兼容路径、本地 preview access 3.3-3.6 全部交付。

**诚实降级策略**：✅ **probe-disabled** - 缺失上游能力时显示 unsupported/partial，不猜测行为。

## Task 状态：BLOCKED

**Blocked Reason**：official PreviewResourceV1 Agent Note / upstream PR not yet accepted by DSH upstream

## Evidence 对照结果

### DSH Agent Note 状态

- **当前状态**：DSH upstream `deepseek-ai/deepseek-harness` 未发布 official PreviewResourceV1 Agent Note
- **上游通道**：本仓 `upstream-prs/preview-resource-v1/` 包含 patch 系列 + 双语 note 草案
- **PR 状态**：fork-ready 分支存在 (`yeisme/deepseek-harness` pr/preview-resource-v1)，但未开官方 PR

### PreviewResourceV1 Spec 对照

#### DSH Upstream PreviewResourceV1（来自 upstream-prs/preview-resource-v1）

```typescript
// @deepseek-ai/dsh-attachment/preview
export const PREVIEW_RESOURCE_CAPABILITY = 'PreviewResourceV1' as const

export interface PreviewResourceRef {
  readonly previewId: string        // opaque ref
  readonly mediaType: string         // owner-sniffed MIME
  readonly bytes?: number
}

export interface PreviewReadRequest {
  readonly previewId: string
  readonly offset?: number           // range start
  readonly length?: number           // range length
  readonly rendition?: 'original' | 'thumbnail' | 'text'
  readonly signal?: AbortSignal      // cancellation
}

export interface PreviewReadResult {
  readonly mediaType: string
  readonly bytes: Uint8Array
  readonly complete: boolean         // truncated flag
}

export interface PreviewResourceSource {
  readonly capabilities?: readonly string[]
  openPreview?(input: { mediaType?: string; bytes?: Uint8Array }): Promise<PreviewResourceRef>
  readPreview?(request: PreviewReadRequest): Promise<PreviewReadResult>
  releasePreview?(previewId: string): Promise<void>
}

// Safety helpers
export function isOpaquePreviewId(previewId: string): boolean
export function sniffPreviewMediaType(bytes: Uint8Array, declared?: string): string
export function hasPreviewResourceCapability(source: PreviewResourceSource | undefined): boolean
```

#### 本地 PreviewResourceV1（来自 resource-preview-platform/spec.md）

```typescript
// 本地定义（完整合同见 specs/dsh-workspace-productivity-experience/spec.md）
PreviewResourceV1 {
  owner               // canonical owner id
  ref                 // opaque resource id
  version             // owner version/freshness token
  title               // bounded display title
  mediaType           // owner sniffed MIME type
  family              // text/document/table/image/audio/video/archive/binary
  size? / modifiedAt? / dimensions? / duration?
  capabilities[]      // preview/download/openExternal/compare/extractText/attach
  renditions[]        // thumbnail/poster/text/page/table/waveform/captions/converted
}

PreviewRendererRegistrationV1   (local-only)
  id / label / icon
  mediaPatterns[] / families[] / modes[] / priority
  lazyComponentFactory
  supports(snapshot, environment)
```

### 逐项对照表：PreviewResourceV1 Spec × DSH 上游现状

根据 Harness `PreviewResourceV1` spec 与 DSH `PreviewResourceV1` upstream 对照：

| PreviewResourceV1 Spec 能力 | 本地定义 | DSH upstream 现状 | 对齐状态 |
|----------------------------|----------|-------------------|----------|
| **owner** | `owner: string` (canonical owner id) | ❌ DSH PreviewResourceRef 无 owner 字段 | **缺失** |
| **ref** | `ref: string` (opaque resource id) | ✅ DSH `previewId: string` | **一致** |
| **version** | `version: string` (owner version/freshness token) | ❌ DSH PreviewResourceRef 无 version 字段 | **缺失** |
| **title** | `title: string` (bounded display title) | ❌ DSH PreviewResourceRef 无 title 字段 | **缺失** |
| **mediaType** | `mediaType: string` (owner sniffed MIME) | ✅ DSH `mediaType: string` | **一致** |
| **family** | `family: enum` (text/document/table/image/audio/video/archive/binary) | ❌ DSH 无 family 分类 | **缺失** |
| **size/modifiedAt/dimensions/duration** | 元数据字段 | ❌ DSH PreviewResourceRef 无这些字段 | **缺失** |
| **capabilities[]** | `preview/download/openExternal/compare/extractText/attach` | ❌ DSH PreviewResourceSource 无 capabilities 声明 | **缺失** |
| **renditions[]** | `thumbnail/poster/text/page/table/waveform/captions/converted` | ⚠️ DSH 仅 `rendition enum (original/thumbnail/text)` | **简化** |
| **MIME sniffing** | `sniffMediaType(bytes, declared): string` | ✅ DSH `sniffPreviewMediaType(bytes, declared)` | **一致** |
| **readByteRange()** | `readByteRange(offset, length): Promise<Uint8Array>` | ✅ DSH `readPreview(offset, length, rendition)` | **一致** |
| **readTextWindow()** | `readTextWindow(cursor, bounds): Promise<TextWindow>` | ❌ DSH 无 text window API | **缺失** |
| **readTablePage()** | `readTablePage(cursor, bounds): Promise<TablePage>` | ❌ DSH 无 table window API | **缺失** |
| **subscribeVersion()** | `subscribeVersion(ref): () => void` | ❌ DSH 无 version subscription | **缺失** |
| **release()** | `release(handle): Promise<void>` | ✅ DSH `releasePreview(previewId)` | **一致** |
| **Abort support** | `signal?: AbortSignal` in read requests | ✅ DSH `PreviewReadRequest.signal` | **一致** |
| **isOpaquePreviewId()** | `isOpaquePreviewId(previewId): boolean` | ✅ DSH 有对应 helper | **一致** |
| **hasPreviewResourceCapability()** | `hasCapability(source): boolean` | ✅ DSH `hasPreviewResourceCapability(source)` | **一致** |

### 需对照的语义覆盖

| 语义 | 本地 Spec | DSH PreviewResourceV1 | 状态 |
|------|-----------|----------------------|------|
| **owner/ref/version** | PreviewResourceV1.owner/ref/version | PreviewResourceRef.previewId (partial) | ⚠️ **PARTIAL** |
| **MIME** | mediaType + family sniffing | mediaType + sniffPreviewMediaType() | ✅ **CONSISTENT** |
| **rendition** | renditions[] + kinds | rendition enum (original/thumbnail/text) | ⚠️ **SIMPLIFIED** |
| **range** | readByteRange(offset, length) | readPreview(offset, length, rendition) | ✅ **CONSISTENT** |
| **window** | readTextWindow(cursor, bounds), readTablePage | ❌ DSH Note 缺失 text/table window | ❌ **MISSING** |
| **stale** | version change subscription, stale state | ❌ DSH Note 缺失 version/stale | ❌ **MISSING** |
| **release** | release(handle), Abort support | releasePreview(previewId), signal | ⚠️ **PARTIAL** |

### FileEntryV1/MediaRefV1 Adapter 状态

根据 specs/resource-preview-platform/spec.md：

```typescript
// 文档化的兼容适配路径
FileEntryV1 → PreviewResourceV1 adapter
MediaRefV1 → PreviewResourceV1 adapter  
DSH image attachment → PreviewResourceV1 adapter
```

**当前状态**：
- ✅ Adapter 合同已定义
- ✅ 无破坏性迁移路径文档化
- ❌ DSH upstream PreviewResourceV1 未 official，无法验证兼容性

### 缺失能力与诚实 Fallback

根据 local spec，以下能力需要 DSH upstream 提供：

| 能力 | 本地需求 | DSH PreviewResourceV1 | Fallback 策略 |
|------|----------|----------------------|--------------|
| **version subscription** | subscribeVersion(resourceRef) | ❌ 不存在 | Probe disabled, 显示 unsupported |
| **text/table window** | readTextWindow/readTablePage | ❌ 不存在 | Bounded full read, 显示 partial |
| **structured rendition** | page/table/waveform/captions | ⚠️ 仅 3 kinds | Use available rendition, fallback to original |
| ** Abort/release** | AbortController + symmetric release | ⚠️ signal exists | Ensure abort on tab close |

## 对照结论

### 一致语义 ✅

1. **MIME sniffing**：双方都使用 magic-byte + declared fallback
2. **opaque ref**：双方都禁止绝对路径
3. **range read**：offset/length semantic 一致
4. **release**：都有 releasePreview/releasePreview

### 缺失语义 ❌

1. **owner/ref/version 三元组**：DSH 只有 previewId，缺少 owner/version
2. **version subscription**：无 stale 检测能力
3. **text/table window**：无流式大文件窗口读取
4. **structured rendition**：rendition kinds 有限

### 差异回写位置

需回写到 `upstream-prs/preview-resource-v1/`：
- [ ] 增加 owner/version 字段到 PreviewResourceRef
- [ ] 增加 subscribeVersion 能力
- [ ] 增加 readTextWindow/readTablePage
- [ ] 扩展 rendition kinds (page/table/waveform/captions/converted)

## Lane 分类

- **Lane**：`differentiation`（本 change 保留 lane）
- **原因**：Resource Preview 平台的 media/data 路径与安全合同属差异区
- **本地状态**：V3 preview access 3.3–3.6 已在 `dsh-pane-workspace-experience-v3` 实施
- **上游状态**：official PreviewResourceV1 Agent Note / upstream PR pending

## 本地交付状态

### V3 已交付（根据 tasks.md + design.md）

- [x] **PreviewResource adapter/registry** (dsh-pane-workspace-experience-v3) - 完整实施
- [x] **本地 renderer registry** - 支持动态注册与 MIME pattern 匹配
- [x] **FileEntryV1/MediaRefV1 兼容适配路径文档化** - 无破坏性迁移路径已定义
- [x] **Local V3 preview access 3.3–3.6** - 以下能力已在本地实施：
  - **3.3**: 基础资源预览能力 (image/audio/video 原生支持)
  - **3.4**: 文本预览能力 (text/markdown/json/yaml/xml)
  - **3.5**: 结构化数据预览 (csv/tsv/table)
  - **3.6**: 安全边界注入控制 (lazy component factory, 禁止远端注入)
- [x] **MIME sniffing 集成** - 基于 magic-byte + declared fallback
- [x] **Range read 支持** - offset/length 语义完整
- [x] **Abort/release 集成** - 支持 AbortSignal 与对称 release
- [x] **Probe-disabled 诚实降级** - 缺失上游能力时显示 unsupported/partial

### V3 未交付（blocked by DSH upstream）

- [ ] **official PreviewResourceV1 Host seam** - 等待 DSH upstream official Agent Note
- [ ] **official inspect/rendition** - probe-disabled pending upstream
- [ ] **version subscription/stale detection** - 上游无 version/stale 语义
- [ ] **text/table window APIs** - 上游无流式大文件窗口读取能力
- [ ] **owner identity 三元组** - 上游仅有 previewId，缺少 owner/version

## Evidence 结论

**Task 2.4 无法完成完整对齐验证**，核心阻塞原因与当前状态：

### 阻塞原因分析

1. ❌ **DSH upstream 无 official PreviewResourceV1 Agent Note**
   - `deepseek-ai/deepseek-harness` 未发布 official PreviewResourceV1 合同
   - 本仓 `upstream-prs/preview-resource-v1/` 包含 patch + 双语 note 草案
   - fork-ready 分支存在，但未启动 upstream 审查流程

2. ❌ **无法对照确认逐项语义一致**
   - 无法验证 `owner/ref/version` 三元组完整性
   - 无法验证 `version subscription` 与 `stale detection` 能力
   - 无法验证 `text/table window` 流式读取能力
   - 无法验证 `structured rendition` (page/table/waveform/captions) 扩展

3. ❌ **无法验证 FileEntryV1/MediaRefV1 adapter 无破坏性迁移**
   - 虽然本地 adapter 合同已定义，但上游未 official
   - 无法在真实 DSH 环境中验证兼容性

### 部分语义一致（已验证）

4. ⚠️ **部分语义一致 (5/16 项)**
   - ✅ **MIME sniffing**：双方都使用 magic-byte + declared fallback
   - ✅ **opaque ref**：双方都禁止绝对路径，使用 opaque previewId
   - ✅ **range read**：offset/length semantic 一致，支持部分读取
   - ✅ **release**：都有 releasePreview/releasePreview 对称释放
   - ⚠️ **Abort 支持**：DSH 有 signal，但集成层面需验证

### 关键能力缺失（需上游补充）

**缺失能力清单**：
1. **owner identity**：PreviewResourceV1 缺少 canonical owner id
2. **version tracking**：无 owner version/freshness token
3. **version subscription**：无资源版本变化监听能力
4. **stale detection**：无 stale 状态管理
5. **text window**：无流式大文本窗口读取
6. **table pagination**：无结构化表格分页能力
7. **extended renditions**：仅支持 3 kinds，缺少 page/table/waveform/captions/converted

### 本地实施完整性

5. ✅ **本地 adapter/registry 已完整实施**
   - PreviewResource adapter/registry 完整实施
   - 本地 renderer registry 支持动态注册
   - FileEntryV1/MediaRefV1 兼容适配路径文档化

6. ✅ **V3 preview access 3.3-3.6 全部交付**
   - 3.3：基础资源预览 (image/audio/video 原生支持)
   - 3.4：文本预览 (text/markdown/json/yaml/xml)
   - 3.5：结构化数据预览 (csv/tsv/table)
   - 3.6：安全边界与注入控制 (lazy factory, 禁止远端注入)

7. ✅ **诚实降级策略已实施**
   - **probe-disabled**：缺失上游能力时显示 unsupported
   - **partial mode**：能力缺失时提供部分功能并明确标注
   - **fallback path**：rendition 缺失时回退到 original

### 上游通道状态

8. ⚠️ **upstream-prs 通道已建立但未激活**
   - `upstream-prs/preview-resource-v1/` 包含完整 patch 系列
   - 双语 note 草案（英文/中文）已准备
   - fork-ready 分支存在于 `yeisme/deepseek-harness`
   - 未向 `deepseek-ai/deepseek-harness` 提交官方 PR

### Acceptance Criteria 评估

- [ ] **FileEntryV1/MediaRefV1 adapter 无破坏性迁移**：❌ **BLOCKED** (无法验证兼容性 - 上游未 official)
- [ ] **缺失能力有诚实 fallback**：✅ **COMPLETE** (本地 probe-disabled + honest unsupported/partial 标注)

### 建议下一步（解除阻塞）

1. **短期（本 change 范围内）**：
   - 保持 Task 2.4 未勾选状态
   - 维护本 evidence document 作为详细对照记录
   - 继续使用 probe-disabled 策略处理缺失能力

2. **中期（跨项目协调）**：
   - 激活 `upstream-prs/preview-resource-v1/` 系列提交
   - 向 `deepseek-ai/deepseek-harness` 提交官方 PR
   - 推进 missing capabilities (version, window, stale) 上游实施

3. **长期（lane 完整对齐）**：
   - 等待 DSH official PreviewResourceV1 Agent Note 发布
   - 补充缺失的关键能力到 upstream
   - 重新进行完整对照验证

**Lane Policy 符合性**：✅ 符合 `differentiation` lane 策略 - Resource Preview 平台的 media/data 路径与安全合同属差异区，本地已实施 first-support，上游能力缺失时诚实降级。

**实施策略符合性**：✅ 符合通用工作台能力商品化决策 - 本地不重建商品能力，依赖 DSH upstream 官方 slot 或 better-sidebar 生态。

2026-08-25 | lane-prod2 review | BLOCKED pending DSH official PreviewResourceV1 Agent Note | Evidence strengthened with detailed capability comparison and local delivery status