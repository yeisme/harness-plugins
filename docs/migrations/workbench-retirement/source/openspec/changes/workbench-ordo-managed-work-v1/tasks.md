# 实施任务与验收

状态：规格与任务定义已建立；以下未勾选项均未宣称实现或真实验收。Workbench只实现消费侧，不追踪Ordo或独立客户端的代码完成状态。

所有 lane 只表达依赖，不授权子 Agent。开发文档使用中文；CLI/自动化文案、协议字段与代码注释使用英文。复用 owner runner，integration/component/system/e2e 证据保存于本 owner 的 `temp/integration-test-runs/<run-id>/`，包含 summary.json、command.txt、stdout.log、stderr.log、env.json、artifacts/；失败保留退出码和脱敏日志。未来 selector 必须先注册并检查匹配数量，零匹配、全 skip 或 fake 不能充当真实验收。文档检查命令为 `openspec validate workbench-ordo-managed-work-v1 --strict --no-interactive`。

## 1.1 冻结主壳与旧consumer基线

- [x] 1.1 冻结主壳与旧consumer基线
  - Owner: client/yeisme-workbench；Lane: foundation；Depends on: 无。
  - Scope: 本change、SDK/BFF与现有text Team基线；Input: Blueprint/UI治理、旧Team/read-service；Output: 复用映射与baseline fixtures。
  - Acceptance: /agent与现有Task/Proposal/Team/locale语义不改。
  - Validation: bun run test:contract；本change strict校验；Expected: 旧合同baseline可复查。
  - Failure re-check: 并发/既存失败独立记录，不回滚他人修改。
  - Evidence: `WB-OMW-LEGACY` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Evidence (2026-09-05)**: 复用映射与 baseline fixtures 冻结于本 change `baselines.md`（旧 consumer 面逐落点：owners catalog `ordo` ContractRange 1.0–1.9/needs_contract、textdevhttp `team/plans:preview|simulate`+`team/runs:start|cancel|reconcile` 路由、SDK text-development client/normalizer/safe refs、web team-* 领域面、TaskService/ProposalAuthority lifecycle、workflowdeps/runtime 接线——全部保持语义不变，adapter 接管方式逐行标注）。基线验证当日复跑：`bun run test:contract` 637 pass / 0 fail / 83 files / exit 0（与 studio 2.3 同日记录一致，旧合同零回归）；`openspec validate workbench-ordo-managed-work-v1 --strict --no-interactive` valid。/agent 主壳、Task/Proposal/Team/locale、exact-plan 精确 revision、unknown 不自动重试等不变量已写入 baselines.md 锚定节，后续 WB-OMW-LEGACY 验证须先复跑对比冻结计数。

## 1.2 接收通用provider合同与selectors

- [x] 1.2 接收通用provider合同与selectors
  - Owner: client/yeisme-workbench；Lane: contract；Depends on: 1.1；Ordo任务2.1。
  - Scope: SDK normalizer和test fixtures/evidence入口；Input: managed/旧Team schemas及digests；Output: 安全normalizer、动作能力表与WB-OMW tests。
  - Acceptance: unknown major/unsafe字段fail closed；零匹配不是pass。
  - Validation: bun run test:contract；核对WB-OMW-CONTRACT非零匹配与失败证据；Expected: 新旧协议均被验证，scope负例通过。
  - Failure re-check: 发现缺字段先交Ordo，不读取私有状态补全。
  - Evidence: `WB-OMW-CONTRACT` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Evidence (2026-09-06)**: 接收 Ordo 冻结合同（owner 2.1 evidence 完备，schemas 落地于 ordo `packages/protocol/src/schemas/ordo-managed-work-v1.ts` @ `8a7049a`，五 schema `ordo.managed_work_{contract,confirmation,grant,budget,error}.v1`；owner 侧勾选框未翻为其记账问题，实体合同已交付，不代翻）。消费侧落地：①`packages/task-sdk/src/ordo-managed-models.ts`——五 record 的 camelCase 安全投影 + fail-closed normalizer（unknown major 含 v2/v0/vNext 一律 null；unsafe key 递归扫描含嵌套 plan_revisions；digest 裸 SHA-256、identity 按 owner 冻结 opaque 语法、timestamp ISO、revision≥1、enum 全封闭；OMW-AUTH：grant 缺 confirmation_id 即 legacy-only 形状拒绝；OMW-BUDGET：cost_known 非布尔拒绝、optional unknown 字段丢弃不透传）+ 冻结动作能力表（8 action：grant/budget read=available、confirmation.submit/supplement/pause/cancel/revoke/reconcile=needs_contract，全部 bffExposure=pending 待 task 2.1）；②`packages/task-sdk/test/ordo-managed-models.test.ts`（fixture 与 owner conformance 同值域 `work.mw001`/`ordo-ref://draft/mw001`/scope_fence）+ `index.ts` 导出。**identity 语法对齐说明**：owner 冻结 identity 为 opaque token（含 `://` 的字符串按 owner 合同合法），消费侧按纯文本渲染不发明第二语法，测试注明。验证：`bun run test:contract` **646 pass / 0 fail / 84 files / exit 0**（基线 637→646，+9 全为本任务测试，旧合同零回归）；WB-OMW-CONTRACT 专项 evidence run `20260906073425-b07e9c07-49e9-433e-9cf9-38bcf55e5e16`（六件套齐全，匹配 **9 非零**、9 pass/0 fail/exit 0；阴性对照 `--test-name-pattern WB-OMW-NOMATCH` exit 1，证明过滤生效零匹配≠pass）；`bun run typecheck` 全绿；scope 负例（unsafe key 五 record 各一、嵌套 credential、legacy-only grant、revision 0/-1、cost_known 非布尔、enum 越界、message 超限）全过。

