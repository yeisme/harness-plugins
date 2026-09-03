## Why

DSH Web File Host 当前只支持目录读取、预览和版本围栏文本写入；没有 create、rename、move、copy、trash/restore、upload 或安全 download 合同。若 Pane 直接使用路径或即时文件系统调用，会绕过 workspace owner、candidate、lease、CAS、冲突预检和恢复边界。

## What Changes

- 新增独立 `FileResourceMutationCapabilityV1`，覆盖 create file/directory、rename、move、copy、trash、restore 与 import commit。
- 所有资源 mutation 统一采用 `preflight → execute → reconcile → undo`，绑定 workspace/principal/generation/lease、expected revision、opaque refs、preview digest 与 idempotency key。
- 新增 `FileTransferCapabilityV1`：session-bound 分块上传、取消/清理与一次性 download ticket；不使用 JSON/base64 承载大文件。
- Explorer 增加主光标/批量勾选分离、Pane 内 proposal review、危险 Modal、同名三选一、内部/外部拖放 proposal 和逐项 receipt。
- trash 由 owner 在仓库外持久化，默认七天可配置；rename/move receipt 返回 oldRef→newRef redirect，供树、Tab 和未发送引用原子迁移。
- 本地受保护单用户先进入 canary；Hosted/多租户 mutation 在 Control Plane 提供 principal/tenant/workspace/generation 授权与隔离证据前保持 typed disabled。

## Capabilities

### New Capabilities

- `dsh-file-resource-mutation`: 资源操作 intent、预检、提交、reconcile、undo、trash、冲突与 ref redirect。
- `dsh-file-transfer`: 分块 import、取消、commit 与 owner-authorized 一次性 download。

### Modified Capabilities

无。`FileHostV1`、`FileEntryV1`、`fs.tree/read/binary/write` 与现有文本编辑合同保持原样；新能力通过独立 capability 和版本化 API 加入。

## Impact

- File Host public contracts、Node 本地 owner、`/yeisme-files/api` additive methods 与 Desktop Workbench Explorer actions。
- 新增 owner-managed trash/upload staging 状态和 integration evidence；不把 schema/state 写入仓库文件。
- Hosted adapter 后续由 Harness Control Plane 拥有；本 change 只冻结 provider-neutral合同与 disabled reason。
- Rollback 关闭 mutation/transfer capability，保留 read/preview、trash 与 receipts；未知结果只能 reconcile，不自动重试。
