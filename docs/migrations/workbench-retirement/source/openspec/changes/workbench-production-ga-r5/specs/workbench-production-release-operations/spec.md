## ADDED Requirements

### Requirement: Production artifacts MUST be immutable and reproducible

Web/API/worker/migration制品 MUST 由固定source/lockfile/toolchain以受控build生成，包含immutable digest、version、SBOM/provenance/signature；环境晋级 MUST 使用同一digest。

Approved builder provenance MUST 来自provider-owned隔离builder与managed signing authority。Receipt MUST 绑定clean source commit/digest、submodule与lock digests、immutable runner image、workload/pool identity、build parameters、R4 worker handoff、artifact report/tree digest、invocation nonce、policy、freshness和signature；Workbench MUST 使用managed policy/trust digest验证至少两个distinct invocation/instance的receipt并生成CLI-authoredcomparison。Caller自报builder identity、自建trust、mutable tag、同invocation复制receipt、自由文本解释digest mismatch或fixture Provider Ready MUST 被拒绝。

#### Scenario: Rebuild same release source
- **WHEN** 在批准builder/toolchain重复构建同一source/lockfiles
- **THEN** artifacts MUST 可复现或所有允许差异有明确provenance说明
- **AND** release gate MUST 验证digest/signature/SBOM与source refs

#### Scenario: Provider Ready independent sign-off
- **WHEN** Workbench consumer fixture测试或comparison通过，但provider尚未交付真实P1-P4 evidence
- **THEN** Provider Ready MUST 保持false并阻断production authority
- **AND** provider/security/R4 owner MUST 使用provider-owned evidence独立签收adapter、policy、trust、两个隔离build与immutable artifact

#### Scenario: Builder response is lost
- **WHEN** provider已经接收build但调用方未收到确定响应
- **THEN** invocation MUST 进入unknown并仅允许使用同一opaque ref执行lookup/reconcile
- **AND** 系统 MUST NOT 盲目创建新invocation、重复publish/sign或复用旧nonce

#### Scenario: Builder key or policy is revoked
- **WHEN** signing key、builder policy、runner image或workload identity被撤销
- **THEN** 尚未promotion的receipt/comparison MUST 立即重新验证为No-Go
- **AND** candidate MUST 重新build和compare，旧receipt只保留审计且不得继续授权

#### Scenario: One production image target is missing
- **WHEN** `api|worker|migration|web` 任一image、对应base digest、image SBOM或artifact→image provenance缺失或来自不同candidate
- **THEN** image supply-chain authority MUST fail
- **AND** tag、本地daemon ID或其他target的SBOM MUST NOT 替代缺失target的immutable digest evidence

#### Scenario: Scanner is unavailable or stale
- **WHEN** advisory/license scanner缺失、timeout、返回partial结果或DB超过managed freshness
- **THEN** policy authority MUST fail closed
- **AND** 系统 MUST NOT 把scanner失败、unknown license或unknown severity投影为clean

#### Scenario: Supply-chain exception expires or is revoked
- **WHEN** advisory/license exception的package/version/target/digest scope不匹配、过期、撤销或approver不受信
- **THEN** 对应finding MUST 恢复为blocking
- **AND** CLI flag或free-text allowlist MUST NOT 延长或扩大exception scope

#### Scenario: OCI signature or referrer becomes unavailable
- **WHEN** artifact/image/SBOM/scan signature unsigned、wrong issuer/key/subject/digest、revoked/stale或registry referrer不可读取
- **THEN** stable supply-chain authority MUST revalidate to No-Go
- **AND** local cache、旧verify receipt或mutable tag MUST NOT 继续授权promotion

#### Scenario: Diagnostic supply-chain report is manually elevated
- **WHEN** caller修改diagnostic report状态、删除blocker或把schema/version改成stable名称
- **THEN** stable aggregator MUST reject the asset
- **AND** stable authority MUST only be generated from current direct provider evidence、managed policy/trust与independent security approval

#### Scenario: Secret was deleted from the current tree but remains in history
- **WHEN** credential/private key/token已从working tree删除但仍存在于批准history window、tag、submodule或ignored/untracked candidate input
- **THEN** repository security authority MUST fail
- **AND** scanner receipt MUST report onlysafe rule/path alias/count/exposure refs，不得输出secret diff、snippet、offset或hash

#### Scenario: Evidence runner claims redaction but output still contains sensitive material
- **WHEN** `summary.json`声明redaction enabled，但command/stdout/stderr/env/artifacts任一仍含credential、private path、raw provider payload或private tool argument
- **THEN** candidate security authority MUST fail
- **AND** validator MUST re-read success and failure evidence instead of trusting the redaction flag

