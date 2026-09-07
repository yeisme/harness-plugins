# R5 C-4 制品扫描/redaction 切片报告

日期：2026-08-27。范围：`tasks.md` 3.4b5 子树 17 个开放项（治理方案 §3 C-4 行：3.4b5、b5b（含 b5b1–b5b5）、b5c（含 b5c1–b5c3）、b5d（含 b5d1–b5d5））。本报告是切片出口记录；按任务要求**未编辑 `tasks.md`**，所有 checkbox 保持原状，逐项「可勾选/不可勾选」结论见 §3。报告格式对齐 `details/r5-slice-f6-report.md`。

## 1. 切片边界与并行纪律

- 本切片只拥有：`service/internal/diagnostics/**`、`tests/` 下相关测试、`scripts/` 下相关脚本。
- **未触碰** `service/cmd/workbench-release/**`（C-3 代理独占）、`service/cmd/workbench-diagnostics/**`（F-6 写租约）、`Taskfile.yml`（任务禁止）、`tasks.md`。扫描器的 CLI/Taskfile 接线需求见 §6.2，移交 C-3。
- 范式参照 F-6 已交付的 `ScanBundleSecurity`（D2 基线，`details/support-diagnostics-production-handoff.md` D2 注记）：递归扫描、静态错误文案、命中零回显、fail-closed。
- 合同依据：`details/production-security-authority-handoff.md`（SEC2-1/SEC2-2/SEC3-0 验收与 receipt 禁止字段清单）。

## 2. 本次实现（三个本地扫描面基线）

全部 additive 新增于 `service/internal/diagnostics/`，不改变任何既有合同字段与行为：

- `content_scan.go`（新增）：三个扫描面共享的字节级原语。
  - `ScanFinding{Code, Path}`：receipt 安全投影，只有 finding code 与 safe 相对路径，无值/snippet/offset/hash（handoff §4.2 禁止项）。
  - `scanHighConfidenceStringFindings`：值形态判定——PEM 块、credential-bearing URL/DSN、JWT compact、`Bearer <值>`/`Authorization: Basic <值>`、≥8 字符的 credential 赋值、private path（`/home/<u>`、`/users/<u>`、`/workspaces/<u>`、`/root/`、`/var/run/secrets/`、`c:\users\<u>`）、metadata endpoint（169.254.169.254）、AKIA/ASIA、ghp_/github_pat_/glpat-/xox*。不按词面拦截字段名，满足 SEC2-2「合法字段名不误报」。
  - `scanTextFindings`：在高置信形态之上补充裸 marker（`token=`、`authorization:`、`set-cookie:` 等），用于日志/命令行/源码等非结构化文本。
  - `scanJSONDocumentFindings(data, strictKeys)`：递归 JSON 扫描，深度上限 64；strict 模式复用 D2 forbidden key 集合（runner-authored 六件套），value 模式只扫值（generated asset）。
  - `stripEvidenceRedactions`：两遍剥离 runner 脱敏占位符（先 `name=[REDACTED...]`/`Bearer [REDACTED_BEARER_TOKEN]` 合成形态，后裸占位符），保证重扫描针对未脱敏残留而非占位符本身；真实泄漏不含占位符形态，不受影响。
- `evidence_scan.go`（新增，SEC3-0 / 3.4b5c1 基线）：`ScanEvidenceRun` / `ScanEvidenceRuns`。
  - 强制六件套+redaction/digest/receipt 存在且为 regular file；`artifacts/` 目录必须存在；递归覆盖成功与失败 run 的全部文件（含未知额外文件）。
  - 逐文件重新读取内容扫描，**不信任 `redaction.json` 的 passed flag**；strict JSON 文件必须可解析。
  - symlink（含逃逸）、非 regular、单文件 >64MiB、总量 >256MiB、文件数 >1024、不可读一律 fail closed。