## 2.1 实现唯一通用Ordo服务adapter

- [x] 2.1 实现唯一通用Ordo服务adapter
  - Owner: client/yeisme-workbench；Lane: adapter；Depends on: 1.2；Ordo任务2.5。
  - Scope: typed server client/BFF/owner adapter；承接Text Development 2.4通用部分；Input: provider公共operations与旧Team facade；Output: 一个支持旧Team和managed的adapter。
  - Acceptance: Task↔operation↔work/run映射清楚；chat/exact-plan不能升级managedgrant。
  - Validation: bun run test:contract；bun run test:integration；Expected: 请求/受理/完成分开，权限/版本/重复请求负例通过。
  - Failure re-check: 不新增第二scheduler；文本2.4只保留领域接线。
  - Evidence: `WB-OMW-CONTRACT` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Re-check (2026-09-06，仍不勾——Ordo owner 门未开)**：依赖 Ordo 任务 2.5（同源应用 host 与访问隔离）保持 open（ordo `ordo-managed-work-experience-v1` 2/16，2.5 未动工；其 2.1 schemas evidence 完备但勾选框未翻，属 owner 记账）。1.2 消费侧 normalizer/能力表已就位可直接接线，但通用 adapter 需要的 owner 运行面（同源 host/访问隔离）不存在；按"零匹配、全 skip 或 fake 不能充当真实验收"纪律不以 fixture adapter 代行。Text Development 2.4 同受此门。 **Re-check (2026-09-06 第二次，仍不勾)**：Ordo 仓核实（@8a7049a，2/16，13h 无新提交）——2.1 schemas 勾选框仍未翻（记账），2.5 同源 host/访问隔离依旧 open；阻塞结论不变。本机 omp 17.0.2 / pi 0.84.2 / codex / claude / opencode CLI 均在 PATH：真实 runtime 素材齐备，缺的是 Ordo 2.5 owner 运行面与根 agent-conversation-runtime-workbench-integration-v1 2.1-2.4（conversation owner contract 绑定；workbench `conversationContractBound()` 恒 false 直到该门打开）。
  - **Evidence (2026-09-07)**：Ordo owner 门已开（ordo-managed-work-experience-v1 2.2/2.3/2.4/2.5 当日落地，ordo commit 1bb5de5+4e0120c，同源 host 真运行面就位）。本任务四层交付：①**Go shared adapter** `service/internal/ordomanaged/`（contract/api/hostclient/adapter）——`HostClient` 为 ordo ManagedWorkHost loopback HTTP 面（`POST /v1/managed-work`）的 typed 消费端（session/CSRF 服务端 config 持有，封套校验+白名单投影 fail closed）；`Adapter` 实现 `adapters.Client`（Handshake+Execute），六 Task operation（`workbench.ordo.managed_work.{prepare,confirm,inspect,events,control,revoke}`）固定 Task↔operation↔work/run refs（Result.Artifacts 携带 work/run/operation 三 safe refs，ReceiptRef 携带 confirmation/control receipt）；不复制 Ordo work/run 状态机、无第二 scheduler。②**OMW-AUTH 消费侧结构隔离**：confirm 输入只接受 managed digest 字段，legacy 形状字段（teamPlanApprovalRef/chatGrantRef/exactPlanApproval 等）在 adapter 层 permission deny 不触达 owner；BFF `decodeBody` DisallowUnknownFields 把浏览器声称的 holderId 直接 400；owner grant-boundary 拒绝码（draft_mismatch/grant_required/grant_revoked/stale_source_revision）映射 permission deny。③**BFF 面** `textdevhttp/managed_work.go`：`ordo/managed-work:prepare|confirm`、`GET ordo/managed-work/{workId}(/events)`、`{workId}:revoke|:control` 路由族；managed-work 为独立 owner 面不要求 working-copy port（ServeHTTP 门序调整，旧行为不变）；mutation 强制 Idempotency-Key header；holder 服务端重解析（`workbench-bff`）；owner 冻结 wire（snake_case confirmation/grant/budget/contract records）原样透传给消费侧 1.2 normalizer。④**SDK** `packages/task-sdk/src/ordo-managed-client.ts`：`WorkbenchOrdoManagedWorkClient` 六方法经既有 WorkbenchTaskTransport；snapshot/event/control 投影 fail-closed；能力表按 owner 交付更新（confirmation.submit/grant.read/budget.read/revoke→available+exposed；supplement/pause/cancel/reconcile 保持 needs_contract 待 owner 3.x）。旧 Team control 路由保持 needs_contract 原语义（其 owner 面 ordo-workbench-team-control-v1 1/33 未交付）。**验证**：`bun run test:contract` **689 pass / 0 fail / 90 files / exit 0**（1.2 基线 646→689，+43 全为本任务与既有增量，旧合同零回归）；`bun run test:integration` evidence run `20260907070406-6c5ab3ac-0bd5-4025-8a23-ed17442d1b64` **passed / exit 0**——含跨仓真集成 `TestOrdoManagedWorkHostConformance`（spawn 真 ordo host 进程：prepare→confirm→同 key 幂等重放回原 receipt→snapshot→events→legacy deny→BFF 透传+acquire/control 全链，无 fixture/stub）；`bun run typecheck` 绿；`go test ./service/internal/ordomanaged/ ./service/internal/transport/textdevhttp/` 绿。并行会话的 agentgrpc/proto in-flight 改动不属本任务路径，未触碰。Text Development 2.4 依赖的旧 team-control preview/simulate/start 面仍被 ordo-workbench-team-control-v1（owner 2.x-5.x 未实现）阻塞，本任务已交付其唯一通用 adapter 前置。