#### Scenario: Secret is deleted in a later OCI layer
- **WHEN** credential/source/cache/local DB或evidence被写入早期layer后在later layer删除
- **THEN** OCI security scan MUST仍然阻断candidate
- **AND** system MUST scan config、history、每个layer与merged filesystem，而非只扫描最终filesystem

#### Scenario: Real credential finding is cleaned without rotation
- **WHEN** source中的credential字符串被删除或加入ignore，但credential尚未revoke/rotate且exposure window未审计
- **THEN** stable security authority MUST保持No-Go
- **AND** 新candidate MUST使用新source/artifact/image/SBOM/scan/signature digest并撤销旧authority后才能重新review

#### Scenario: Security approval targets an old candidate
- **WHEN** external security review receipt已过期、撤销、untrusted，或绑定旧artifact/manifest/scan/incident digest
- **THEN** stable security authority MUST reject the approval
- **AND** Agent、automation identity、截图、聊天记录或caller trust MUST NOT替代当前独立review receipt

#### Scenario: Container contains development data
- **WHEN** layer scan发现源码、node_modules/cache、token、local DB、test evidence或开发配置
- **THEN** build MUST fail
- **AND** artifact MUST 不得进入registry promotion

### Requirement: Runtime images MUST use safe defaults

Production Web/API/worker image MUST non-root、最小化、正常路径`CGO_ENABLED=0`、支持read-only root filesystem和graceful shutdown；所需写目录/network/ports/resource MUST 显式声明。

#### Scenario: Container shutdown
- **WHEN** runtime收到termination signal
- **THEN** readiness MUST 先进入drain并在deadline内停止listener/worker claim、处理lease/connection cleanup
- **AND** 超时后 MUST 保留可诊断exit/evidence而不损坏状态

### Requirement: Release manifest MUST be generated from authoritative evidence

Release manifest MUST 由CLI/服务从artifact registry、OpenSpec、tests/reviews、contracts/schema/policy/definition、migration/backup/restore/SLO evidence生成；MUST NOT 由Agent手写状态。

#### Scenario: Evidence missing or stale
- **WHEN** required run/review/restore/rollback evidence缺失、过期、redaction失败或digest不匹配
- **THEN** readiness gate MUST fail并列出safe missing evidence refs
- **AND** MUST 不允许人工勾选覆盖为passed

#### Scenario: Test evidence lacks environment or command authority
- **WHEN** test evidence receipt未绑定目标environment、实际argv、project/layer、passed exit、redaction policy和finished timestamp，或bundle内容在验证后变化
- **THEN** requirement MUST 保持`recorded`或退回blocked，manifest生成/校验 MUST 非零退出
- **AND** resolver MUST 只读取显式run ref，不得扫描目录猜测latest run

#### Scenario: Manifest artifact mismatch
- **WHEN** staging/canary artifact digest与manifest记录不同
- **THEN** promotion MUST 被拒绝
- **AND** 必须生成新manifest或部署正确artifact，不能就地修改通过结论

### Requirement: Review approval MUST be independent and source-bound

Review decision MUST 由CLI/服务绑定当前candidate manifest、artifact digest、scope、expiry、finding evidence和外部approval receipt；Agent、模型、automation identity或未知reviewer MUST NOT 自行批准release。

#### Scenario: Agent or unknown reviewer attempts approval
- **WHEN** reviewer identity来自Agent/model/automation、未知identity prefix、未知role，或缺少批准系统receipt
- **THEN** review decision MUST 保持blocked并非零退出
- **AND** 测试通过、截图、聊天或手写identity字符串 MUST NOT 替代外部签收adapter

#### Scenario: Signed approval receipt is untrusted or revoked
- **WHEN** receipt签名无效、issuer/key未知、public key过期或撤销、role/scope不在allowlist，或receipt target/environment/time与candidate不一致
- **THEN** review validation MUST 返回blocked且不得升级为production-valid decision
- **AND** Workbench MUST 只消费由managed config digest锚定的public trust material，不保存provider credential/private signing key，也不得允许CLI flag覆盖trust anchor

#### Scenario: Blocking finding remains open
- **WHEN** 任一P0或P1 finding仍为open，即使review outcome请求approved
- **THEN** CLI MUST 拒绝批准并保留finding owner、status和evidence digest
- **AND** risk acceptance MUST NOT 绕过P0/P1 blocker

#### Scenario: Reviewed target changes or expires
- **WHEN** manifest/artifact/environment digest变化、decision过期、decision time位于未来或structured asset被篡改
- **THEN** review validation MUST fail closed并要求对新candidate重新签收
- **AND** 不得就地修改旧通过结论继续promotion

