## Context

现有 File Host 只覆盖读取、预览和带 version fence 的文本写入。文件/目录的创建、重命名、移动、复制、删除和传输若直接从 Pane 调用文件系统，会绕过 session owner、candidate workspace、lease、CAS、冲突预检、幂等、恢复和审计边界。

本 change 在 Harness Plugins 内新增 provider-neutral 合同和本地受保护单用户 owner。Web Explorer 消费合同；Hosted adapter 只有在 Control Plane 提供 principal/tenant/workspace/generation 授权证据后才可启用。TUI 本轮只共享类型与 fixtures。

## Goals / Non-Goals

**Goals:**

- 为固定资源动作提供 `preflight → execute → reconcile → undo` 合同。
- 所有 intent 绑定 owner fence、opaque refs、expected revision、preview digest 与 idempotency key。
- 提供进程重启后仍可 restore 的 owner-managed trash。
- 提供可取消分块 upload/import 与一次性短期 download ticket。
- 让 Explorer 以 proposal/review/receipt 驱动动作，不做即时写入和静默覆盖。

**Non-Goals:**

- 不实现 chmod/ACL、压缩解压、批量改名或云端文件管理。
- 不把 trash 建在仓库内，不把大文件放进 JSON/base64。
- 不把本地 Host 进程当作 Hosted 多租户授权证明。
- 不改变现有 `FileHostV1`、`FileEntryV1`、文本编辑或 HTTP V1 方法。

## Decisions

### 1. 新合同独立于文本编辑，并复用 Git mutation envelope 语义

`FileResourceMutationCapabilityV1` 不扩展文本 patch 合同。它定义固定 action union、preflight proposal、execute receipt、reconcile 和 undo。状态名称与 Git mutation 保持一致语义：success、rejected、revision_drift、lease_lost、unknown、reconcile_required、rolled_back、degraded。

这种复用减少 UI 分支，同时避免让资源移动伪装成文本 edit。

### 2. Owner fence 与零写入 CAS

intent 必须包含 workspaceRef、principalRef、generation、leaseRef、expectedRevision、opaque target refs 和 idempotencyKey。preflight 产生绑定这些字段的 previewDigest 与短期 expiry；execute 只有在全部 fence 未漂移、用户冲突决策完整且 digest 匹配时才进入 owner 串行临界区。任一检查失败均零写入并保留 proposal。

candidate session 使用 candidate owner，普通 session 使用当前 workspace owner。owner 切换使 pending proposal、upload session 和 reveal token 失效，并让未发送引用 stale。

### 3. 冲突和危险操作分层确认

同名目标固定为 cancel、keep-both、replace 三选一。普通 proposal 在 Pane 内审阅；replace 和永久删除通过 Modal，并要求 owner 返回的目标短语。内部拖放只构造 move/copy proposal，外部拖放与 Import 按钮只构造 import proposal。

### 4. Trash 与 undo 由 owner 在 workspace 外持久化

本地 owner 把 trash payload 和最小恢复 metadata 写入用户级状态目录，默认保留七天并允许配置。仓库内不创建 `.trash`。trash receipt 提供 restore/undo token；永久删除只有 owner 明确声明支持时出现。回滚关闭 mutation capability 时不删除 trash、receipt 或 upload cleanup metadata。

### 5. Redirect 是 receipt 的一等结果

rename/move 成功返回 oldRef-to-newRef redirect 和新 revision。Explorer 在一个 reconcile transaction 中迁移树节点、打开 Tab、活动引用和未发送固定引用；已发送引用不迁移。浏览器不自行根据路径推导新 ref。

### 6. 传输使用二进制 chunk 和 owner ticket

upload session 绑定 session/workspace/generation，chunk 通过二进制 body 传输并可取消；完成上传只形成 import proposal，必须再 preflight/execute commit。download 由 owner 签发一次性、短期、ref+version 绑定 ticket。不可预览资源只有 owner 暴露独立 download availability 时才可导出。

### 7. Hosted 默认 typed disabled

本地受保护单用户 adapter 可进入 canary。Hosted adapter 在 principal、tenant、workspace、generation 与隔离证据缺失时只返回 capability disabled reason，不暴露裸 Host mutation 方法。

## Risks / Trade-offs

- [进程在 execute 后、receipt 前崩溃] → 返回 unknown/reconcile_required；相同 idempotency key 只能 reconcile，不能盲重试。
- [批量操作中途失败] → owner 记录逐项结果并执行逆序 rollback；rollback 不完整标记 degraded 并保留恢复证据。
- [trash 状态丢失] → workspace 外持久化、原子 metadata 写入、过期清理与 restore 集成测试。
- [大文件占用内存] → 二进制 chunk 写 staging file，限制 chunk/session 配额，取消后清理。
- [旧 ref 被浏览器继续使用] → redirect 后旧 ref typed stale；owner 仍以 session/workspace fence 验证。

## Migration Plan

1. Additive 发布 mutation/transfer 类型、disabled adapter 和 contract tests。
2. 本地 Node owner 接入 temporary workspace integration，默认 feature flag 关闭。
3. Explorer 加 proposal review、冲突选择、trash/restore、import/download UI；Hosted 保持 disabled。
4. Phase B 累计至少 50 次资源操作、10 次 trash/restore、5 次 conflict/reconcile，且数据丢失、越权、静默覆盖、不可恢复均为零后，本地 first-support 默认启用。
5. Hosted 由 Control Plane 提交独立授权与隔离证据后再启用。

## Open Questions

无阻塞问题。永久删除和 Hosted mutation 是否出现完全由 owner capability negotiation 决定。
