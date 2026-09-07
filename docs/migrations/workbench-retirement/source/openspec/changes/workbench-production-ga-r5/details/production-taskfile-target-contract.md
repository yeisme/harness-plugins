# Workbench Production Taskfile 目标合同

## 1. 目标

Taskfile 是开发、验证和发布准备的统一人类入口，但不拥有业务状态、release state或生产凭据。目标必须调用项目 CLI/服务或 evidence runner，不在 YAML 中拼装数据库状态、release manifest、approval 或 provider payload。

**Current-authority override (v8):** this document contains intended target
contracts, not a declaration that each target is runnable. The only current
target authority checkpoint is `temp/release/production-targets-current-v8.json`
(36 total: 8 available, 5 diagnostic, 14 planned, 9 provider-blocked;
`complete=false`, `production_authorized=false`). `v2`–`v7` and unversioned
`current` aliases are historical stale snapshots. In particular, managed
restore, staging bootstrap/soak and production-like staging claims remain open,
provider-blocked or planned until independently evidenced.

## 2. 通用调用合同

所有生产相关目标遵循：

- 必须显式传入 `ENV=integration|staging|canary|production`；不得默认 production。
- 具有外部写入可能的目标默认 `DRY_RUN=1`，真实动作还要求批准系统 receipt；`CONFIRM=1` 不能替代外部授权。
- `RUN_ID` 缺省由 evidence runner生成，用户可传入合法 run id用于关联，不接受路径。
- `ARTIFACT_DIGEST`、`RELEASE_ID`、`CAPABILITY`、`TENANT_REF`等只接受 opaque/validated值，不接受 URL、DSN、token或文件路径替代。
- stdout 保持简洁英文摘要；结构化结果由被调用 CLI 的 `--json`/`--agent`模式或 evidence文件提供。
- 底层CLI保留稳定domain exit code；`go-task`可能映射为自身非零exit，Taskfile必须保持失败且不得吞错或打印warning后成功。机器调用需要精确domain code时直接使用对应CLI `--json/--agent`，evidence同时记录Task/CLI状态。
- 长时或 integration/system 类目标必须写入 `temp/integration-test-runs/<run-id>/` 六件套并脱敏。

## 3. 目标分组

### 3.1 基础与诊断

| Target | 行为 | 写入 | Evidence |
| --- | --- | --- | --- |
| `task ops:doctor ENV=...` | 检查工具链、config source、依赖可达性和安全限制 | 无 | 可选诊断 run |
| `task config:validate ENV=...` | 校验非秘密 profile、secret ref存在性和互斥项 | 无 | component evidence |
| `task data-lifecycle:inventory:generate ENV=...` | 从canonical non-content registry生成private lifecycle inventory | CLI-authored 0600 inventory | component evidence |
| `task data-lifecycle:contract ENV=...` | 重验inventory policy digest、freshness、Owner payload边界和registry drift | 无 | validation summary |
| `task diagnostics:verify ENV=...` | 生成并扫描 bounded support bundle | 临时脱敏bundle | audit/evidence |
| `task runbook:validate` | 校验每个P0/P1 alert映射owner/命令/rollback | 无 | validation summary |

`ops:doctor` 只报告secret来源类型和配置状态，不打印secret值、真实endpoint、DSN或private path。

### 3.2 Build 与 Supply Chain