- `generated_scan.go`（新增，SEC2-2 / 3.4b5b3 基线）：`ScanGeneratedAsset(name, data)`。
  - 禁止文件类别：`.env*`、`id_rsa/ed25519/ecdsa/dsa`、`credentials`、`secrets.{json,yaml,toml,env}`、`*.pem/key/p12/pfx/keystore/jks`；`.map` 文件与 `sourcesContent`/`sourceMappingURL`（embedded source map）阻断。
  - JSON 只按值形态判定（合法 `token_ref`/`secret_count` 字段名持有 digest/count 不误报）；声明为 JSON 但不可解析的 asset 按不可扫描阻断，不降级为文本扫描放行（manual skip/unknown asset fail closed）。
  - 非 JSON（static bundle、文本、二进制）按高置信值形态扫描，二进制内嵌 PEM/DSN 可检测。
- `repo_scan.go`（新增，SEC2-1 / 3.4b5b2 本地基线）：`ScanRepositoryTree(root)` → `RepoScanReport{FilesScanned, BytesScanned, SkippedScopes, Findings}`。
  - 递归扫描 tracked/untracked/ignored 全部工作树文件（不按 .gitignore 跳过 candidate input）；symlink/特殊文件/>32MiB/>200k 文件/不可读 fail closed。
  - 明确边界：reachable history（已删除 secret 的 exposure window）与 submodule 内部需要 3.4b5b1 批准的 scanner provider（当前环境无 Gitleaks/TruffleHog/detect-secrets，handoff §1 已确认）；`.git` 子树不扫描但记录 `SkippedScopes=["git_history"]`，authority 必须按 coverage incomplete 投影 blocked，不得当成 zero findings。
- 测试（新增）：
  - `content_scan_test.go`：12 例 seeded text 矩阵 + 5 例 benign 负例 + strict/value 双模式 + 嵌套炸弹 + 脱敏占位符清理（含占位符旁真实泄漏不被剥离的 evasion 用例）+ finding 无值回显断言。
  - `evidence_scan_test.go`：成功/失败 clean run 通过；8 例 seeded leak（stdout/stderr/env/command/summary/嵌套 artifact）；redaction flag 宣称 clean 但 stdout 含真实 secret 必阻断；8 例结构矩阵（缺失六件套/缺 artifacts/symlink/symlink 逃逸/oversize/文件数上限/坏 JSON/非目录 root）。
  - `generated_scan_test.go`：6 例合法 asset 负例（digest token_ref、SBOM、decision ref、OAuth 参数名、二进制）；18 例 seeded 矩阵（嵌套 DSN/PEM/JWT/private path/赋值/Bearer、文本 bundle、二进制内嵌、source map、7 类禁止文件名）；限额矩阵（空名/空内容/超限/嵌套炸弹/损坏 JSON 阻断）。
  - `repo_scan_test.go`：clean 树通过且 `.git` 跳过并记录 `git_history` skipped scope；5 例 seeded（tracked/untracked/ignored/嵌套 fixture/二进制）；结构矩阵（symlink/symlink 逃逸/oversize/非目录/缺失 root）。
  - `tests/security-scan-contract.test.ts`（bun）：4 例合同断言，锁定三个扫描面入口、六件套清单、不信任 redaction flag、禁止文件类别、`git_history` skipped scope 与 ScanFinding 无值字段，防止后续改动静默放宽。

## 3. 逐项状态（17 项）