#### Scenario: Review authority is attached to a release manifest
- **WHEN** release CLI生成review-attested manifest
- **THEN** manifest MUST 引用一个已审核的candidate manifest digest，并重新构建当前requirements、handoffs、artifact和capability authority确认完全一致
- **AND** manifest MUST NOT 审核自身或把review decision附加到blocked base candidate

### Requirement: Managed configuration and secrets MUST be validated and separated

环境profile MUST 只保存非秘密配置，secret MUST 通过批准secret reference注入；managed启动 MUST 验证Identity/Postgres/service identity/Owner allowlist/cookie/CSRF/audit/telemetry/migration/worker compatibility。

#### Scenario: Secret appears in argv or manifest
- **WHEN** validation发现credential/token/private key/DSN password进入argv、repo config、release manifest值、log或evidence
- **THEN** release MUST No-Go
- **AND** secret MUST 按incident/rotation policy处理

#### Scenario: Incomplete managed config
- **WHEN** required issuer/audience/JWKS/session/DB TLS/service identity/audit/config缺失或冲突
- **THEN** runtime MUST fail-fast或readiness false
- **AND** MUST 不回退local profile/token/SQLite

### Requirement: Deployment topology MUST separate migration, API, Web, and worker lifecycles

Production MUST 使用显式Web/BFF、API/control plane、migration job和workflow worker部署单元，各自拥有health/readiness/resources/drain；API/worker MUST NOT 自动执行managed schema migration。

#### Scenario: Schema migration required
- **WHEN** release manifest声明新schema version
- **THEN** deployment MUST 先运行backup/restore verification和独立migration check/up/check job
- **AND** application/worker只有在compatible schema通过后才能rollout/claim

### Requirement: Promotion MUST follow evidence-driven state transitions

Release MUST 按Draft→Integration→Staging→Canary→ProductionReady→Production推进，并支持Rejected/RolledBack；每个transition MUST 绑定manifest digest、required evidence和approver。

#### Scenario: Production command without approval
- **WHEN**普通readiness/canary命令或Agent尝试直接执行production deploy
- **THEN** 系统 MUST 拒绝外部写入并输出所需approval/gate
- **AND** dry-run/readiness结果 MAY 继续生成

#### Scenario: Canary error budget burns
- **WHEN** canary SLO/error budget超过批准threshold
- **THEN** promotion MUST pause/abort并触发capability switch或rollback决策
- **AND** MUST 不因部分happy-path tests通过继续生产晋级

### Requirement: Capabilities MUST promote and roll back independently

Identity、每个Owner connector、Desktop、Asset、WorkItem、Daily Ops、Spatial Board与Workflow runtime MUST 有独立status/flag/kill switch；未ready capability MUST fail-closed/degraded且不得阻断无关可用功能。

#### Scenario: One Owner connector fails canary
- **WHEN**某Owner contract/SLO/security gate失败
- **THEN**该connector MUST 保持needs_contract/degraded/disabled
- **AND**其他已批准capability MAY 继续，不得共享一个总开关伪装全成全败

### Requirement: Database backups MUST be restorable and verified

Managed PostgreSQL backup MUST 有schema/version/checksum/encryption/retention/provider metadata，并在promotion前恢复到disposable隔离环境验证schema、data invariants和application smoke。

#### Scenario: Backup exists but restore fails
- **WHEN**最新backup文件存在但restore/checksum/invariant/smoke失败或超RTO
- **THEN** release MUST No-Go并告警
- **AND** MUST 不以backup job success替代restore evidence

#### Scenario: Backup points to wrong profile/database
- **WHEN**metadata与目标environment/database/schema不匹配
- **THEN**restore/promotion MUST fail-closed
- **AND**不得连接普通用户或production数据库执行测试恢复

### Requirement: Migrations and rollback MUST preserve compatibility

Schema/contract演进 MUST 使用expand/backfill/shadow/cutover/contract和compatibility matrix；rollback MUST 使用前一批准artifact/flags并保留expand schema，除非有独立验证的安全schema reversal。

#### Scenario: Old binary incompatible with new schema
- **WHEN**rollback candidate不支持当前schema/worker/contract range
- **THEN**rollback MUST 被阻止并选择compatible fix-forward或批准路径
- **AND** MUST 不盲目启动旧binary造成数据损坏

### Requirement: PostgreSQL test mutation targets MUST be independently attested

