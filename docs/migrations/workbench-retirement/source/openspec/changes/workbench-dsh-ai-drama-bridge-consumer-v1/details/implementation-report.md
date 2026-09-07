# workbench-dsh-ai-drama-bridge-consumer-v1 — Lane 1/2/3 实施报告（2026-08-29）

实施者：Claude Code 子代理（Lane 1 + Lane 2 + Lane 3 门控骨架 + 验证 + 本报告）。
按任务纪律：**未勾选任何 tasks.md checkbox**（统一验收由主代理执行）；**未 git commit**。

## 1. 交付清单

### Lane 1 — SDK 合同层（additive）

| 文件 | 内容 |
| --- | --- |
| `packages/task-sdk/src/harness/bridge-v2.ts`（新增） | V2 envelope closed-schema 类型、validator、canonical SHA-256（纯 JS，依赖零）、固定 lens 映射、12 stable reason codes、nonce `^[0-9a-f]{32}$`、epoch-ms expiry（`<= now` 即 expired）。导出：`harnessBridgeV2ContractVersion` / `Direction` / `TargetSurface` / `Intents` / `LensMap` / `ReasonCodes` / `NoncePattern` / `DigestPattern` / `CanonicalFieldOrder` / `harnessBridgeV2Canonical` / `harnessBridgeV2Digest` / `validateHarnessBridgeV2Envelope` / `harnessBridgeV2LensFocus` |
| `packages/task-sdk/src/harness/index.ts`（additive 一行） | `export * from "./bridge-v2";`（含中文注释说明 additive 面） |
| `packages/task-sdk/test/harness-bridge-v2.test.ts`（新增，14 用例） | 冻结 digest 向量、closed intent 全通过、raw route/URL→malformed、未知 key、合同身份漂移、统一 nonce、expiry 边界（`== now` 即 expired）、digest 篡改、ref 上界/不安全内容、12 reason codes 精确列表、lens 固定映射、alpha 兼容（alpha validator 零改动，拒收 V2 版本字面量） |

校验顺序（fail-closed，与 Go 侧逐字段对齐）：非对象/未知 key → `malformed`；contractVersion / direction / targetSurface / intent / nonce 格式 → `contract_mismatch`；ref/整数/digest 结构损伤 → `malformed`；digest 不匹配 → `malformed`；`expiresAtUnixMs <= now` → `expired`。

### Lane 2 — server ingress（additive wiring）

| 文件 | 内容 |
| --- | --- |
| `service/internal/harnessbridge/contract.go`（新增） | 包文档（失败闭环顺序 + 脱敏边界）、合同常量、closed intent 枚举、`lensMap`/`LensFocusFor`、regex（nonce/digest/safeRef/unsafeContent）、`canonicalFieldOrder`、`Envelope`+`Canonical()`、error sentinels+`Reason()`、`integerValue`（json.Number/int64/int/整值 float64）、`Validate`（schema→方向→surface→intent→nonce→ref→整数→digest 重验→expiry）、`DigestEnvelope`、`OwnerSnapshot`/`OwnerSource` |
| `service/internal/harnessbridge/ingress.go`（新增） | 六类脱敏 evidence 常量（`bridge_consumed/denied/expired/contract_mismatch/reconcile_required/target_unavailable`）、redacted `Evidence`、`ReplayConfig`、`Ingress`+`TenantResolver`/`StaticTenant`、`NewIngress`（默认容量 256 FIFO / TTL 15min / tenant:local）、`Consume`（Validate→replay→consumeFresh→recordReplay；幂等回放返回原 Result 与原 CorrelationID）、`consumeFresh`（nil owner→denied fail-closed；!authorized→denied；版本漂移→reconcile_required 暴露 mismatch；否则固定 lens）、`evidence()` 脱敏投影（仅 category/contractVersion/intent/surface/reason/correlation/timestamp）、`newCorrelationID`（crypto/rand） |
| `service/internal/harnessbridge/ingress_test.go`（新增） | 冻结向量、19 例 reject matrix（含阶段断言）、expired 终态、raw route/lens key/nil map→malformed、lens 固定映射、replay 幂等+conflict+tenant 隔离、denied 不泄露存在性、reconcile 暴露 drift、nil owner denied、evidence 永不带 nonce/envelope/refs、有界容量、TTL 过期后重执行 |
| `service/internal/transport/harnesshttp/handler.go`（additive） | `bridgeV2Route = "/v1alpha1/harness/bridge/v2/consume"`（POST-only，其余 405）、`maxBridgeBodyBytes = 8192`、`NewWithBridgeIngress`/`BindBridgeIngress`、`consumeBridgeV2`（nil ingress→503 `target_unavailable`；MaxBytesReader；`decoder.UseNumber()`；非 JSON→400 `malformed`；wire 投影 `bridgeV2Result`；nonce/envelope/refs 绝不回显） |
| `service/internal/transport/harnesshttp/bridge_test.go`（新增） | fixture envelope 打开 lens+脱敏断言、未绑定 503、raw route/坏 JSON→malformed 不回显、negative matrix→stable reasons、denied+reconcile 投影、wire 级 replay 幂等（响应逐字节一致、owner.calls==1）、method/alpha 路由保持 |

### Lane 3 — 跨仓 conformance（门控骨架，3.1）