| 任务 | 可勾选？ | 依据 |
| --- | --- | --- |
| 3.4b5（父） | 否 | 依赖 b5a–b5d 全齐；仅 b5a 已完成，本切片只交付 b5b2/b5b3/b5c1 本地基线 |
| 3.4b5b（父） | 否 | b5b1 外部批准缺；`task security:artifact-scan` 级 provider scan matrix 未达成 |
| 3.4b5b1 | 否（needs_contract/外部） | scanner/rule DB/history window/freshness/failure owner 决策归 security/dependency + release/platform decision owners；当前环境无 approved scanner，不得标 Ready |
| 3.4b5b2 | **基线已实现并验证；仍不可勾选** | `ScanRepositoryTree` + seeded 矩阵落地（§2）；关闭需 b5b1 批准 scanner、history/submodule/exposure-window 覆盖（本地显式 skipped=blocked）、`workbench.security_scan_receipt.v1alpha1` 合同与 CLI 接线（归 C-3，§6.2）、seeded add/delete/history/submodule/binary 完整矩阵 |
| 3.4b5b3 | **基线已实现并验证；仍不可勾选** | `ScanGeneratedAsset` + 正/负矩阵落地（§2）；Dependencies 含 b5b2 与 stable supply-chain schemas 冻结（C-3 在制）；component evidence 被 source-snapshot 并发阻断（§4）；CLI 接线归 C-3 |
| 3.4b5b4 | 否（外部） | 独立 security approver + approval provider 未上线；`workbench.security_finding_decision.v1alpha1` provider/trust 不在本仓库 |
| 3.4b5b5 | 否（外部） | 真实 repository/generated joint 需 provider sandbox + provider/consumer 独立 evidence；fixture 不计 |
| 3.4b5c（父） | 否 | 依赖 3.4b3c/3.4b4c（C-2/C-3 在制）与 b5b、b5c1–b5c3 |
| 3.4b5c1 | **基线已实现并验证；仍不可勾选** | `ScanEvidenceRun` + seeded/结构矩阵落地（§2）；关闭需 b5b 完成、对真实 candidate 成功/失败 run 执行、CLI 接线与独立 security owner 签收 |
| 3.4b5c2 | 否（外部+他片写租约） | OCI config/history/layer/filesystem scanner 需 registry access profile 与四 image inventory/SBOM authority（3.4b4c，C-3 在制）；registry adapter 属 release CLI 面 |
| 3.4b5c3 | 否 | 依赖 b5c1/b5c2 + 真实 candidate digest；`task security:candidate:verify` 未接线 |
| 3.4b5d（父） | 否 | 依赖 b5a–b5c、3.4b4e 与 b5d1–b5d5 |
| 3.4b5d1 | 否（外部） | incident receipt adapter 需 credential provider owners；不得在本仓库保存 credential/raw KMS/audit payload |
| 3.4b5d2 | 否（外部） | compromise 全闭环演练需 disposable provider sandbox |
| 3.4b5d3 | 否（外部） | 真实独立 security reviewer + approval provider/Identity trust 未上线；另依赖 3.4d2b2b3b2（C-5） |
| 3.4b5d4 | 否（他片写租约） | stable security authority aggregator 的 Paths 为 release CLI/Taskfile（C-3 独占）；本切片未越权，扫描器已就绪可供其聚合（§6.2） |
| 3.4b5d5 | 否 | 依赖 b5d4；stable manifest consumer 归 C-3/C-5 |

结论：17 项中 **0 项可在本次勾选**；3 项（3.4b5b2、3.4b5b3、3.4b5c1）完成本地可做的扫描/redaction gate 实现与验证基线，其余 14 项因硬依赖（外部 scanner/reviewer/incident/registry provider、C-2/C-3/C-5 未闭项、他片写租约）如实保持 open，无 fail-open 绕行。

## 4. 验证命令与结果

| 命令 | 结果 |
| --- | --- |
| `CGO_ENABLED=0 go test ./service/internal/diagnostics/ -count=1` | ok（0.351s，含既有 D0–D2 全部用例，零修改通过） |
| `CGO_ENABLED=1 go test -race ./service/internal/diagnostics/ -count=1` | ok（1.569s） |
| `go vet ./service/internal/diagnostics/` | 无输出（通过） |
| `CGO_ENABLED=0 go build ./service/internal/diagnostics/` | exit 0 |
| `bun test tests/security-scan-contract.test.ts tests/support-diagnostics.test.ts` | 8 pass / 0 fail / 105 assertions |
| `bun run typecheck` | exit 0 |
| `openspec validate workbench-production-ga-r5 --strict` | valid |
| `CGO_ENABLED=0 go build ./service/...`（final gate） | **concurrent 失败**：`service/cmd/workbench-lifecycle/main.go:309 undefined: applyDeletionPurgeCLI` 等——Lane D/E 代理在制品（git status 显示该目录未提交改动），与本切片 owned paths 无交集；本切片包独立 build/test 全绿，按并发失败分类，不在本切片修复 |

Component evidence（`bun scripts/test-evidence/run.ts --layer component -- go -C service test ./internal/diagnostics/ -count=1`）：

