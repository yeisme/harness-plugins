# Layout v3 合同基线

## 1. 交付范围

本基线完成 R3 任务 1.1，只冻结可演进合同，不声明 LayoutService、数据库、transport 或 Web consumer 已上线。

- Proto：`workbench.layout.v1alpha1.WorkbenchLayoutService`。
- JSON/TypeScript contract：`workbench.layout.v0.1`。
- 实体：Profile、Revision、Preset、PaneDocument、PaneInstance、Dockview adapter、Event。
- 方法：get profile/revision、list presets、save、save copy、reset、watch events。
- mutation：必须提供 expected revision（save/reset）与 idempotency key；save copy 使用独立 profile name。
- authority：request 不接受 principalRef，服务实现必须从 R1 PrincipalContext 派生 subject/membership/allowed actions。

## 2. 安全与兼容性

| Surface | Change | Compatibility | Rollback |
| --- | --- | --- | --- |
| Proto/RPC | 新增 package/service/messages/field numbers | additive | 不注册 service，保留生成类型 |
| JSON Schema | 新增独立 schema | additive | 停止发布 layout capability，不删除 schema |
| TypeScript SDK | 新增 models/client/exports 与两个稳定 error code | additive | 旧消费者不受影响；新 consumer 由 flag 禁用 |
| Taskfile | 新增 generate/test/evidence targets | additive | 可停止调用，不影响旧任务 |

`deprecation_window: none`，因为没有删除、重命名、重类型或重新解释既有 surface。实现期使用 expand-then-contract：先发布 contract/disabled capability，再发布 service/transport，再迁移 Web consumer，最后停止 legacy canonical writes。

## 3. Fail-closed 规则

- Profile/revision/preset/event contract version 不匹配时不保留 provider 字段。
- Pane 参数只有显式 allowlist，不接受任意 map、URL、token、raw payload 或 private path。
- Adapter payload 上限 256 KiB、最大 32 层、单层最多 512 项；命中敏感 key 即拒绝整个 revision。
- 同一 revision 的 documents 必须属于同一 tenant/workspace，instance 必须引用已声明 document。
- Layout contract validation failure 映射为稳定 `contract_mismatch`，不把不受信任 error code 直接写入稳定 envelope。

## 4. 生成与验证

```bash
task layout:contract:generate
task layout:contract:test
task test:layout-contract:component
```

生成器是 proto 与 JSON Schema 的唯一写入入口；`--check` 用于阻止手工漂移。`buf generate` 生成纯 Go message/service types，不引入 cgo，也不注册 transport handler。

2026-07-20 当前证据：

- `task layout:contract:test`：生成漂移、Buf、4 个 Layout SDK tests 与 TypeScript typecheck 通过。
- `task test:layout-contract:component`：证据写入 `temp/integration-test-runs/20260720132459-2b154219-515a-4312-8a80-d4fefc18f4d2/`。
- `bun test packages/task-sdk`：48/48 通过；`bun run test:contract`：50/50 通过。
- `CGO_ENABLED=0 go test ./service/gen/workbench/layout/v1alpha1`：生成 Go 合同包可编译。
- R3 与 umbrella OpenSpec 均通过 strict validation。

## 5. 下一依赖

1. R1 提供 server PrincipalContext、membership version、layout read/write allowed actions 与 revoke event。
2. R0 提供 GORM SQLite/PostgreSQL profile、migration runner、backup/restore、readiness 与 metrics 基线。
3. R3 实现 Layout domain sanitizer、checksum、expected revision transaction、recovery event 和 repository。
4. Registry 自动投影 HTTP/gRPC/JSON-RPC/SDK parity；BFF 只代理同源请求。
5. Web 在 `layout_v3` flag 下 shadow read/write，确认 revision 后停止 legacy localStorage canonical write。
