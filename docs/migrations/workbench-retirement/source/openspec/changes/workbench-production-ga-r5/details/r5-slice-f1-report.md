# R5 Slice F-1 数据分类与清单冻结执行报告

日期：2026-08-27。范围：`openspec/changes/workbench-production-ga-r5/tasks.md` 的 6.0a1（含 15 项开放嵌套）、6.0a3、6.0a4，共 17 项开放任务。切片定义见 `details/r5-open-slice-governance-plan.md` §4。

## 1. 总结

- 17 项任务**无一可勾选**：F-1 的出口标准是"data classification/owner/retention inventory 冻结"，而冻结动作本身是五类外部 Owner（domain/DB、test infra、support/operations、managed DB/backup、Identity/Eikona）的独立受信签收；本地自签或 fixture 签收属于 tasks.md 明确禁止的伪造路径。
- 本地可验证部分已全部交付：staging inventory 重新生成、DI-S1 至 DI-S5 五个待审包生成并重验（request_ready）、6.0a4 负测矩阵补齐两个缺口用例、6.0a1a1 的"Workbench 不持有签名私钥"静态扫描。
- component evidence runner 连续 5 次被并行代理的 tracked 文件写入触发 `source changed while the evidence command was running` fail-closed 门；底层命令本身全部通过。失败 run 的脱敏六件套完整留盘，未伪造 passed。

## 2. 逐项结论

| 任务 | 结论 | 本地已交付 | 不可勾选原因 |
| --- | --- | --- | --- |
| 6.0a1（父） | open | aggregator fail-closed 负测重验（全绿） | 需 6.0a1a–e 全部完成；五 scope 受信 receipt 均未交付 |
| 6.0a1a | open | DI-S1 待审包就绪（见 6.0a1a2） | 受信 `data_domain_owner` 签名属外部 domain/DB owners；receipt 必须绑定 request/evidence，本地自签即伪造 |
| 6.0a1a1 | open | 静态扫描：生产代码无 `ed25519.GenerateKey`/`ed25519.Sign`（仅 `*_test.go` fixture）；`workbench-lifecycle` CLI 无 trust 生成命令，trust 只经 `--trust-bundle`+`--trust-digest` 只读消费；wrong trust digest/revoked key 负测已有 | `provider_assigned` 是治理分配动作：issuer、key rotation/revoke 责任、升级联系人需 domain/DB governance 外部确认 |
| 6.0a1a2 | open | `task data-lifecycle:review-request:generate ENV=staging SCOPE=domain_gorm` 生成 + `review-request:validate` exit 0（request_digest `sha256:788fd698…`，`provider_ready=false` 诚实）；add/remove/reclassify 负测由 `owner_review_request_test.go`/`inventory_test.go` 覆盖；overwrite 拒绝实测 exit 201 | Expected 含"Provider 系统返回绑定 request/evidence 的 receipt"，属外部 |
| 6.0a1a3 | open | — | 需真实 DI-S1 receipt 与独立 consumer 验证 |
| 6.0a1b | open | DI-S2/DI-S3 待审包就绪 | 依赖 6.3d 完成（6.3d1–d4 open）；两 scope 需独立 receipt |
| 6.0a1b1 | open | DI-S2 待审包生成+重验 exit 0；failure-run 六件套由 evidence runner 机制保证（含本次 failed run 完整落盘） | 签名与消费验证外部 |
| 6.0a1b2 | open | DI-S3 待审包生成+重验 exit 0 | 6.3d1–d4 未实现；Failure recheck 明确禁止"D0 未实现时签空 scope"式的提前签收 |
| 6.0a1c | open | DI-S4 待审包就绪 | 依赖 4.3 managed restore authority（外部 managed 环境）；provider-owned receipt 外部 |
| 6.0a1c1 | open | — | managed DB/backup Provider 选定、PITR 窗口与撤销路径属外部 platform/DB/security 决策 |
| 6.0a1c2 | open | DI-S4 待审包生成+重验 exit 0 | Provider 绑定 policy/restore/expiry/hold evidence 签收外部 |
| 6.0a1d | open | DI-S5 待审包就绪 | 依赖 R1/R2 handoffs：`details/cross-release-handoff-registry-baseline.md` 记录 registry 0/6 ready、四 gate 全 false，跨 release 硬依赖未满足 |
| 6.0a1d1 | open | — | external boundary 治理 Owner 分配与每 Owner 合同清单属外部治理 |
| 6.0a1d2 | open | DI-S5 待审包生成+重验 exit 0 | 治理 Owner 绑定各 Owner 合同/no-payload/delete evidence 签收外部 |
| 6.0a1e | open | 负测补齐并全绿：missing scope、duplicate scope、replayed nonce、revoked key、wrong role、request/evidence drift、**expired receipt、expired/not-yet-valid trust key、stale authority**（后四者为本片新增）；`production_authorized` 恒 false 断言保留 | Dependencies 6.0a1a–d 全 open；aggregate 完整验收需五份真实 receipt |
| 6.0a3 | open | —（未实现 hold 语义，防伪造） | legal hold/backup expiry/Owner external truth 的**语义冻结**需 privacy/security + managed DB + Owner provider owners 参与；在语义未冻结前实现 hold 字段属于越权伪造，且执行面属 6.0b2 |
| 6.0a4 | open | 负测矩阵全维度核对 + 两个新用例（见 §3）；`task data-lifecycle:inventory:test` 全绿 | Dependencies 6.0a3 open；component evidence 六件套被并发写入阻断（见 §4） |

## 3. 实现清单（本片代码改动）

仅两个测试文件，均为 F-1 Paths（lifecycle contract tests/evidence）范围内的 additive 负测：