Every executable PostgreSQL test or harness that can issue DDL or DML MUST
obtain its connection target from one shared authority consumer. A caller
string, a database name convention, `WORKBENCH_POSTGRES_TEST_TARGET`, or a
parent-process boolean MUST NOT grant disposable authority. The consumer MUST
require a bounded, current-UID, regular, non-symlink 0600 attestation whose
canonical digest binds the normalized DSN, target class, expiry, provisioner
sentinel/effect nonce, and permitted TLS policy. Missing DSN plus attestation
MAY skip an optional integration test; exactly one input, stale/malformed
attestation, duplicate/case/unknown JSON field, unsafe DSN, or `PG*` override
MUST fail before dialing.

Before any DDL/DML, each process MUST independently perform read-only target
verification for server/database/OID/current user/role privilege/TLS/recovery
state and the provisioner-owned sentinel/effect/nonce/expiry. Local targets
MUST be loopback-only; managed targets require a future signed managed
authority and remain blocked until that consumer exists.

#### Scenario: Ambient DSN is present without attestation
- **WHEN** a test process receives `WORKBENCH_TEST_POSTGRES_URL` but no valid
  attestation
- **THEN** it MUST fail before opening a connection or spawning a child
- **AND** it MUST NOT issue `CREATE`, `DROP`, `TRUNCATE`, `DELETE`, migration,
  or schema search-path effects

#### Scenario: Attested target changes after the file is read
- **WHEN** an attestation file, its identity, its digest binding, a TLS mode,
  or the database sentinel/effect changes
- **THEN** the process MUST fail closed before mutation
- **AND** a parent process MUST NOT pass a prior boolean decision to a child

### Requirement: Managed migration and backup operations MUST remain plan-only until authority exists

`db:migrate ENV=<managed> DRY_RUN=1` MUST produce a non-mutating plan. A
managed `up`, old `-command up`, or managed backup/restore invocation MUST
hard-block before opening PostgreSQL, creating metadata tables, spawning
`pg_dump`/`pg_restore`, or writing a receipt until a signed target, plan,
approval, and operation lookup/reconcile authority consumer exists. `check`
and `status` MUST be genuinely read-only and MUST NOT create metadata tables.
Staging mutation may only proceed through the exact staging-control compose
classifier plus attestation; otherwise it remains blocked.

#### Scenario: Managed migration has an opaque approval string
- **WHEN** a caller supplies a DSN, an opaque approval text, or a legacy
  `-command up` flag without current signed authority
- **THEN** the command MUST block before database connection
- **AND** it MUST NOT reinterpret the call as an implicit plan or apply

#### Scenario: Managed backup provider is unavailable
- **WHEN** provider target/operation authority is absent, stale, or revoked
- **THEN** managed backup MUST block before `pg_dump`
- **AND** local SQLite backup remains supported without granting managed
  authority

### Requirement: SLO and error budgets MUST gate availability claims

API、mutation outcome、search、Pane interaction、SSE、projection/revoke freshness、workflow queue/reconcile、backup RPO和restore RTO MUST 有SLI/SLO/error budget与alert；promotion MUST 使用production-like soak/load证据。

SLO authority MUST 由provider-neutral consumer验证版本化report、managed-policy digest、签名observation receipt、managed trust bundle和system evidence bundle；policy与trust anchor MUST 来自managed config且MUST NOT由调用者参数覆盖。Production-authoritative policy MUST 声明排序、去重的required indicator集合；report MUST 对每个indicator绑定metric kind、unit、objective、threshold对应观测、sample count与source/query digest，并绑定environment、capability、artifact digest、完整window coverage、request/error basis points、tail latency、availability、budget和incident refs。Window MUST 记录expected/observed/missing seconds、coverage、segments与max gap；staging window MUST不少于24h，canary与production window MUST不少于7d。Observation receipt MUST 签名绑定report/policy/source/query/window/artifact/capability并支持key rotation、revocation、expiry与nonce replay拒绝。Pre-release manifest只有在已评审candidate与当前inputs一致后才能追加signed multi-SLI SLO attestation；该alpha合同不得被当作stable promotion合同。

#### Scenario: Local benchmark passes but staging tail fails
- **WHEN**本地空数据结果通过而staging production-like p95/p99/error budget失败
- **THEN**promotion MUST 以staging/canary证据失败
- **AND**不得用平均值或小数据覆盖tail/failure

#### Scenario: Caller supplies a convenient SLO policy
- **WHEN**调用者提供未被managed digest锚定的policy、把report放在system evidence bundle之外、修改collection command或复用旧artifact窗口
- **THEN**SLO validation与manifest validation MUST 返回blocked
- **AND**不得以CLI flag、fixture timestamp或人工确认替代managed policy与真实observability evidence

#### Scenario: Aggregate API latency hides a broken production path
- **WHEN**总体API p95通过，但search、SSE、workflow queue、restore RTO或任一required indicator缺失或失败
- **THEN**SLO authority MUST blocked并列出缺失或失败的稳定indicator ID
- **AND**不得以单一aggregate、平均值或optional标记绕过required indicator