| Target | 行为 | Gate |
| --- | --- | --- |
| `task build` | 构建 Web/API/worker/migration immutable artifacts | pinned lock/toolchain、pure Go |
| `task build:reproducibility` | 两次隔离构建并比较/解释digest | source/toolchain/build args一致 |
| `task container:contract:test` | 校验四目标、non-root、固定base digest与最小build context | 不替代真实image smoke |
| `task container:plan ENV=...` | 绑定promotion/manifest/report/artifact tree/image definitions | alpha诊断不授权，stable v3 authority才可build |
| `task container:plan:validate ENV=...` | 重新计算并比较所有container plan authority与digest | 拒绝人工提权和输入漂移 |
| `task container:build` | 构建non-root minimal images | no source/cache/secret/local DB |
| `task container:smoke` | user/fs/ports/health/drain/layer检查 | read-only root、graceful stop |
| `task supply-chain:artifact:generate ARTIFACT_ROOT=... ARTIFACT_DIGEST=...` | Syft生成无host file metadata的CycloneDX artifact SBOM | 仅生成SBOM，不授予authority |
| `task supply-chain:artifact:plan ENV=...` | 将SBOM绑定clean reproducibility report与exact artifact tree | 固定diagnostic、缺production bundle返回Partial |
| `task supply-chain:provenance:compare ENV=...` | 验证两个signed receipts、R4 worker handoff与managed anchors并生成comparison | Consumer Done diagnostic；固定provider_ready=false |
| `task supply-chain:provenance:validate ENV=...` | 重验comparison与当前receipts/trust/artifact/worker authority | Provider joint evidence前保持Partial |
| `task supply-chain:image:generate ENV=...` | 从provider inventory为四target与两个base生成OCI digest绑定SBOM | 不接受tag/local daemon identity；只生成不授权 |
| `task supply-chain:image:plan ENV=...` | 绑定provider inventory、container plan、builder comparison、artifact authority与image/base SBOM并生成诊断report | 固定diagnostic；缺输入或漂移即fail closed |
| `task supply-chain:image:verify ENV=...` | 重验四image inventory、base/layers、artifact/plan/provenance与SBOM bundle | 任一target缺失或跨candidate即blocked |
| `task supply-chain:scan ENV=...` | 使用managed scanner/DB/policy扫描artifact与六份SBOM并验证exception | scanner missing/stale/partial、critical/high/unknown license默认blocked |
| `task supply-chain:signature:verify ENV=...` | 验证artifact/image/inventory/SBOM/scan签名与managed trust | unsigned/wrong identity/digest/revoked/stale/referrer unavailable blocked |
| `task supply-chain:authority:generate ENV=...` | 从direct provider evidence生成stable supply-chain authority | diagnostic/manual elevation不得进入stable authority |
| `task supply-chain:verify ENV=...` | 重验artifact SBOM；后续聚合provenance/signature/license/advisory | 当前非零；完整policy authority后才pass |
| `task security:artifact:plan ENV=...` | 扫描exact artifact tree、SBOM与supply-chain authority且不输出matched value | 当前只生成diagnostic report |
| `task security:artifact-scan ENV=...` | 重验artifact disclosure；后续聚合repo/evidence/image-layer/independent review | 当前非零；完整security authority后才pass |
| `task security:repository:scan ENV=...` | 扫描verified repo/history、tracked/untracked/ignored/submodule与generated state | scanner missing/stale/partial或coverage gap blocked；零matched value输出 |
| `task security:generated:scan ENV=...` | 逐asset扫描generated state的禁止文件类别与值形态 | 禁止类别、不可扫描JSON或高置信命中即blocked；输出只含basename别名与code |
| `task security:evidence:scan ENV=...` | 重新扫描成功/失败六件套及artifacts，不信任redaction flag | unreadable/oversize/symlink escape/private payload blocked |
| `task security:image:scan ENV=...` | 扫描四target OCI config/history/every layer/merged filesystem | 漏target/layer、local daemon identity、later-layer delete secret blocked |
| `task security:candidate:verify ENV=...` | 聚合同candidate repo/generated/evidence/OCI scan receipts | 任一scope/digest/freshness/decision缺失blocked |
| `task security:incident:validate ENV=...` | 验证真实命中的revoke/rotate/exposure audit/rebuild/resign/rescan闭环 | 删除字符串、ignore或scan clean不能替代rotation |
| `task security:authority:generate ENV=...` | 从current scans、incident和独立review生成stable security authority | Agent/automation自批、旧review/manual elevation blocked |

### 3.3 Database 与 Migration

