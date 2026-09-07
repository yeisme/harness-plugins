# R5 F-6 支持诊断包切片报告

日期：2026-08-27。范围：`tasks.md` 6.3d 子树 22 个开放项（治理方案 §4 F-6 行）。本报告是切片出口记录；按任务要求**未编辑 `tasks.md`**，所有 checkbox 保持原状，逐项「可勾选/不可勾选」结论见 §3。

注：治理方案要求「同 C-1 报告格式」，但截至本报告写入时 `details/` 下尚无 C-1 切片报告（C lane 并行进行中），故按治理方案切片表字段（范围/入口依赖/出口标准）+ 逐项状态 + 验证证据组织；如 C-1 报告先落地且格式不同，可对本报告做纯格式对齐，不改结论。

## 1. 切片边界与并行纪律

- 本切片只拥有 diagnostics 面：`service/internal/diagnostics/**`、`service/cmd/workbench-diagnostics/**`、`tests/support-diagnostics.test.ts`、Taskfile diagnostics 目标、`details/support-diagnostics-production-handoff.md`。
- F-1（数据分类/6.0a1 子树）并行中：6.3d3 的 retention/hold/purge 语义依赖 F-1 冻结的 inventory，本切片未实现 6.3d3，避免与 F-1 写租约冲突。
- R4 侧 engine 任务（6.3d1b1c2/c3/c4 等）Owner 为 R4 implementer，本切片只做依赖就绪性核验，不改 R4 代码或 R4 `tasks.md`。

## 2. 本次实现（6.3d2 / D2 安全故障矩阵基线）

handoff 文档 §5 明确「D2 测试设计可在 D1 实现期间并行准备」。本次落地了 D2 的递归安全扫描与 seeded leak 矩阵（additive，fail-closed 收紧，不改变既有合同字段）：

- `service/internal/diagnostics/security_scan.go`（新增）：`ScanBundleSecurity` 对 bundle 原始字节做递归 JSON 扫描——forbidden key（authorization/cookie/token/secret/password/dsn/credential/private_key/api_key/session_id/raw_prompt/system_prompt/provider_payload/chain_of_thought/stack_trace/argv/args/cmdline 等，segment 边界匹配）与 forbidden value（raw endpoint URL、DSN scheme、private path、`Bearer `/`authorization:`/`token=` 形态、PEM 块、JWT `eyJ` 前缀、Go stack/panic 标记），嵌套深度上限 32 层；所有错误为静态文案，不回显命中内容。
- `service/internal/diagnostics/bundle.go`：`LoadBundle` 改为有界读取后先过 `ScanBundleSecurity` 再 strict typed decode；`validateBundleShape` 增加 marshal 后递归扫描（覆盖 `ValidateBundle`/`WriteNewBundle` 的手工构造结构体路径）。
- `service/internal/diagnostics/security_scan_test.go`（新增）：15 个 seeded leak 用例（顶层/嵌套/深层 field 与 value 两个维度，成功与失败 bundle 双覆盖）+ 嵌套炸弹上限 + 文件矩阵（symlink、`/dev/null` device、目录、空文件、超 64KiB、gzip 魔数、尾随数据、非 JSON），并断言错误不携带注入的 marker。
- `service/cmd/workbench-diagnostics/main_test.go`：新增 CLI 级用例——schema 合法字段（summary）内的值级泄漏经 `bundle validate` 阻断，exit=2，stdout/stderr 均不回显注入 endpoint。
- `tests/support-diagnostics.test.ts`：新增 seeded value-level leak 用例（经 `task diagnostics:bundle:generate` + `task diagnostics:verify`），并登记两个新 Taskfile 目标。
- `Taskfile.yml`：新增 `diagnostics:d2:security:test` 与 `test:diagnostics-security:component`（additive，未改动既有目标）。

兼容性：`workbench.support_diagnostics_bundle.v1alpha1` 字段零变更；仅校验收紧为 fail-closed。既有全部 diagnostics 测试（含 D0/D1a/D1b0 合同）无修改通过。

## 3. 逐项状态（22 项）

