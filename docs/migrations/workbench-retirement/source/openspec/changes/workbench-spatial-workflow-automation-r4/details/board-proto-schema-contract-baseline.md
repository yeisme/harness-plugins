# Spatial Board Proto 与 JSON Schema 合同实施基线

## 1. 完成范围

截至 2026-07-20，R4 `1.1b` 已实现：

- `workbench.board.v1alpha1` Proto contract与`WorkbenchBoardService`；
- Board、Node、NodeProjection、Edge、Group、Viewport、Cluster、Template、Event、Capability Snapshot与safe Error模型；
- 9类canonical node、10类canonical relation、3级LOD、template/capability/event/error enums；
- Board/Node/Group/Edge/Template CRUD、viewport query、event list/watch与capability query的typed request/response surface；
- 每个mutation显式expected board revision与idempotency key，不接受generic patch或共享任意body；
- JSON Schema由Go `schema-export`生成并支持`--check`；
- Go Proto/gRPC assets由`buf generate`生成。

实现与生成资产：

```text
api/proto/workbench/board/v1alpha1/board.proto
api/schema/workbench/board/v1alpha1/board.schema.json
service/gen/workbench/board/v1alpha1/board.pb.go
service/gen/workbench/board/v1alpha1/board_grpc.pb.go
service/cmd/schema-export/board.go
service/cmd/schema-export/main.go
service/cmd/schema-export/main_test.go
tests/board-contract-assets.test.ts
Taskfile.yml
```

## 2. 合同边界

- `belongs_to`未进入relation enum；group membership只使用`group_ref`。
- geometry使用bounded integer canvas units；Schema固定`x/y`与`width/height`范围。
- Proto/Schema不包含任意map、Struct、principal、credential、URL/path、raw/provider payload、CSS/HTML/SVG/icon URL字段。
- BoardNode只保存target safe ref/version；projection body是query-only typed safe fields。
- `workflow_binding_ref`只作为server-issued safe ref，不携带input mapping body。
- capability diagnostics只包含stable reason、contract range/digest、checked time与bounded evidence refs。

## 3. 生成与验证

```bash
task board:contract:generate
task board:contract:check
task test:board-contract:component
CGO_ENABLED=0 go test ./service/cmd/schema-export ./service/gen/workbench/board/... -count=1
CGO_ENABLED=0 go vet ./service/cmd/schema-export ./service/gen/workbench/board/...
```

Component evidence：

```text
temp/integration-test-runs/20260720200228-19110478-1075-4680-b535-f30d83f6254b/
status=passed
exit_code=0
redaction=enabled
evidence_scan=clean
```

额外通过：

```text
buf lint
schema-export --check
3 Board asset tests / 99 expectations
all command/query request definitions present
git diff --check
```

## 4. 未完成边界

- `1.1c`尚需实现TypeScript strict models/client与transport naming parity。
- `1.1d`尚需生成canonical type/relation registry snapshot与跨语言digest gate。
- `1.3`尚需实现registry-backed deterministic Board domain rules。
- Proto service定义不代表BoardService、repository、四transport或Web palette已可用。
- R1-R3 target contracts未closeout的node type继续保持`needs_contract`。