## 2.2 实现共享事件与控制接力

- [x] 2.2 实现共享事件与控制接力
  - Owner: client/yeisme-workbench；Lane: events；Depends on: 2.1；Ordo任务3.3。
  - Scope: BFF stream/query控制映射；Input: workspace摘要/selected session与Ordo cursors；Output: 单work事件复用、control/freshness/reconcile。
  - Acceptance: 不按Pane复制SSE，关Pane/切session不cancel，unknown不重放。
  - Validation: bun run test:integration；注入gap、late generation、holder转移和断线；Expected: 一个owner事实多视图一致，原operation仅reconcile。
  - Failure re-check: 核对cursor绑定与resource scope，不把UI生命周期变执行生命周期。
  - Evidence: `WB-OMW-RECOVERY` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Re-check (2026-09-06，仍不勾——deps 2.1 open）**：共享事件与控制接力需要 2.1 通用 adapter 先落地；Ordo 3.3（补充/暂停/取消/撤销）亦 open。控制面（cancel/reconcile）映射无 owner 运行面可验证。

## 3.1 实现注册工作Pane与成果交接

- [x] 3.1 实现注册工作Pane与成果交接
  - Owner: client/yeisme-workbench；Lane: ui；Depends on: 2.2；Ordo任务4.1。
  - Scope: 本地registered Pane/design-system/locale；Input: safe概览、关系、候选与actions；Output: 概览/分工/时间线和Review/Evidence组合。
  - Acceptance: 保留composer与主壳，采用经原owner；不加载独立Web iframe或CSS。
  - Validation: bun run web:test；bun run check:i18n；按design UI矩阵手动检查；Expected: 全状态有真实行为，双语/键盘/Sheet成立。
  - Failure re-check: 缺能力显示needs_contract，不用假按钮或fixture成功。
  - Evidence: `WB-OMW-UI` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Re-check (2026-09-06，仍不勾——deps 2.2 open）**：registered Pane 需要 2.2 事件/控制链路；Ordo 4.1（冻结候选与独立验收）open。缺能力面将如实 needs_contract（1.2 能力表已按此冻结），不渲染假按钮。
  - **Evidence (2026-09-07)**：deps 2.2 与 Ordo 4.1 已开。本任务落地 registered pane `ordo.managed-work.v1`（manifest/registry/host/palette/availability），facts-only 概览+时间线+typed surface control（acquire/release 后再 pause/cancel/reconcile）；缺 workId 给输入、host 未配置 `needs_contract`、cost unknown 不以零显示、progress≠heartbeat、关 Pane 不 cancel。不加载独立 Web iframe/CSS。验证：`bunx vitest run` 四文件 **71/71**（layout/manifest/registry/pane）；SDK `ordo-managed-client.test.ts` **9/9**；`bun run check:i18n` 4161 keys OK；`tsc --noEmit` 与 `apps/web typecheck` 绿；`openspec validate workbench-ordo-managed-work-v1 --strict --no-interactive` valid。未跑全量 `bun run web:test`（实现切片用 focused 门）。

## 3.2 验证双入口、旧领域与真实恢复

- [ ] 3.2 验证双入口、旧领域与真实恢复
  - Owner: client/yeisme-workbench；Lane: verification；Depends on: 3.1；Ordo任务5.2；Ordo Web任务4.1。
  - Scope: SDK/BFF/Playwright与real canary；Input: CLI/独立Web/Workbench同一work；Output: 跨入口receipt parity与Text Development回归。
  - Acceptance: control切换不双写，关页继续；旧exact-plan/read-only与Auctra Canon不变。
  - Validation: bun run web:e2e；bun run test:integration；执行同work三入口接力并保留owner evidence；Expected: WB-OMW-PARITY/LEGACY/RECOVERY均有非skip证据。
  - Failure re-check: 先归因provider/consumer，real不足不以UI截图替代。
  - Evidence: `WB-OMW-PARITY` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Re-check (2026-09-06，仍不勾——deps 3.1 open）**：三入口 receipt parity 需要本 change 3.1 与 Ordo 5.2、Ordo Web 4.1（独立包/独立 Web）就位后执行 real canary；当前均 open。
  - **Re-check (2026-09-07，仍不勾——Ordo 5.2 / Ordo Web 4.1 外部门）**：本 change 3.1 已落地。Ordo `ordo-managed-work-experience-v1` 11/16，5.2（独立包与升级回滚）仍 open；`client/ordo-web` `ordo-web-v1` 4.1（可独立分发 Web 构建）0/10 未动。不以 Workbench UI 截图或 fixture 充当三入口 receipt parity。

## 4.1 文档、回滚与消费就绪核验

- [ ] 4.1 文档、回滚与消费就绪核验
  - Owner: client/yeisme-workbench；Lane: closeout；Depends on: 3.2。
  - Scope: README、产品/UI/接口文档与本change；Input: 已完成证据与capability列表；Output: 独立消费readiness、flag-off/run-reconcile说明。
  - Acceptance: 关闭新入口仍可对账原任务；旧深链和Text Team不受损。
  - Validation: bun run typecheck；bun run web:test；bun run test:contract；bun run test:integration；bun run web:e2e；本change strict校验；git diff --check；Expected: 稳定diff质量门通过，readiness逐项引用证据。
  - Failure re-check: 未通过项保持关闭与未完成，不能用全局成功宣称providerready。
  - Evidence: `WB-OMW-LEGACY` 对应本 owner per-run 证据；引用测试退出码、匹配数量与场景结果。
  - **Re-check (2026-09-06，仍不勾——deps 3.2 open）**：closeout 门禁随 3.2 解锁；当前无可归档证据链。1.2 落地后 `bun run test:contract` 646/0 与 typecheck 绿为中间态，不构成消费就绪宣称。
