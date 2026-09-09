# Task 2.4 对照审计矩阵：Harness PreviewResourceV1/host/registry × DSH/领域 Resource Preview seam（2026-09-09）

- 任务：2.4 [Owner: Harness Plugins] 对照 DSH/领域 Resource Preview seam 与 Harness `PreviewResourceV1`/host/registry specs，确认 owner/ref/version、MIME、rendition、range/window、stale、release、error 逐项一致。
- 审计结论：**BLOCKED（维持）** —— 映射逐项完整、两条 Acceptance 腿（adapter 无破坏性迁移、缺失能力诚实 fallback）在本地均有据；但「逐项一致」未达成：10 项语义中 4 项一致、1 项简化（子集）、5 项在 DSH 侧缺失，且唯一 DSH 侧对照源是未合入的 fork-ready 合同草稿（task 1.4 external gate 仍 blocked，official seam 未发布）。
- 历史证据：`docs/resource-preview-alignment-evidence-productivity-ui-v3.md`（2026-08-25 首评 + 2026-09-02 复核：系列 apply-check 绿）。

## 对照源

### Harness 侧（存在，完整）

| 源 | 位置 |
| --- | --- |
| 跨项目 capability spec（Resource Preview 四 Requirement：safe descriptor 合同、bounded/可取消/可释放访问、格式矩阵诚实降级、active content 默认禁用） | `openspec/changes/dsh-workspace-productivity-ui-v3/specs/dsh-workspace-productivity-experience/spec.md` |
| 实施 handoff spec（`resource-preview-platform`，13 条 Requirement：descriptor、owner-scoped host、registry、解析顺序、Open With、access 生命周期、状态机、cache 隔离、单 active renderer、typed intents、lazy renderer、HMR-safe） | `openspec/changes/dsh-pane-workspace-experience-v3/specs/resource-preview-platform/spec.md` |
| 本地合同与 host 实现（`PreviewResourceV1`/`PreviewAccessHandleV1`/`ResourcePreviewHostV1`/typed error；`LocalResourcePreviewHost`） | `packages/bundle/dsh-rich-media/src/client/preview/types.ts`、`access.ts` |
| renderer registry（preference→exact→suffix→family→binary fallback；lazy load 失败逐级降级，不 MIME 试探执行） | `packages/bundle/dsh-rich-media/src/client/preview/registry.ts` |
| FileEntry/MediaRef/attachment/artifact 兼容 adapter | `packages/bundle/dsh-rich-media/src/client/preview/adapters.ts` |
| bounded source（URL/handle 双适配，cap 内读取、oversized→undefined 诚实降级） | `packages/bundle/dsh-rich-media/src/client/preview/sources.ts` |
| binary/archive 诚实降级（256B hex/ASCII cap、`ArchiveEntryListPreviewV1` total/truncated/malformed） | `packages/bundle/dsh-file-document/src/client/binary-preview.ts`、`src/types.ts` |
| office 不支持格式保持可见可降级 | `packages/bundle/dsh-desktop-workbench/tests/file-preview-mapping.spec.ts` |

### DSH 侧（唯一可用源 = fork-ready 草稿；official seam 缺位）

| 源 | 检查结果 |
| --- | --- |
| `upstream-prs/preview-resource-v1/`（fork-ready 未合入，rebase 基 `b150a551b8d`，自测 vitest 3/3） | 合同草稿：`PreviewResourceRef{previewId, mediaType, bytes?}`、`PreviewReadRequest{previewId, offset?, length?, rendition?, signal?}`、`PreviewReadResult{mediaType, bytes, complete}`、`PreviewResourceSource{openPreview/readPreview/releasePreview}` + `isOpaquePreviewId`/`sniffPreviewMediaType`/`hasPreviewResourceCapability` |
| 上游 alpha 0.1.5-alpha.1 四包 tarball（`temp/alpha-grep-0909/`） | `preview`/`rendition`/`mime` 三词 0 命中；dsh-fs 有**原语级**邻近能力：`FsVersion` 不透明版本 token + `FS_STALE_VERSION`、`readByteRange(offset,length)`、`FS_TOO_LARGE`/`FS_ABORTED`、`stat` 带 version——均为文件写入路径原语，未组成预览合同 |
| 已安装 `@deepseek-ai/dsh-attachment` 0.1.0-rc.6 | `ImageAttachmentRef`：opaque `attachmentId` + bytes-verified `mediaType` + 尺寸；不可变对象（无 version 字段）；无 rendition/range 面 |
| official PreviewResourceV1 Agent Note | **不存在**（09-02 全树 1702 篇 notes 复核；alpha 0 命中） |