#### Scenario: Report timestamps look complete but telemetry has gaps
- **WHEN**window start/end达到24h或7d，但observed coverage不足、segment间存在超限gap、artifact在窗口中变化或receipt无法由managed key验证
- **THEN**SLO authority与manifest MUST blocked
- **AND**不得拼接窗口、回填synthetic timestamp、调用者自签trust bundle或复制raw telemetry伪造权威

### Requirement: Alerts MUST map to actionable runbooks

每个P0/P1 alert MUST 具有owner、dashboard、threshold、safe diagnostics、escalation、kill switch/rollback/restore步骤与验证命令；runbook不得要求手改DB或泄露secret。

#### Scenario: Unknown accept spike
- **WHEN**unknown_accept/reconcile lag超过threshold
- **THEN**alert/runbook MUST 停止相关新dispatch、保护receipt/evidence并指导reconcile/Owner检查
- **AND**不得建议自动重放mutation

### Requirement: Supply-chain, security, privacy, and accessibility gates MUST be independent

GA MUST 通过dependency/license/advisory、SBOM/provenance/signature、secret/layer、container/runtime、tenant/auth/token/SSRF/operator/workflow、privacy/retention与a11y独立审核；P0/P1 MUST 为零。

#### Scenario: Critical security finding
- **WHEN**review发现cross-tenant、secret、arbitrary execution、data loss或duplicate external mutation风险
- **THEN**release MUST No-Go并回R0-R4 owning change修复
- **AND**R5 MUST 不以risk acceptance文案自行绕过

#### Scenario: Critical accessibility journey fails
- **WHEN**任一关键旅程无法通过键盘、screen reader、200% zoom或reduced-motion完成，或focus/error/status无法被可靠感知
- **THEN**accessibility gate MUST fail并冻结当前candidate
- **AND**自动扫描、非关键页面通过或截图 MUST NOT 覆盖关键旅程失败

### Requirement: Incident and rollback MUST preserve external truth

Incident handling MUST 先阻止新风险、保留evidence、reconcile已发送mutation，再决定rollback/fix-forward/restore；rollback MUST 不伪造Task/Owner/workflowterminal state。

#### Scenario: Rollback during active workflows
- **WHEN**canary发生incident且存在running/waiting/reconciling runs
- **THEN**系统 MUST pause/kill-switch新claim并保留leases/receipts/reconcile
- **AND**compatible old/read-only version MUST 能观察真实状态，不得重复dispatch

### Requirement: Diagnostics MUST be safe and supportable

Support Diagnostics MUST 展示version/artifact/profile/config source type、contract/schema/policy/definition、capability/readiness/freshness、safe trace/evidence refs与救援命令；MUST NOT 展示secret/raw endpoint/full identity/resource refs/payload/stack。

#### Scenario: Support exports diagnostics
- **WHEN**authorized operator生成diagnostics bundle
- **THEN**bundle MUST 经过redaction与size/retention限制并记录audit
- **AND**不得包含token/cookie/DSN/provider payload/private path/PII

#### Scenario: Diagnostics bundle leaks support-sensitive context
- **WHEN**bundle包含raw endpoint、identity claim、resource title/content、provider payload、stack memory、private command argument或超过批准size/file/retention上限
- **THEN**diagnostics authority MUST fail并阻止support handoff与GA decision
- **AND**validator MUST递归读取成功和失败bundle，不能只信producer的redaction声明

#### Scenario: Diagnostics bundle is stale or unbounded
- **WHEN**bundle已过期、超过最大age、绑定错误candidate/environment、包含未知schema/字段/code/status、超过单文件或总字节上限，或通过symlink/device/archive绕过边界
- **THEN**generation、validation、download或support handoff MUST fail closed
- **AND**不得通过延长retention、忽略unknown字段或复制到新路径恢复authority

#### Scenario: Diagnostics input is not direct external truth
- **WHEN**caller提交的diagnostic status未绑定current frozen candidate的runtime/release直接来源，或source lookup返回unknown、drift、timeout或跨environment结果
- **THEN**bundle MUST 只保持diagnostic baseline或blocked状态，不得声称current support readiness
- **AND**human output、CLI flag、fixture或旧bundle MUST NOT替代source adapter evidence

#### Scenario: Source snapshot has partial direct coverage
- **WHEN**source snapshot只绑定config/release报告而database、worker、workflow、Identity或Owner任一来源仍为`unavailable/unknown`
- **THEN**snapshot MUST报告`complete=false`、准确direct/unknown count并让bundle保留对应unknown诊断
- **AND**component evidence、两个valid report或source snapshot digest MUST NOT被解释为完整staging support readiness

