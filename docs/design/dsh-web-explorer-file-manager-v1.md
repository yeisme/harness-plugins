# DSH Web Explorer、统一引用与文件管理 V1

## 决策摘要

本设计把 `dsh.explorer` 收口为 DSH Web 唯一文件导航视图，并在同一 owner/session 边界内组合目录投影、严格预览、结构化引用、文件资源 mutation 与分块传输。能力归属为 `split-owner`：Harness Plugins 拥有 Web UI、本地 File Host 与 provider-neutral 合同；DSH Conversation owner 提供结构化引用发送；Hosted principal/tenant/workspace 授权由 Harness Control Plane 提供。

实施拆为两个 OpenSpec：

- `dsh-web-explorer-reference-v1`：canonical Explorer、`FileTreeProjectionCapabilityV2`、严格 preview gate、hover/focus 与 `ComposerReferenceCapabilityV1`。
- `dsh-file-resource-mutation-v1`：`FileResourceMutationCapabilityV1`、`FileTransferCapabilityV1`、proposal/receipt、trash/undo 和本地 first-support。

TUI 本轮只共享合同和兼容 fixtures，不复制完整文件管理 UI。

## 核心数据流

```text
DSH session owner
      │
      ├─ FileTreeProjectionCapabilityV2 ──> dsh.explorer navigator
      │                                      │
      ├─ inspect/openRendition ───────────────┼─> preview/content group
      │                                      │
      ├─ FileResourceMutationCapabilityV1 <──┼─ proposal/reconcile/undo
      │                                      │
      └─ FileTransferCapabilityV1 <───────────┘

PreviewResourceV1 / SelectionAnchor
      └─ ComposerReferenceCapabilityV1
             └─ conversation.input.dock
                    └─ DSH Conversation structured-send capability
```

浏览器只持有 opaque ref、cursor、owner fence、bounded preview/reference 数据和短期 ticket；绝对路径、symlink 目标解析、workspace authority、trash payload 与 upload staging 都留在 Host。

## Explorer 交互

- 默认显示 Host 可枚举的全部条目，包括 hidden、ignored、敏感名称、未知类型和 symlink。
- 目录单击展开/折叠，逐层懒加载；全仓搜索由 Host 分页；前端只虚拟化已加载行。
- 文件单击打开临时 preview；双击或 Enter 固定 Tab。primary preview 与批量 checked set 独立。
- 只有 owner `inspect/openRendition` 返回 usable `ready|partial` 才能打开或引用。不可预览条目仍可见；若独立 download capability 可用，可以下载但不能打开或引用。
- hover 或 keyboard focus 稳定约 350ms 后加载 metadata-only 卡片，pending/error 同时反映在卡片和原行；coarse pointer 使用 Info/More。
- 宽屏锁定 navigator 并在相邻 content group 打开；窄屏进入内容页，返回后恢复原行焦点。
- symlink 默认不跟随；broken、循环和 workspace 外目标保持可见但禁用 reveal。

## 统一引用

`ComposerReferenceCapabilityV1` 使用 revisioned `snapshot/subscribe/dispatch` 管理一个活动引用和最多八个固定引用。文件成功预览自动替换活动引用，只有 Pin 才进入固定集合；selection 仅在明确引用动作时进入同一 envelope。

引用包含 owner/ref/version、scope、bounded quote、digest、label、freshness，以及 preview window 或 selection anchor。partial 资源只能引用已检视窗口。资源 version 变化把未发送引用标记 stale；已发送消息冻结原快照，不跟随重命名或新内容。

引用 chips 只进入公开 `conversation.input.dock`。结构化发送 seam 缺失时 fail-closed，只提供显式复制为 `@mention`/引用文本，不自动改写 Composer 正文。

## 文件资源操作

固定动作是 create file/directory、rename、move、copy、trash、restore 与 import commit。所有动作遵循：

```text
intent
  -> preflight(proposal + previewDigest + conflict + expiry)
  -> execute(owner lease + CAS + idempotency)
  -> receipt
  -> reconcile / undo
```

任一 workspace/principal/generation/lease/revision 漂移都零写入拒绝并保留 proposal。同名冲突必须选择 cancel、keep-both 或 replace；replace 与永久删除进入危险 Modal。内部拖放只生成 move/copy proposal；外部拖放和 Import 先创建 upload session，再生成 import proposal。

trash 由 owner 存储在 workspace 外，默认保留七天并支持重启后 restore。rename/move receipt 返回 oldRef-to-newRef redirect，当前树、Tab、活动引用和未发送固定引用原子迁移，已发送引用保持冻结。

## 传输

上传通过 session-bound 二进制 chunk 写入 workspace 外 staging，可取消、过期并受配额限制；大文件不进入 JSON/base64。上传完整后仍需 mutation preflight/execute 才提交到 workspace。

下载通过 owner 签发的一次性短期 ticket，绑定 session/ref/version。ticket 过期、重放、owner 漂移或 version 不匹配均非枚举拒绝。

## 兼容与发布

- Release 1：旧 kind 隐藏于 picker，shim 复用 canonical runtime并记录弃用；所有新入口打开 `dsh.explorer`。
- Release 2：不再创建旧实例，只保留 request/persistence alias。
- 兼容窗口结束后的下一 release：通过独立 breaking change 决定是否删除 alias。
- Phase A 连续七天真实使用且无授权/数据事故后默认启用 Explorer/引用。
- Phase B 至少 50 次资源操作、10 次 trash/restore、5 次 conflict/reconcile，且数据丢失、越权、静默覆盖、不可恢复均为零后，本地 first-support 默认启用。
- Hosted mutation 在 Control Plane 授权与隔离证据完成前保持 disabled。

回滚只切回 legacy Explorer policy并关闭 reference send、mutation 和 transfer capability；布局、已冻结引用、trash 和 receipts 全部保留。

## 非目标

本轮不包含 chmod/ACL、压缩解压、批量改名、云端文件管理或完整 TUI 文件管理 UI。