`tests/conformance/bridge-v2-fixtures.test.ts`（新增）：读取 `WORKBENCH_DSH_BRIDGE_FIXTURES_DIR` 指向的 DSH 发布包 `fixtures/dsh-workbench-ai-drama-bridge-v2/`（manifest.json + cases/*.json）；**不本地复制/伪造 fixture，不 import DSH 内部模块**；版本门（`fixtureVersion === "2026-08-29.1"` + contract 一致，不一致即 fail）；执行 `consumer`/`both` actor 的 `validate`/`ingress` 用例（含 `replayBefore` replay 语义，digest 用 `Bun.SHA256.hash(canonical, "hex")`）；数量门防静默漏跑；env 缺失即 skip 并打印 skip 说明与精确重跑命令。

3.2 / 3.3 / 3.4 未做（见 §4）。

## 2. 验证证据（全部绿）

| 命令（仓库根 `client/yeisme-workbench`） | 结果 |
| --- | --- |
| `bun run typecheck` | **0 error**（strict，含 `noUncheckedIndexedAccess`/`exactOptionalPropertyTypes`） |
| `cd apps/web && bunx tsc --noEmit` | exit 0 |
| `bun test packages/task-sdk/test/harness-bridge-v2.test.ts` | 14 pass / 0 fail |
| `bun test packages/task-sdk/test/`（全量，含 alpha） | **452 pass / 0 fail**（alpha 面零回归） |
| `CGO_ENABLED=0 go test ./service/internal/harnessbridge/... ./service/internal/transport/harnesshttp/ -count=1` | `ok harnessbridge` / `ok harnesshttp` |
| `CGO_ENABLED=0 go build ./service/cmd/workbenchd` | BUILD OK |
| `openspec validate workbench-dsh-ai-drama-bridge-consumer-v1 --strict` | `Change ... is valid` |
| Lane 3 skip 模式（env 未设） | 0 pass / 1 skip / 0 fail |
| Lane 3 fixtures 模式（env 指向真实发布 fixtures） | **1 pass / 0 fail** |

## 3. Fixtures 缺失证据与本 change 的处理

- **本工作区缺失**：`@yeisme/dsh-ai-drama-director` 不在 `bun.lock` 依赖、不在 `node_modules/@yeisme/`，fixtures 目录不在 `client/yeisme-workbench` 任何位置 → 默认（env 未设）skip 是正确行为，已验证。
- **真实 fixtures 在 sibling 仓**：`/workspaces/yeisme-agent/agent/harness-plugins/packages/host/dsh-ai-drama-director/fixtures/dsh-workbench-ai-drama-bridge-v2/`（34 个 case + manifest.json，fixtureVersion `2026-08-29.1`）。**绝未复制/伪造**；仅在一次验证运行中以 env var 指向该目录，证明门为绿（1 pass / 0 fail）。
- 实现正确性的合同真值来自该发布 fixtures 的冻结向量（NOW_MS=1_800_000_000_000、nonce `0123456789abcdef...`、open_show/open_artifact 两个 contractDigest），已逐字节写入 SDK 测试与 Go 测试并全部匹配。

## 4. Lane 3 精确前置（3.2 / 3.3 / 3.4）

- **3.2 evidence run**：需双仓约定的集成运行目录。前置：(a) 两个仓owner对 `WORKBENCH_DSH_BRIDGE_FIXTURES_DIR` 指向方式达成约定（npm 包路径 vs CI artifact 解包目录）；(b) evidence runner 采用统一 runner（本 change 的 runner 可直接执行 consumer/both validate+ingress 全量 34 用例）；(c) 输出落到 change `details/` 的 run 记录。
- **3.3 canary release gate**：前置 3.2 全绿 + 双仓 owner 同签（fixtureVersion 一致 + contract 字面量一致）；建议 gate 命令即为 `WORKBENCH_DSH_BRIDGE_FIXTURES_DIR=<dir> bun test tests/conformance/bridge-v2-fixtures.test.ts`，非零退出即阻断。
- **3.4 tracked to DSH-side removal**：alpha 面（`workbench.harness.dsh_bridge.v1alpha1`）下线由 DSH 侧 removal change 追踪；本 change 只保证 V2 与 alpha 互斥且 alpha 零漂移（452 测试含 alpha 全绿；Go alpha 路由投影不变，见 `TestBridgeV2MethodAndAlphaRoutesUnchanged`）。

## 5. v1alpha1 兼容性说明

- `packages/task-sdk/src/harness/validate.ts` / `types.ts` **零改动**（alpha validator 语义不变；全量 452 测试通过含全部 alpha 用例）。
- alpha HTTP 面（`/v1alpha1/harness/context|descriptors|projections|diagnostics`）行为零变化；V2 端点 `/v1alpha1/harness/bridge/v2/consume` 挂在既有 `/v1alpha1/harness/` mount 前缀下，**runtime 无需任何改动**（`service/internal/runtime/runtime.go` 的 `mux.Handle("/v1alpha1/harness/", ...)` 已覆盖；亦未改 runtime，无 handoff 需求）。
- Go alpha 侧 handoff nonce 规则（`^[A-Za-z0-9][A-Za-z0-9._~-]{7,127}$`）有意保留不动；V2 面统一为 `^[0-9a-f]{32}$`（contract-frozen），两合同面互斥、各自语义独立。
- alpha validator 拒收 V2 版本字面量（`contract_mismatch`），V2 validator 拒收 alpha 合同字面量——互斥由各自 contractVersion 门实现。

## 6. 脱敏边界（不变量复核）

- 六类 evidence 仅携带：category / contractVersion / intent / target surface / reason code / correlation ref / timestamp；测试断言 evidence 对象**不含** nonce、envelope 任意字段、workspace/project/show/resource/episode/artifact/receipt ref。
- HTTP 投影同界：`bridgeV2Result` 无任何 envelope 字段回显；测试以 fixture nonce 与 refs 逐一断言不出现于响应体。
- replay record 键为 `${tenant}|${nonce}|${contractVersion}` + canonical digest，仅驻内存（有界 256 FIFO / 15min TTL，design 决策 #3：无持久 ledger），不进 evidence、不进响应。