## 逐项映射矩阵（任务列举八组语义，展开为 10 项）

| # | 语义 | Harness spec 侧定义 | DSH 侧对应面（草稿） | 结论 |
| --- | --- | --- | --- | --- |
| 1 | owner | `PreviewResourceV1.ref{owner, ref, version}`；`LocalResourcePreviewHost.assertOwner` → typed `mismatch`（不泄露存在性）；capability spec「打开文件」owner-issued opaque reference | 草稿 `PreviewResourceRef` 无 owner 字段（previewId 单字段）；alpha fs `FsTarget` 为 backend 内稳态 id，非跨 owner canonical id | **语义差异/缺失** |
| 2 | ref | `previewResourceKey({owner,ref,version})`；descriptor 校验拒绝路径/URL 形 ref | 草稿 `previewId` + `isOpaquePreviewId`（拒绝 `/`、盘符、`file:`、`://`） | **一致** |
| 3 | version | `version` 字段 + `previewResourceIdentity(key@version)` + cache 按 owner/ref/version/rendition 隔离 | 草稿无 version；alpha dsh-fs `FsVersion`+`FS_STALE_VERSION` 仅写路径守卫，未进预览合同 | **缺失**（预览面） |
| 4 | MIME | owner sniffed `mediaType` + `family` 确定性解析（`mediaFamilyOf`）；mismatch/suspicious 状态禁止逐 renderer 试探 | 草稿 `sniffPreviewMediaType(bytes, declared)`：PNG/PDF magic → declared → octet-stream，语义同构（magic 覆盖集更小）；无 family 分类 | **一致**（草稿面；magic 集与 family 为子集） |
| 5 | rendition | `PREVIEW_RENDITIONS` 8 类：original/thumbnail/text/page/table/waveform/captions/converted；unknown kind fail closed | 草稿 3 类：`'original'\|'thumbnail'\|'text'` | **简化（子集）** |
| 6 | range | `readByteRange`（`BYTE_RANGE_MAX` 256KiB；`bounds` typed error；offset/length 校验） | 草稿 `readPreview(offset, length, rendition)` + `complete` flag（方向一致；无上限常量、无 bounds typed error） | **一致**（方向）；草稿无上限/边界语义 |
| 7 | window | `readTextWindow`（`TEXT_WINDOW_MAX` 64KiB，cursor/loaded/total/truncated）+ `readTablePage`（`TABLE_PAGE_MAX` 200 行 + additive columns） | 草稿无 text window/table page API | **缺失** |
| 8 | stale | `subscribeVersion(ref, listener)`（未接 owner source 时返回 noop）+ stale 状态（Refresh/Compare/Keep old view）+ cache 新旧 version 隔离 | 草稿无 version subscription/stale | **缺失** |
| 9 | release | handle `release/abort`（revokeObjectURL、stream cancel、worker terminate 对称释放）+ host `releaseAll/fence/switchSession/disposeProvider` + pane state 泄漏守卫 | 草稿 `releasePreview(previewId)`（方向一致；无对称 abort/fence/session 生命周期语义） | **部分一致** |
| 10 | error | `PreviewAccessErrorCode` 9 类（aborted/released/fenced/bounds/unsupported/official_seam_disabled/offline/mismatch/expired）+ `isPreviewAccessAbort` | 草稿无 typed error 合同（无错误面） | **缺失** |

汇总：**4 一致（ref/MIME 方向/range 方向/release 方向）、1 简化（rendition 子集）、5 缺失（owner/version/window/stale/error）**。

## Acceptance 腿一：FileEntryV1/MediaRefV1 adapter 无破坏性迁移 —— 达成（本地可验证）

