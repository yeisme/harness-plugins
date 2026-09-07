# Spatial Board TypeScript SDK 合同实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.1c` 已完成 Board TypeScript SDK 合同层：

- `WorkbenchBoardClient` 覆盖 `WorkbenchBoardService` 全部 32 个 RPC 方法；
- `WorkbenchClient.http()` 与 `WorkbenchClient.jsonRpc()` 均暴露独立 `board` facade；
- JSON-RPC 使用 `workbench.board.v1alpha1` namespace；
- HTTP 覆盖 Board、Node、Group、Edge、Viewport、Template、Event 与 Capability 路由；
- mutation 将 `idempotencyKey` 写入 transport options，并要求显式 expected revision/version；
- 路径参数不会重复写入 mutation body；
- page token、event cursor、viewport cursor、page size 与数组上限均 fail-closed；
- 15 个 Board stable error codes 进入共享 SDK error contract；
- 保持旧 `WorkbenchClient` 构造器兼容，未配置 Board transport 时明确返回 unavailable。

实现资产：

```text
packages/task-sdk/src/board-models.ts
packages/task-sdk/src/board-client.ts
packages/task-sdk/src/workbench-client.ts
packages/task-sdk/src/http.ts
packages/task-sdk/src/json-rpc.ts
packages/task-sdk/src/models.ts
packages/task-sdk/src/index.ts
packages/task-sdk/test/board-models.test.ts
packages/task-sdk/test/board-client.test.ts
packages/task-sdk/test/board-wiring.test.ts
packages/task-sdk/test/json-rpc.test.ts
Taskfile.yml
```

## 2. Strict model 边界

- Board、Node、Projection、Edge、Group、Viewport、Cluster、Template、Event 与 Capability 均使用显式 typed model。
- Template placeholder/node/edge/group/value 与 viewport filter 逐层校验，不接受 `metadata`、raw/provider payload 或未知字段。
- Node type、relation type、event type、state、LOD 与 capability state 只接受 canonical enum。
- geometry 与 bounds 使用安全整数和固定范围；viewport filter 要求 bounded unique arrays。
- SDK 只验证输入输出与 transport naming，不实现 relation matrix、Board revision state machine 或自动 mutation retry。
- `unknown_accept`、version conflict 与 cursor resync 由未来 BoardService/domain 处理，SDK 不推断服务端事实。

## 3. 验证与证据

```bash
task board:sdk:test
task test:board-sdk:component
bun test packages/task-sdk
bun run typecheck
```

Component evidence：

```text
temp/integration-test-runs/20260720203629-37023b9d-4492-427e-83a3-aa61a5ec24d6/
status=passed
exit_code=0
redaction=enabled
```

验证结果：

```text
15 Board SDK/transport tests passed
46 Board-focused expectations passed
71 package regression tests passed
211 package expectations passed
TypeScript typecheck passed
```

## 4. 未完成边界

- `1.1d` 尚需生成 canonical Board type/relation registry snapshot 与跨语言 digest gate。
- `1.3` 尚需实现 registry-backed deterministic Board domain rules。
- SDK route 可调用不代表 Board HTTP/JSON-RPC/gRPC service handler 已注册。
- Web palette、Board repository、PostgreSQL migration、event stream 与生产恢复流程仍按后续任务交付。