| Target | 默认语义 | 禁止行为 |
| --- | --- | --- |
| `task db:migrate:check ENV=...` | managed read target authority前pre-connect blocked；local check另行显式调用 | 自动升级 |
| `task db:migrate ENV=... DRY_RUN=1` | managed plan-only non-connect；apply保持blocked | API/worker AutoMigrate |
| `task db:backup ENV=... DRY_RUN=1` | managed request仍provider-blocked | 默认触碰production DB |
| `task db:restore:verify ENV=...` | managed restore verifier仍provider-blocked；组件disposable proof不计staging验收 | 覆盖普通/production DB |
| `task disaster-recovery:drill ENV=staging` | planned；不得把文档演练冒充real restore/cutover | 伪造RPO/RTO或跳过receipt |

当前 `db:backup`、`db:migrate`、`db:migrate:check`、`db:restore:verify` 的managed
路径都不具备GA authority；R5必须补齐managed profile、approval、provider metadata、
PostgreSQL与DR evidence后才能作为GA命令。

### 3.4 Deploy 与 Release

| Target | 默认语义 | Exit |
| --- | --- | --- |
| `task deploy:validate ENV=...` | render/schema/security policy检查 | pass/No-Go |
| `task deploy:preflight ENV=...` | artifact/schema/contract/worker兼容性 | compatible matrix |
| `task deploy:smoke ENV=staging STRATEGY=...` | staging rollout/drain验证 | rollout evidence |
| `task release:manifest:generate ENV=...` | 调CLI从权威来源生成manifest | immutable manifest ref |
| `task release:manifest:validate ENV=...` | digest/freshness/redaction/coverage校验 | pass/No-Go |
| `task release:readiness ENV=...` | 只读计算环境和capability readiness | recommendation only |
| `task release:promotion:init ENV=... CAPABILITY=... PROMOTION_ID=... TENANT_SCOPE_DIGEST=... RELEASE_MANIFEST=...` | 创建CLI-authored Draft诊断record，不授予stage authority | promotion record revision 1 |
| `task release:promotion:dry-run ENV=... RELEASE_MANIFEST=... EXPECTED_REVISION=... TARGET_STAGE=...` | CAS记录允许的下一步计划，不改变current stage | diagnostic transition plan |
| `task release:promotion:validate ENV=... RELEASE_MANIFEST=...` | 重验manifest绑定；stable v3前明确失败关闭 | `manifest_upgrade_required`或validated |
| `task release:soak ENV=staging DURATION=24h` | 运行/汇总soak | SLO/error-budget evidence |
| `task release:canary ENV=canary DRY_RUN=1` | 生成allowlisted canary计划 | 不执行真实部署 |
| `task release:canary:report ENV=canary WINDOW=7d` | 汇总连续canary证据 | recommendation |
| `task release:rollback:dry-run ENV=staging` | 验证artifact/schema/worker兼容和drain | rollback plan |
| `task release:audit ENV=canary` | requirement-by-requirement直接证据审计 | complete/No-Go |
| `task release:decision:validate ENV=canary` | 验证外部批准身份和manifest digest | ProductionReady/No-Go |
| `task release:post-deploy ENV=production DRY_RUN=1` | 只读生产smoke/支持检查计划 | 不宣称已部署 |

以上 staging/soak/canary/rollback 表项是future contract。v8 registry未将它们的
managed execution提升为authoritative；任何local/diagnostic plan或组件测试都不得替代
signed provider receipt、连续窗口或实际staging custody。

### 3.5 Integration 与 Incident

| Target | Scope |
| --- | --- |
| `task test:postgres` | disposable real PostgreSQL parity/pool/failure |
| `task test:identity-integration` | real Identity test realm/session/tenant/revoke |
| `task test:owner-transport:component` | Owner四面合同和safe projection |
| `task test:owner-eikona-mutation-canary` | Eikona receipt/status/reconcile/cancel |
| `task test:daily-ops-integration OWNER=eikona` | Inbox→WorkItem→Task→Owner→Activity/Delivery |
| `task test:workflow-e2e OWNER=eikona` | durable workflow lease/pause/resume/unknown recovery |
| `task test:chaos ENV=staging` | dependency/network/resource故障矩阵 |
| `task incident:drill ENV=staging` | detect→kill/pause→preserve→reconcile→rollback/fix-forward |

## 4. 实现波次