| 任务 | 可勾选？ | 依据 |
| --- | --- | --- |
| 6.3d（父） | 否 | 依赖 6.3c（open）与子树全部完成；D0/D1a/D1b0/D2 基线绿但不构成 staging 验收 |
| 6.3d1 | 否 | 依赖 6.3c；source direct 最高 5（D1b0 合同态），未到 7 |
| 6.3d1b | 否 | 硬依赖 R5 4.2/4.3/4.4/4.5（backup/restore/DR 全 open）与 5.2（open） |
| 6.3d1b1 | 否 | D1b1a 已接真实 bootstrap；identity/delegation provider 与四 role engine probe 未齐 |
| 6.3d1b1b | 否 | D1b1b0 consumer 基线绿；Provider Ready 未交付（见下行） |
| 6.3d1b1b1 | 否（needs_contract/外部） | WP-I10 provider process、managed TLS/service mesh、issuer/JWKS/delegation authority 均缺；本仓库无真实 Identity provider 进程，保持 fail-closed，不得用 httptest/fixture 冒充 |
| 6.3d1b1c | 否 | 依赖 6.3d1b1b 与 c1–c5 |
| 6.3d1b1c1 | 否 | c1a/c1b/c1c 未齐 |
| 6.3d1b1c1a | 否（R4 侧证据就绪，R5 消费未接） | R4 4.1b1–4.1b5、5.1a–e、4.2 均已完成且有 PostgreSQL component evidence；但 R5 消费侧需写 handoff metadata（`workbench.release_handoff.v1` registry 归 Lane C 写租约），本切片未越权写入；parent 仍被 c1b 阻断 |
| 6.3d1b1c1b | 否 | R4 5.2b1a–d 完成且有证据，但 Dependencies 含 6.3d1b1b1（外部，未交付） |
| 6.3d1b1c1c | 否 | 依赖 c1a/c1b + frozen candidate manifest + production target registry（Lane C/B） |
| 6.3d1b1c2 | 否（R4-owned） | R4 5.2a1/5.2a2/5.2b2 已绿；该任务由 R4 executor implementer 拥有且依赖 c1，验收需 no-side-effect workflow system evidence |
| 6.3d1b1c3 | 否（R4-owned） | R4 4.2/5.2b3 已绿；依赖 c2 |
| 6.3d1b1c4 | 否（R4-owned） | R4 6.1a/6.1b/6.2/5.2b4 已绿；依赖 c3 + R2 Provider Ready（外部） |
| 6.3d1b1c5 | 否 | 依赖 c1–c4 + candidate manifest/approval authority；R4 7.3 已绿 |
| 6.3d1b1c6 | 否（跨 release） | 依赖 c5 + R4 5.0b2b2e1（open）/W8/W9；治理方案标注的跨 release 硬依赖未解除 |
| 6.3d1b2 | 否 | Workflow definition/policy digest 尚未由 typed API 提供（handoff §2 明示）；依赖 6.3d1b1 |
| 6.3d1c | 否（外部） | R1/R2 Provider Ready/Consumer Done 未到；依赖 6.3c |
| 6.3d1d | 否 | 依赖 6.3d1b/6.3d1c；staging caller-status 路径移除属于收口动作 |
| 6.3d2 | **基线已实现并验证；仍不可勾选** | 递归扫描+seeded leak 矩阵+文件矩阵落地（§2）；关闭需硬依赖 6.3d1 完成后跑完整 staging 矩阵并由独立 security owner 签收（handoff §5 D2 退出门），不得由实现者自签 |
| 6.3d3 | 否 | 依赖 6.3d2 + 6.0a2（后者已 done）；retention/hold/purge 语义依赖 F-1 的 6.0a1 数据分类冻结，按并行纪律让出，未实现 |
| 6.3d4 | 否 | 依赖 6.3d3 + frozen staging evidence + 独立 operations/security 签收 |

结论：22 项中 **0 项可在本次勾选**；1 项（6.3d2）完成本地可做的实现与验证基线，其余 21 项因硬依赖（外部 provider、Lane B/C/D/E 未闭项、R4 跨 release 任务、F-1 写租约）如实保持 open，无 fail-open 绕行。

## 4. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `CGO_ENABLED=0 go test ./service/internal/diagnostics ./service/cmd/workbench-diagnostics -count=1` | ok / ok |
| `CGO_ENABLED=1 go test -race ./service/internal/diagnostics ./service/cmd/workbench-diagnostics -count=1` | ok / ok |
| `go vet ./service/internal/diagnostics ./service/cmd/workbench-diagnostics` | 无输出（通过） |
| `CGO_ENABLED=0 go build ./service/...` | exit 0 |
| `task diagnostics:d2:security:test`（go test + bun test `tests/support-diagnostics.test.ts`） | go ok×2；bun 4 pass / 0 fail |
| `task test:diagnostics-security:component` | passed / exit 0 |
| `bun run typecheck` | exit 0 |
| `openspec validate workbench-production-ga-r5 --strict` | valid |
| `CGO_ENABLED=0 go test ./service/... -count=1`（final gate） | **concurrent 失败**：`service/cmd/workbench-release` build failed（`promotion.go:314 undefined: lastRevision`）。该目录为 Lane C 代理在制品（git status 显示 promotion/container_build 等未提交改动），与本切片 owned paths 无交集；本切片两个 owned 包测试独立全绿，按并发失败分类，不在本切片修复 |

Component evidence：`temp/integration-test-runs/20260827083017-8e28446d-c360-4a10-81e6-ee67c98e8f31/`，`summary.json` status=passed、exit_code=0，六件套文件 0600，redaction `total_redactions=0` 且 passed=true。

## 5. 出口标准差距（治理方案 F-6 行）

- 「safe support diagnostics bundle 实现并验证」：合同与递归安全基线已实现；staging 级完整验证（6.3d4）未达成。
- 「bundle 递归 redaction 核验 0 泄漏」：递归扫描与 seeded 矩阵 0 泄漏已直接证明；独立 security owner 签收未达成。
- 「support/operations 消费方验收」：未达成（DI-S3 最高只能到 `provider_assigned`，依赖 6.3d3）。

## 6. 阻塞项与升级建议

1. 6.3d1b1b1 外部四依赖（WP-I10、managed TLS/service mesh、issuer/JWKS、delegation authority）——按 DAG §5 计时升级；这是 6.3d1b1b→c 链的总闸。
2. R4 5.0b2b2e1（engine probes 回接 bootstrap 恢复矩阵）是 6.3d1b1c6 的跨 release 前置，建议 R4 lane 优先排。
3. 6.3d1b1c1a 的 R5 消费侧需要 Lane C 明确 W2 级 handoff metadata 的记录粒度与写租约；建议 C-1/C-5 切片给出结论后本切片再接入。
4. 6.3d3 待 F-1 的 6.0a1 retention/hold 冻结后启动。
5. R5 4.2/4.3/4.4/4.5、5.1/5.2 是 F-6 入口级依赖，属 Lane D/E，未闭。

备注：`tasks.md` 未改动；工作树中其他代理的未提交改动未触碰。
