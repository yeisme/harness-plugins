# Spatial Board Canonical Type Registry 实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.1d` 已完成 handler-free canonical Board type/relation registry：

- 固定 `workbench.board_type_registry.v1` contract；
- 固定 9 个 node descriptors 与 canonical ordinal；
- 固定 10 个 relation descriptors 与 canonical ordinal；
- relation descriptor 使用 source/target type bitsets；
- node descriptor 反向携带 source/target relation bitsets；
- 固定 contract min/max、projection schema ref、dependency ids、default style、style policy 与 availability；
- 固定 directed、endpoint canonicalization、binding policy 与 label token policy；
- canonical snapshot 使用不包含 digest 自身的 payload 计算 deterministic SHA-256；
- Go `CheckReady` 对内置 canonical descriptors 做 exact match，拒绝 partial、duplicate、unordered、legacy 与 tamper；
- TypeScript consumer 重算相同 digest，交叉验证 node/relation bitsets，并要求调用方提供 expected digest；
- CLI 支持原子 `--output` 与 strict `--check`，unknown/trailing payload fail-closed。

Canonical digest：

```text
sha256:fa4deff008f1ddb60ecf00372711b9cd109a99724613f813e2172324f9076430
```

## 2. 实现资产

```text
service/internal/boards/registry/snapshot.go
service/internal/boards/registry/snapshot_test.go
service/cmd/workbench-board-contract/main.go
service/cmd/workbench-board-contract/main_test.go
api/schema/workbench/board/v1alpha1/board-type-registry.json
packages/task-sdk/src/board-models.ts
packages/task-sdk/test/board-registry.test.ts
Taskfile.yml
```

生成资产只能通过 CLI 更新：

```bash
task board:type-registry:generate
```

## 3. Canonical matrix 边界

- `relates_to` 是唯一允许任意 canonical node type 组合的 relation；endpoint ref self-loop 仍由后续 domain rule 拒绝。
- `feeds_input` 仅允许冻结 matrix 中的 source types 指向 `workflow_definition`，binding policy 为 `workflow_input_draft`。
- 其他 relation 的 binding policy 全部为 `forbidden`。
- `belongs_to` 不存在于 snapshot；group membership 继续只使用 `BoardNode.groupRef`。
- Registry 仅描述能力与组合，不包含 handler、projection body、target content、credential、URL/path 或 provider payload。
- 所有 node availability 当前保持 `needs_contract`；后续 capability resolver 只能基于依赖合同晋级，不能修改 canonical snapshot。

## 4. 验证与证据

```bash
task board:type-registry:test
task test:board-type-registry:component
CGO_ENABLED=1 go test -race ./service/internal/boards/registry ./service/cmd/workbench-board-contract -count=10
bun run typecheck
```

Component evidence：

```text
temp/integration-test-runs/20260720203310-e82d0bf1-e80e-4862-a752-20aefdc57a2d/
status=passed
exit_code=0
redaction=enabled
```

验证覆盖：

- generation/check/round-trip；
- deterministic digest 与 Go/TypeScript parity；
- source/target bitsets 与 node reverse bitsets；
- tamper、partial、duplicate、unordered、legacy、unknown、trailing；
- contract ahead/behind 与 digest mismatch；
- pure-Go test/vet、race repeat 与 TypeScript typecheck。

## 5. 未完成边界

- `1.3` 尚需让 Board domain rules 只消费此 registry，不复制 relation matrix。
- BoardService、repository、transport handler、Web palette 与 migration 尚未实现。
- Web palette 后续必须通过 SDK/生成 snapshot 消费 registry；不得维护静态 node/relation allowlist。
- Capability availability 晋级依赖 R1-R3 与 R4 service readiness，不能由 registry 文件或前端单独声明。