#### Scenario: Diagnostics bundle is mistaken for production authority
- **WHEN**bundle schema、candidate和所有diagnostic字段验证通过
- **THEN**`production_authorized` MUST remain false且bundle只能作为support、browser/a11y和DI-S3 review输入
- **AND**不得绕过security、privacy、SLO、operations、deployment或approver authority

### Requirement: Production operator targets MUST be stable and fail-safe

Taskfile生产目标 MUST 是CLI/服务的薄包装，显式校验environment、dry-run、opaque refs和evidence；MUST NOT 默认production、解析human output写状态、回落demo/local dependency或用确认变量替代外部approval。

#### Scenario: Managed dependency is unavailable
- **WHEN** operator运行managed release/integration目标但Identity、Owner、PostgreSQL或release evidence缺失
- **THEN** target MUST 返回blocked/No-Go并保留原退出码和脱敏evidence
- **AND**不得回落SQLite、fixture、local bridge或打印warning后成功

#### Scenario: Production write target lacks approval
- **WHEN** production/canary write目标只有`CONFIRM=1`或普通shell调用而无批准receipt
- **THEN** target MUST 只生成dry-run计划或拒绝
- **AND**不得执行deploy、tenant创建、secret修改或Owner mutation

### Requirement: Deployment state MUST come from an approved platform receipt

Production deployment MUST 绑定批准的artifact、stable manifest和approval digest，并由已选择的deployment platform产生versioned signed receipt。Workbench release state MUST 能区分planned、partially applied、deployed、unknown、failed、aborted和rolled back；Taskfile、Agent、命令exit 0或Pod health不得自行写入部署成功。Promotion在apply响应丢失或receipt暂时不可用时 MUST 进入Deploying/Unknown并使用原idempotency key与operation ref执行lookup/reconcile，MUST NOT 盲目创建第二次部署。

#### Scenario: Deployment receipt is missing or stale
- **WHEN**外部部署系统没有返回receipt，或receipt引用错误artifact/manifest/approval digest
- **THEN**promotion MUST 保持No-Go或unknown deployment state并停止扩大rollout
- **AND**不得以命令退出0、Pod健康或人工口头确认替代receipt

#### Scenario: Deployment is partially applied
- **WHEN**deployment platform返回partially applied receipt或rollout尚未覆盖批准target
- **THEN**promotion MUST 保持Deploying并记录真实进度与operation revision
- **AND**不得进入Production或把partial receipt重写为deployed

#### Scenario: Apply response is lost
- **WHEN**deployment apply请求可能已被平台接受但调用方未收到确定响应
- **THEN**promotion MUST 进入Unknown并使用原idempotency key或operation ref查询与reconcile
- **AND**不得创建第二个operation、扩大rollout或伪造failed/deployed terminal状态

#### Scenario: Signed deployed receipt is verified
- **WHEN**批准platform签发的deployed receipt绑定当前environment、capability、tenant scope、artifact、stable manifest和approval digest且通过trust验证
- **THEN**promotion MAY 进入Production并记录receipt revision与evidence digest
- **AND**post-deploy检查仍 MUST 只读，失败时触发pause、abort、rollback或incident流程而不是删除部署truth

#### Scenario: Restore verifier targets a normal or production database
- **WHEN** backup restore/verification target属于normal、shared staging主库或production数据库，或target isolation/cleanup无法证明
- **THEN** restore operation MUST be rejected before destructive commands run
- **AND** managed restore authority MUST require an explicit disposable target、current backup manifest/checksum/schema与provider-owned receipt

#### Scenario: Staging or canary SLO window has a gap
- **WHEN** 24h staging或7-day canary窗口缺少required indicator、daily checkpoint、observed seconds，或query/source/artifact/policy/trust digest发生变化
- **THEN** window authority MUST fail and restart for the new candidate
- **AND** 系统 MUST NOT拼接、补录、缩短窗口或把provider outage解释为zero incidents

#### Scenario: Read canary fails before mutation enablement
- **WHEN** Identity/provider/shadow/read canary出现wrong tenant/project/digest、revoke/offline failure、cross-tenant leak、projection gap或demo fallback
- **THEN** mutation、worker和workflow flags MUST remain disabled and rollout MUST abort or rollback
- **AND** read success alone MUST NOT automatically enable limited write or workflow execution

#### Scenario: Production candidate is rebuilt between environments
- **WHEN** staging、canary或production使用不同artifact/image/manifest digest，或在晋级过程中重新编译
- **THEN** promotion MUST fail and all downstream SLO、review、approval and deployment evidence MUST be regenerated
- **AND** environment differences MUST come only from approved profile and secret references