- run `temp/integration-test-runs/20260827155014-4fd7b282-5f71-439f-8557-985016d84640/`：failed / exit 1，stderr=`source changed while the evidence command was running`（多代理并行写工作树触发 source-snapshot 保护）。
- run `temp/integration-test-runs/20260827155058-a8118a79-09de-4c0c-866a-b1cbf3107465/`：failed / exit 1，同为 source-changed；**stdout.log 显示 `ok .../service/internal/diagnostics 0.271s`，即被测命令本身通过**，仅证据绑定失败。
- 分类：**concurrent**（非 product/test 失败）。已重试一次（共两次，达上限）；**需在无并行写入的稳定窗口重跑**以取得 passed 六件套。两次 run 的六件套均已落盘、保留原 exit code，可供 C-4 关闭时引用为重跑对照。

## 5. 出口标准差距（治理方案 C-4 行）

- 「secret/source/layer scan 目标实现并对命中项 fail-closed」：repository 工作树 / generated-state / candidate evidence 三个本地扫描面已实现且 fail-closed；history/submodule、OCI layer 两个扫描面与 CLI 目标未达成。
- 「与 1.4 redaction gate 对齐」：evidence 扫描器复用 runner 脱敏占位符语义并重读内容验证（不信任 flag），已对齐；1.4 本身归属其他 lane，未核。
- 「证据递归脱敏核验通过」：本地 seeded 矩阵 0 泄漏已证明；passed 状态 component 六件套因并发 source-snapshot 阻断未达成（§4），且独立 security owner 签收未达成。

## 6. 阻塞项与升级建议

### 6.1 外部/跨片阻塞

1. 3.4b5b1 scanner/policy 批准（SEC2-0）：无 Gitleaks/TruffleHog/detect-secrets，history window 与 rule DB freshness 无 owner——这是 b5b2→b5b5 链总闸，按 DAG §5 计时升级。
2. 3.4b5b4 finding decision provider 与 3.4b5d1/d3 的 incident/review approval provider 均不在本仓库，保持 fail-closed，不得用 fixture/httptest 冒充。
3. 3.4b5c2 OCI scanner 需 registry access profile + 3.4b4c image inventory/SBOM authority（C-3 在制）。
4. 3.4b5d3 另依赖 3.4d2b2b3b2 review authority（C-5）。

### 6.2 CLI/Taskfile 接线需求（移交 C-3，本切片未越权写入）

`service/cmd/workbench-release`（C-3 独占）与 `Taskfile.yml` 需新增（合同见 `details/production-security-authority-handoff.md` §9）：

- 子命令调用本切片三个入口：`diagnostics.ScanRepositoryTree`（repo root）、`diagnostics.ScanGeneratedAsset`（逐 asset）、`diagnostics.ScanEvidenceRun` / `ScanEvidenceRuns`（run 目录）。
- 输出只含 receipt-safe 投影：`ScanFinding{code,path}`、计数、skipped scopes、digest/ref；`SkippedScopes` 非空或任一 finding 必须 exit 非零（blocked），不得投影 zero findings。
- Taskfile 目标：`security:repository:scan`、`security:generated:scan`、`security:evidence:scan`（后续 `security:image:scan`、`security:candidate:verify`、`security:authority:*` 随 b5c2/b5d4 接入）；全部过 `production:guard`，integration entrypoint 走 `scripts/test-evidence/run.ts` 写脱敏六件套并保留原 exit code。
- 接线后需把本报告 §4 的 component evidence 在稳定窗口重跑为 passed。

### 6.3 已知策略缺口（留给 SEC2-0 决策，不在基线擅自收紧）

- 裸文本扫描不含 Go stack/panic 标记（避免误杀合法失败日志）；是否将 stack trace 纳入 evidence/repo 扫描面需 scanner policy owner 决策。
- `stripEvidenceRedactions` 信任 runner 占位符形态本身；approved scanner 到位后应以外部规则库复核，不得长期依赖占位符约定。
- 工作树裸 marker 扫描对真实仓库会命中扫描器源码/测试 fixture 中的 seeded 样例（设计使然）；裁决依赖 3.4b5b4 的 finding decision lifecycle，本地基线不做例外放行。

备注：`tasks.md` 未改动；工作树中其他代理的未提交改动未触碰。
