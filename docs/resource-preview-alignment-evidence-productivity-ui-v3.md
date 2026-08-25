# DSH Workspace Productivity UI V3 - Task 2.4 Resource Preview 合同对照评审证据

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

### 需对照的语义覆盖

| 语义 | 本地 Spec | DSH PreviewResourceV1 | 状态 |
|------|-----------|----------------------|------|
| **owner/ref/version** | PreviewResourceV1.owner/ref/version | PreviewResourceRef.previewId (partial) | ⚠️ PARTIAL |
| **MIME** | mediaType + family sniffing | mediaType + sniffPreviewMediaType() | ✅ CONSISTENT |
| **rendition** | renditions[] + kinds | rendition enum (original/thumbnail/text) | ⚠️ SIMPLIFIED |
| **range** | readByteRange(offset, length) | readPreview(offset, length, rendition) | ✅ CONSISTENT |
| **window** | readTextWindow(cursor, bounds), readTablePage | ❌ DSH Note 缺失 text/table window | ❌ MISSING |
| **stale** | version change subscription, stale state | ❌ DSH Note 缺失 version/stale | ❌ MISSING |
| **release** | release(handle), Abort support | releasePreview(previewId), signal | ⚠️ PARTIAL |

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

- [x] PreviewResource adapter/registry (dsh-pane-workspace-experience-v3)
- [x] 本地 renderer registry
- [x] FileEntryV1/MediaRefV1 兼容适配路径文档化
- [x] Local V3 preview access 3.3–3.6

### V3 未交付（blocked by DSH upstream）

- [ ] official PreviewResourceV1 Host seam
- [ ] official inspect/rendition (probe-disabled pending upstream)
- [ ] version subscription/stale detection
- [ ] text/table window APIs

## Evidence 结论

**Task 2.4 无法完成**，因为：

1. ❌ DSH upstream 无 official PreviewResourceV1 Agent Note
2. ❌ 无法对照确认 owner/ref/version、MIME、rendition、range/window、stale、release、error 逐项一致
3. ❌ 无法验证 FileEntryV1/MediaRefV1 adapter 无破坏性迁移（上游未 official）
4. ⚠️ 部分语义一致 (MIME, range, release)，但关键能力缺失 (version, window, stale)
5. ✅ 本地 adapter/registry 已实施，但 official inspect/rendition 保持 probe-disabled

**Acceptance Criteria**：
- [ ] FileEntryV1/MediaRefV1 adapter 无破坏性迁移：BLOCKED (无法验证兼容性)
- [ ] 缺失能力有诚实 fallback：✅ 本地 probe-disabled + honest unsupported

2026-08-25 | lane-prod1 review | BLOCKED pending DSH official PreviewResourceV1 Agent Note