### Requirement: Data lifecycle MUST be implemented before privacy approval

Workbench-owned data MUST 有版本化classification、minimization、retention、export、delete/tombstone、async purge、backup expiry和legal hold合同，并通过跨数据库、projection、cache、evidence、diagnostics和backup的系统验证。Privacy review MUST 审核已实现行为，不能替代实现。

#### Scenario: Lifecycle inventory drifts from actual stores
- **WHEN**canonical inventory遗漏新增GORM table、projection/cache/evidence/diagnostics store，或class owner/policy digest与当前repository/provider metadata不一致
- **THEN**lifecycle contract MUST fail并阻止privacy review
- **AND**静态registry、旧inventory或Markdown清单 MUST NOT 替代实际store parity与owner签收

#### Scenario: Inventory claims Workbench stores Owner payload
- **WHEN**任一data class标记或实际检查发现Workbench保存Owner canonical payload、credential、private path或artifact blob
- **THEN**inventory与privacy gate MUST fail并路由到对应owning change清理
- **AND**系统 MUST NOT 通过重命名class、删除字段或把payload称为cache来绕过Owner边界

#### Scenario: One inventory owner scope is unsigned or stale
- **WHEN**domain GORM、evidence、support diagnostics、managed backup或external Owner boundary任一scope缺receipt，或receipt role/scope/trust/expiry/inventory/policy/catalog digest不匹配
- **THEN**aggregate inventory authority MUST remain blocked and privacy review MUST NOT start
- **AND**Workbench implementer、Agent、单一reviewer或repository parity MUST NOT 代替缺失Owner签收

#### Scenario: Owner review starts from an unbound or handwritten request
- **WHEN**Owner收到的待审输入不是CLI-authored current review request，或request未绑定唯一scope、expected role、inventory/policy/catalog digest、完整data classes/store bindings与bounded expiry
- **THEN**Provider review MUST NOT签发可消费receipt
- **AND**request MUST NOT包含Provider credential/key、用户内容、private path或production authorization

#### Scenario: Owner receipt is detached from review input or evidence
- **WHEN**receipt未绑定current review request digest，或required evidence requirement/ref/digest缺失、重复、未知、漂移或过期
- **THEN**receipt validation and aggregate authority MUST fail closed
- **AND**Markdown handoff、free-text evidence、测试fixture或单独签名receipt MUST NOT替代request/evidence binding

#### Scenario: Inventory receipts are duplicated, replayed, or revoked
- **WHEN**五scope中出现重复scope、重复receipt ref、重复nonce，或managed trust中的key已撤销、过期、未生效或未授权对应role/scope
- **THEN**authority generation and validation MUST fail closed without writing a replacement authority
- **AND**测试fixture、caller-provided public key或旧aggregate summary MUST NOT恢复授权

#### Scenario: Inventory authority is mistaken for production approval
- **WHEN**五scope receipt全部通过且aggregate可供privacy reviewer消费
- **THEN**authority MAY report provider ready、consumer done与privacy review authorized
- **AND**`production_authorized` MUST remain false until separate production readiness、security、operations、SLO、deployment与approver gates全部通过

#### Scenario: Repository schema changes after owner sign-off
- **WHEN**新增、删除或重分类GORM table导致repository catalog digest变化
- **THEN**受影响scope receipt与aggregate authority MUST立即失效并重新签收
- **AND**旧table count、旧receipt、migration成功或本地cache MUST NOT继续授权privacy gate

#### Scenario: Tenant deletion leaves derived data
- **WHEN**tenant/workspace删除或retention到期后，projection、cache、evidence、diagnostics或可恢复backup仍保留不允许的数据
- **THEN**privacy gate MUST 失败并阻止promotion
- **AND**不得删除Owner receipt/audit等必须保留的external truth来伪造清理完成

#### Scenario: Legal hold is active
- **WHEN**受信legal hold覆盖tenant/workspace/data class且尚未到review/expiry或解除receipt未验证
- **THEN**purge与backup expiry MUST 暂停但普通用户访问 MUST 继续保持阻断
- **AND**系统 MUST NOT 用永久布尔值、free-text或未签署操作扩大hold scope

#### Scenario: Workbench is asked to delete Owner canonical payload
- **WHEN**tenant删除流程涉及由Identity、Eikona或其他Owner治理的canonical payload
- **THEN**Workbench MUST 只清理自身metadata与derived data，或调用对应Owner批准的独立删除合同
- **AND**Workbench MUST NOT 直接删除external truth、伪造Owner receipt或把本地tombstone声明为Owner删除完成