| Wave | 目标 | Owner task | Exit |
| --- | --- | --- | --- |
| T0 | 公共变量校验、evidence wrapper、dry-run保护 | R5 3.4a | bad ENV/secret/path/production default负测通过 |
| T1a | ops doctor + BFF/workbenchd config validation | R5 3.4b1 | managed缺项/工具状态fail-closed且不输出值 |
| T1b-a | current artifact reproducibility engine | R5 3.4b2a | 五个Go binary+Web双构建digest一致并诚实报告blocker |
| T1b-b | complete production artifact set | R5 3.4b2b | clean source、真实worker、approved builder、candidate complete |
| T1c | container contract、authority-bound plan、non-root build/smoke | R5 3.4b3 | stable v3 plan授权后image/layer/fs/drain门禁可运行 |
| T1d-a | artifact SBOM diagnostic authority | R5 3.4b4a | Syft SBOM无private path且绑定artifact authority（已完成） |
| T1d-b | approved provenance/image/signature/advisory | R5 3.4b4b-3.4b4e | `task supply-chain:verify`零退出并可供stable v3消费 |
| T1e-a | artifact disclosure diagnostic authority | R5 3.4b5a | artifact/SBOM authority高置信扫描且matched value零输出（已完成） |
| T1e-b | repository/evidence/image-layer/rotation review | R5 3.4b5b-3.4b5d | signed redacted security authority可供stable v3消费 |
| T2 | PostgreSQL/backup/restore/migration/deploy targets | R5 3.4c | staging preflight/restore/rollback可运行 |
| T3 | manifest/readiness/promotion/canary/audit targets | R5 3.4d | release CLI成为唯一状态作者 |
| T4a | lifecycle inventory diagnostic与owner/store签收 | R5 6.0a0-6.0a1 | CLI inventory通过，实际store catalog与跨Owner authority仍需收敛 |
| T4a-cmd | CLI-authored production target registry与可用性validator | R5 3.4e0（已完成） | planned/diagnostic/provider-blocked入口不会被误计为可执行authority |
| T4b | incident/diagnostics/runbook/docs/completion | R5 3.4e | `task --list-all`、smoke、docs parity通过 |

每一波先实现底层 CLI/service，再增加 Taskfile薄包装和测试。Taskfile不得用 shell pipeline解析 human output决定发布状态。

当前T0、T1a、T1b-a、T1d-a、T1e-a与T4a的diagnostic inventory baseline已经完成，基线见`production-taskfile-contract-baseline.md`、`production-config-doctor-baseline.md`、`production-reproducible-build-baseline.md`、`artifact-sbom-authority-baseline.md`、`artifact-security-authority-baseline.md`与`governance-cli-implementation-slices.md`。T4a当前只证明canonical non-content inventory可由CLI安全生成和重验；实际GORM/store parity、managed backup authority和跨Owner签收仍未完成。其他真实依赖由T1b-b、T1c、T1d-b、T1e-b、T4a后续与T4b实现。

生产命令的当前存在性与authority分类见`production-command-availability-and-execution-gate.md`，实现证据见`production-target-registry-baseline.md`。`3.4e0`已完成，但文档中尚不可发现的target仍由registry投影为`planned`并阻断对应工作包，不能由临时shell命令或手工检查替代。

## 5. 负向验收

必须覆盖：

1. `ENV`缺失、未知或production隐式值时失败；
2. secret、DSN、URL或path被放入不允许变量时失败且不回显；
3. release manifest缺证据、过期、digest不一致或被手改时失败；
4. managed依赖缺失时返回blocked/No-Go，不回落SQLite、fixture或local bridge；
5. write目标无external approval时只生成dry-run计划；
6. evidence runner失败时保留原退出码、stdout/stderr与脱敏artifacts；
7. rollback candidate与schema/worker/contract不兼容时失败，不执行旧binary；
8. Taskfile target、README命令和CLI help不漂移。

## 6. 完成定义

只有所有文档列出的生产目标真实存在、`task --list-all`可发现、help与参数一致、底层CLI拥有状态、负向测试和production-like evidence通过时，Taskfile才从“预览开发入口”晋级为“生产运维入口”。
