# Auctra Provider Delivery（auctra-screenplay-room-v1 §7.2）

Provider 侧交付物（只新增文件；`../manifest.json` 仍由 Workbench owner 会话持有，其
`provider_pending=true` 与零 digest 的翻转属于本 change task 7.5 的真实 canary，不属于本交付）。

## 内容

- `auctra-provider-contract.json` — 机器可读交付清单：owner contract 真值（schema digest
  `b3a409c4…`、event digest `0bd3c471…`，§4.4 因 room 13 行进入 allowlist 而变更，pre-§4.4
  pin fail-closed `contract_mismatch`）、room 合同 digest `7b60a00b…`、13 条 loopback 路由与
  `?major=1` 协商语义、generated 三件套逐字节 sha256、consumer/provider operation 命名一一映射
  （`auctra.screenplay.*` ↔ `screenplay.room.*`）、stable errors 全表 + HTTP 映射 + `unknown_accept`
  禁止新 key 语义、capability matrix（全部 needs_contract + 晋级 blockers）、fixture 指针（provider
  §6.1 双 fixture + consumer fixture 不变）、provider 侧证据指针、rollback 说明
  （breaking_surfaces=[]、deprecation window=none）。
- `screenplay_room_contract.json` / `screenplay_room_openapi.json` / `screenplay_room.ts` —
  auctra `internal/api/generated/` 三件套的 exact 副本（sha256 记录在上文件）；再生成命令也在上文件。

## 消费方式

1. 本 change task 7.5 真实 loopback canary 时，把 `auctra-provider-contract.json` 的 owner
   schema/event digest 与 generated 三件套对入 `../manifest.json`（翻转 `provider_pending`），
   重跑 Go owner connector conformance。
2. fixture 包（`../fixtures/`）保持不变，继续只用于 UI/consumer 测试；capability 仍恒
   `needs_contract`，真实 canary 通过后按 selected operations 逐项晋级。

## Provider 侧状态

`cli/auctra auctra-screenplay-room-v1` 26/29：CLI/HTTP/receipt/owner allowlist/Viewer/fixtures/
perf 门/integration runner 已实现；剩 §7.3 workbench 联跑 canary 与 §7.4 兼容收口（见
`auctra-provider-contract.json.evidence`）。