- `FileEntryV1` 合同原样保留（`packages/bundle/dsh-file-document/src/types.ts`：id/parentId/name/kind/mediaType/size/summary/capabilities，validator 未改）；adapter `fileEntryToPreviewResource` 纯增量，FileEntryV1 本身无 owner/version 字段，adapter 以默认值 `owner='dsh'`、`version='v1'` 填充，不要求上游改合同。
- `MediaRefV1` 合同原样保留（`packages/bundle/dsh-rich-media/src/host/types.ts`）；`mediaRefToPreviewResource` 1:1 无损映射 owner/ref/version/mediaType/size/width/height/duration/title/summary/capabilities。
- `attachmentRefToPreviewResource`/`artifactRefToPreviewResource` 同为增量（sourceKind 区分，不并改旧类型）。
- 测试证据：`packages/bundle/dsh-rich-media/tests/preview-platform.spec.ts`（maps a MediaRefV1 / maps a FileEntry-like projection without constructing paths / maps attachment and artifact projections）；`host-types.spec.ts`（MediaRefV1 validator 兼容）；`dsh-file-document/tests/types.spec.ts`。
- 结论：V1 字段零重命名、零删除、validator/consumer 兼容路径保留——**无破坏性迁移成立**。

## Acceptance 腿二：缺失能力有诚实 fallback —— 达成（本地可验证）

| 缺失能力 | 降级行为与证据 |
| --- | --- |
| official inspect/rendition/window/range/subscribe/release seam（六项） | `OFFICIAL_DSH_PREVIEW_SEAM_PROBE` 全 false + reason `seam-unpublished`；`officialDshInspect`/`officialDshOpenRendition` 抛 typed `official_seam_disabled`；`preview-access.spec.ts:59-64` 断言 fail-closed |
| 无兼容 renderer | registry 解析终到 binary fallback family；`loadBest` lazy import 失败仅降级下一兼容 descriptor，绝不 MIME 试探执行（`registry.ts` + `preview-access.spec.ts` 3.6 coverage） |
| 大文本/表格/字节流 | `TEXT_WINDOW_MAX` 64KiB / `TABLE_PAGE_MAX` 200 / `BYTE_RANGE_MAX` 256KiB；oversized read → `undefined`，renderer 诚实降级不膨胀内存（`sources.ts`）；partial 状态携带 loaded/total/truncated |
| unknown binary | `formatBinaryPreview` 256B hex/ASCII cap + `truncated`/`totalBytes` 事实（`binary-preview.ts`） |
| archive | `ArchiveEntryListPreviewV1` honest totalEntries/listedEntries/truncated/malformed（`dsh-file-document/src/types.ts`） |
| Office/EPUB 无 conversion | unsupported 格式保持可见、metadata + Download/Open external（`file-preview-mapping.spec.ts` "keeps unsupported office formats visible for honest degrade"） |
| 生命周期状态 | 状态机走 resolving/loading/ready/partial/stale/unsupported/error/offline 且 abort 不闪 error（`preview-access.spec.ts:170`）；切换/关闭/逐出/unload 对称 release（:247）；cache 按 owner/ref/version 隔离 + count/byte LRU，不写 web storage（:279） |
| access secret | `paneStateContainsAccessSecrets` 守卫 URL/objectURL/stream/worker 不进 Pane 投影（`access.ts`） |

## 验收判定与差异回写

- 腿一（无破坏性迁移）✅、腿二（诚实 fallback）✅，但任务主体「owner/ref/version、MIME、rendition、range/window、stale、release、error **逐项一致**」未达成（5 缺失 + 1 简化），且对照基准只能取未合入草稿：**维持 BLOCKED，不勾选**。若在 official seam 缺位时勾选，会掩盖「DSH 侧合同尚未存在」这一事实。
- 差异回写：缺口全部位于 DSH 侧草稿（owner/version/subscribeVersion/text-table window/typed error/rendition 扩类），已在 `docs/resource-preview-alignment-evidence-productivity-ui-v3.md`「差异回写位置」节列示，归宿为 `upstream-prs/preview-resource-v1/` 系列（task 1.4 owner：DeepSeek Harness / Domain owners），本审计不重复开第二份回写清单。Harness 侧 owning design 无需改写（probe-disabled + additive adapter 已冻结为「等上游」状态）。

## 解锁条件

1. `upstream-prs/preview-resource-v1` 系列被上游接受、official PreviewResourceV1 Agent Note 发布，且草稿补齐 owner/version/subscribeVersion/readTextWindow/readTablePage/typed error/扩展 rendition；或
2. 上游自行发布覆盖同等语义的 official note（此时以官方合同重跑本矩阵，必要时修订 adapter 默认值映射）。

成立后：把矩阵「DSH 侧对应面」列替换为正式合同条目、复跑两条 Acceptance 腿（adapter 兼容性以官方合同实测）、再评估勾选。