### Requirement: First production tenant cutover MUST be explicit and progressive

首个租户 MUST 使用批准allowlist和同一artifact/manifest digest，依次完成Identity bootstrap、Provider connect、shadow projection、read-only canary、逐operation limited write、Daily loop、Workflow canary和观察；MUST NOT 直接把demo profile或普通用户资源切到生产。

#### Scenario: Demo or local fallback remains in candidate
- **WHEN** Web bundle、DB、projection、Layout、recent items、config或support bundle发现fixture tenant/token、localhost Owner、private path、demo receipt或local session fallback
- **THEN** cutover MUST No-Go并清理后重新生成candidate/evidence
- **AND**不得把demo数据标记为真实生产资源

#### Scenario: Read canary passes but mutation is unproven
- **WHEN** read-only projection、Layout和Asset Search通过，但receipt lookup/status/reconcile/cancel或cost/permission gate未通过
- **THEN** mutation和workflow flags MUST 保持关闭
- **AND** read success不得自动晋级Daily或Workflow capability

#### Scenario: Limited-write canary enters unknown or partial state
- **WHEN** response丢失、receipt unknown、partial child或cancel_requested出现
- **THEN** cutover MUST 停止扩大新dispatch并按原operation执行lookup/status/reconcile
- **AND**不得重放parent、伪造terminal或删除已成功child evidence

### Requirement: Production delivery MUST use independently assignable work packages

R5 MUST 将跨 Release 和跨 Owner 工作拆成具备单一 owning change、单一写入租约、明确依赖、直接验证命令、期望结果、failure recheck、evidence、kill switch/rollback 与失败 owner 的执行包。Provider Ready、Consumer Done、Environment Verified 和 Promotion Approved MUST 由不同权威证据支持，不能由同一手写状态或单方确认合并。

#### Scenario: A broad lane cannot be assigned safely
- **WHEN**一个任务要求多个 writer 同时修改共享 registry、Taskfile、release CLI 或同一 domain paths，或没有可独立执行的退出门
- **THEN**该任务 MUST 在实施前继续拆分并串行化冲突路径
- **AND**不得因总 Lane 有负责人就宣称可执行

#### Scenario: Provider and consumer disagree on readiness
- **WHEN**Provider 有合同/SDK 但缺真实 process/fault evidence，或 Consumer 已有 adapter/UI 但 digest、receipt/reconcile 或真实环境未验证
- **THEN**对应 handoff MUST 保持 `needs_contract` 或 `blocked`
- **AND**read-only、mutation、Daily、Workflow capability MUST 按各自证据独立关闭或降级

#### Scenario: Work package evidence becomes stale
- **WHEN**source、artifact、contract、schema、policy、definition、environment 或 approval digest 在验证后发生变化
- **THEN**工作包 MUST 从 `verified`/`promoted` 退回 `candidate` 或 `blocked` 并重跑直接门禁
- **AND**不得沿用旧 run、截图或人工签字继续晋级

### Requirement: Final GA MUST require complete requirement evidence

Umbrella与R0-R5、Identity/Owner provider/consumer changes只有在每个requirement映射到owner/test/environment/evidence/rollback且P0/P1=0时才能关闭；缺失 evidence MUST 被视为未完成。

#### Scenario: UI complete but provider integration missing
- **WHEN**页面和fixture E2E完成但Identity或Owner真实contract/canary/rollback缺失
- **THEN**对应capability MUST 保持needs_contract/disabled且GA MUST No-Go
- **AND**不得以截图、mock、local preview或artifact complete替代

#### Scenario: Final evidence bundle is missing or fails redaction
- **WHEN**任一required requirement引用的六件套缺文件、不可读、digest不匹配、只含fixture，或stdout/stderr/env/artifacts仍含敏感内容
- **THEN**final audit MUST 将该requirement标记为blocked并生成No-Go输入
- **AND**目录搜索、`latest`、CI green或summary中的redaction flag MUST NOT 替代直接验证

#### Scenario: Go decision is stale or weakly authorized
- **WHEN**decision缺少受信approver/role separation，或candidate、manifest、SLO、security、privacy、operations authority已变化、过期或撤销
- **THEN**decision MUST 失效并保持No-Go
- **AND**Agent、implementer、session身份、CLI flag或旧approval MUST NOT 自行恢复Go

#### Scenario: Archive is attempted with an unresolved blocker
- **WHEN**production receipt缺失或unknown、post-deploy失败、active incident、support handoff缺失，或任一required requirement非verified
- **THEN**R5与umbrella MUST 保持active并把blocker路由到owning change
- **AND**OpenSpec artifact complete、No-Go记录或Markdown checkbox MUST NOT 被解释为production delivery complete