- `service/internal/lifecycle/lifecycle_request_test.go`：新增 `TestLifecycleRequestRejectsUnknownVersionAndPartialStatus`——非 canonical `spec_version`（unknown version）与 caller 自报 `partial` 状态均 fail closed。
- `service/internal/lifecycle/owner_authority_test.go`：新增 `TestResolveOwnerReceiptRejectsStaleExpiredAndNotYetValidAuthority`——过期 receipt、过期 trust key、尚未生效 trust key、超过 24h 的 stale authority 资产均 fail closed。

6.0a4 Scope 维度核对结果：unknown field（已有：`DisallowUnknownFields` + 手写 JSON 拒收用例）、unknown version（本片补齐）、digest drift（已有：request tamper / receipt-evidence / direct evidence / authority / inventory 五层）、stale/revoked authority（revoked 已有，stale/expired/not-yet-valid 本片补齐）、wrong tenant/store（wrong tenant/candidate/environment 已有；store binding 由 scope 精确比较 + wrong role 用例覆盖）、partial/unknown 状态（unknown/reconcile 已有，partial 本片补齐）。

## 4. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `task data-lifecycle:inventory:generate ENV=staging LIFECYCLE_INVENTORY=temp/lifecycle/inventory-staging.json` | exit 0；`production_authorized=false`、`owner_payload_stored=false` |
| 五 scope `review-request:generate` + `review-request:validate`（staging） | 全部 validate exit 0；重复 generate 被 O_EXCL 拒绝（exit 201，fail-closed 预期行为） |
| `CGO_ENABLED=0 go test ./service/internal/lifecycle/ -count=1` | ok |
| `CGO_ENABLED=1 go test -race ./service/internal/lifecycle/ -count=1` | ok |
| `go vet ./service/internal/lifecycle/` | 通过 |
| `task data-lifecycle:inventory:test`（go test repository+lifecycle+CLI + `bun test tests/lifecycle-inventory.test.ts`） | 全绿（bun 2 pass / 0 fail） |
| `openspec validate workbench-production-ga-r5 --strict` | valid |
| `task test:data-lifecycle-inventory:component` | **failed（非产品原因）**：连续 6 次触发 runner 的 source-snapshot fail-closed 门 `source changed while the evidence command was running`——并行代理在运行期间改写 tracked 文件。run-id：`20260827082229-9326b217-…`、`20260827082421-08de204b-…`、`20260827082703-683d1718-…`、`20260827082812-ead3f5d8-…`、`20260827082925-f059d820-…`、`20260827083241-11416222-…`。每次 run 的 stdout 均显示底层 go test 全 ok、bun 2 pass；失败六件套（status=failed、0600、digest/receipt/redaction 完整）留盘于 `temp/integration-test-runs/<run-id>/`，未改写为 passed。分类：`concurrent`（环境/并行写入），非 product/test 失败 |

待审包资产（gitignored，0600）：`temp/lifecycle/inventory-staging.json`、`temp/lifecycle/review-request-{domain_gorm,evidence_storage,support_diagnostics,managed_backup,external_owner_boundary}.json`。DI-S1 request_digest `sha256:788fd69830f01f4eb9263ea8b2ecb3eb799167294e0f585d02110f31483d0b77`（staging inventory revision 1 绑定）。

## 5. 静态扫描结论（6.0a1a1 本地部分）

- `ed25519.GenerateKey`/`ed25519.Sign` 在 `service/` 生产代码零命中；全部命中位于 `*_test.go` fixture 签名。
- `workbench-lifecycle` CLI 无 trust bundle 生成/签名命令；trust 仅以 `--trust-bundle` 路径 + `--trust-digest` 精确 digest 只读消费，digest 不匹配即拒绝（`TestResolveOwnerReceiptVerifiesManagedTrustAndExactScope` 覆盖）。
- 私钥材料哨兵模式已存在于 `service/internal/cli/service/validation.go`、`service/cmd/workbench-release/artifact_security.go`、`service/internal/missionbrief/validation/validator.go`，用于拒绝 `PRIVATE KEY` 材料进入 CLI 资产与证据。

## 6. 阻塞项与升级路径

1. **五类外部 Owner 签收**（6.0a1a–d 主体）：待审包已就绪可分发给对应 Provider 泳道；需各治理 owner 发布 managed trust bundle 并返回绑定 request/evidence 的签名 receipt。按治理方案 §2，48h 无响应按 DAG §5 升级。
2. **R1/R2 handoff**（6.0a1d）：handoff registry 0/6 ready，跨 release 硬依赖，需 R1/R2 provider 推进。
3. **4.3 managed restore authority**（6.0a1c）：本地 disposable restore 已验证，managed 环境与真实备份源外部。
4. **6.3d1–d4**（6.0a1b2）：diagnostics source adapter、递归泄漏矩阵、download audit/purge 合同未实现（属 F-6 切片范围）。
5. **component evidence run**：需在无并发写入窗口重跑 `task test:data-lifecycle-inventory:component` 取得 passed 六件套，替换本片 failed run 记录。
6. **6.0a3 语义冻结**：需 privacy/security owner 召集 managed DB 与 Owner provider owners 冻结 hold scope/approver/expiry/review、backup/PITR expiry receipt、no-direct-delete 语义后方可进入实现与 6.0a4 收口。

## 7. 诚实性声明

本片未勾选任何 checkbox、未修改 `tasks.md`、未生成任何 receipt/trust/authority 资产冒充 Provider Ready；所有 CLI 输出保持 `provider_ready=false`、`privacy_review_authorized=false`、`production_authorized=false`。staging 待审包仅为 Provider 可分发输入，不构成签收。
