# Board Viewport Deterministic LOD 基线

## 1. 交付结论

`2.3c`已交付纯`service/internal/boards/query` projector。它不访问浏览器、不读取Owner payload、不直接查询数据库；输入仅为Board canonical candidate与可选normalized status index，near模式只接受typed batch resolver。

## 2. LOD语义

- `far`：按zoom bucket映射64至1048576的固定grid size；负坐标使用floor division；只返回cluster，不返回node、projection、edge或group。
- `medium`：返回按`x, y, node_ref`排序的canonical node geometry，以及按ref排序的bounded edge/group；不调用resolver。
- `near`：对canonical target type/ref/version执行一次batch resolver调用；输出按node ref排序的safe projection。

cluster ref由Board ref、Board revision、query digest与grid cell SHA-256派生；输入顺序、map迭代顺序和进程重启不会改变ref或输出顺序。每个cluster最多16个按ref排序的sample，type/status summary按token排序，count受page size上限约束。

## 3. 泄漏防线

- projector重验`2.3a` query digest与candidate page上限。
- node/group/edge会重验Board ref、safe refs、registry enum、geometry/bounds、style/label token与plain text；DB tamper不会直接投影。
- edge必须至少连接一个本页visible node；duplicate node/group/edge均fail closed。
- `not_authorized`和`needs_contract` projection禁止携带title、status、thumbnail、version或reason；tombstone只允许safe reason code。
- resolver缺失或返回raw error统一映射`board_needs_contract`，不拼接Owner error；missing/duplicate/unknown/unsafe projection返回`board_invalid_contract`。

## 4. 验证证据

```bash
task test:board-viewport-lod:component
```

Evidence：`temp/integration-test-runs/20260721001726-a2d5c5f2-fc11-4d53-8a57-13644ce4489d/`

- status：`passed`
- exit code：`0`
- duration：`6187 ms`
- redaction：enabled
- coverage：shuffled/restart determinism、negative cells、sample/type/status bounds、far leakage、medium no-resolver、near single batch、raw error redaction、unsafe DB/projection tamper、registry drift、candidate overflow、20次race、floor-cell fuzz。

## 5. 非声明范围

本任务不声明QueryViewport service或transport可用。`2.3d1`负责authority、Board revision、repository、resolver和cursor装配；`2.3d2`必须在隔离PostgreSQL上完成promotion后，`2.3d`才可关闭。
