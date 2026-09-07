# R5 开放任务切片治理方案

## 1. 背景与口径

截至 2026-08-27，`workbench-production-ga-r5/tasks.md` 顶层任务 103 项（23 done / 80 open），含嵌套子任务共 **278 项（51 done / 227 open）**。开放项按 Lane 分布：

| Lane | 内容 | 开放/总数 |
| --- | --- | --- |
| Lane 0 | Program Completion Audit | 0/6 |
| Lane A | Reproducible Build and Supply Chain | 4/4 |
| Lane B | Managed Deployment and Configuration | 10/13 |
| **Lane C** | **Release Manifest and Promotion Workflow** | **78/106** |
| Lane D | Database, Backup, Restore, and DR | 10/11 |
| Lane E | Observability, SLO, Capacity, and Incident Readiness | 21/21 |
| **Lane F** | **Security, Privacy, Accessibility, and Support** | **53/65** |
| **Lane G** | **Staging, Canary, and Rollback** | **31/31** |
| Lane V | Final Go / No-Go and Closeout | 20/21 |

Lane C+F+G 合计 162 项开放，占全部 227 项开放的 **71%**，是 R5 剩余工作的主战场。本方案只对这三个 Lane 重新切片；Lane A/B/D/E 保持原编号链并行推进，Lane V 不提前切片（等 1–7 全部完成后按原序执行）。

## 2. 治理原则

- 切片只是执行分组，**不改变 tasks.md 的编号、Owner 与 `Dependencies:` 硬依赖**；跨片依赖以 tasks.md 为准。
- Markdown 不是状态源：每片出口以 verification 命令结果、release CLI 生成状态与脱敏六件套 evidence 为准，checkbox 只做索引。
- 每片同一时间单一写入租约（沿用 `details/production-execution-work-packages.md` 的 WP 租约划分）；Provider Ready 与 Consumer Done 分开计算，互不代签。
- 证据缺失、digest 不一致、只有 fixture 时一律投影 `blocked`，不得默认晋级；外部依赖 48h 无响应按 DAG §5 升级。
- 每完成一片，重跑 `bun scripts/execution-dag-snapshot.ts` 并刷新 `docs/operations/active-execution-dag.md`。

## 3. Lane C 切片（78 项开放）

| 切片 | 范围（tasks.md） | 开放 | 入口依赖 | 出口标准 |
| --- | --- | --- | --- | --- |
| C-1 Promotion 状态机 | 3.3a2/3.3a/3.3b/3.3c/3.3 | 5 | C-5 的 3.4d2b2b5b3（handoff authority 子链）先产出；2.0b 平台冻结 | promotion 状态机与 approvals 落地；状态迁移、幂等与失败路由有四传输 parity 测试；`task release:handoff:validate` 通过；component evidence 六件套 |
| C-2 制品集与容器目标 | 3.4b2b、3.4b3（含 b3a–b3c 嵌套链） | 6 | 1.1 reproducible build；3.4b2b 另需 R4 9.2b + R4 10.5（跨 release 硬依赖） | 完整 production artifact set 关闭并带 approved builder 证明；container build/smoke 目标对真实镜像通过；digest 绑定进 manifest |
| C-3 SBOM/供应链目标 | 3.4b4（b4b2a–e、b4b4a–f、b4c1–4、b4d1–4、b4e1–4 五条嵌套链） | 30 | C-2 的 artifact set；3.4b4b2a 需 deployment/registry/KMS owner 可用（外部） | SBOM/provenance/signature/advisory 目标全部对真实制品执行；dependency/license/advisory scan 结果入 manifest；scan 失败 fail-closed；evidence 六件套 redaction 0 |
| C-4 制品扫描/redaction 目标 | 3.4b5（b5b1–b5、b5c1–3、b5d1–5 嵌套链） | 17 | C-3 部分子链（b5b2←b5b1，b5c←b4c）；3.4b5d3 另需 3.4d2b2b3b2（review authority） | secret/source/layer scan 目标实现并对命中项 fail-closed；与 1.4 redaction gate 对齐；证据递归脱敏核验通过 |
| C-5 Authority 适配器与 manifest v3 | 3.4d2b2b1b2、3.4d2b2b2b、3.4d2b2b3（3）、3.4d2b2b4（5）、3.4d2b2b5（5） | 15 | selector 独立批准（release owner + Identity/Eikona provider）、managed PostgreSQL restore 权威（R0）、review approvers、SLO/soak authority、provider/consumer handoff owner 均到齐 | 每类 authority 有独立 provider+consumer evidence；manifest v3 生成且 digest 绑定；任一 authority 缺失时门禁 fail-closed 而非降级 pass |
| C-6 Promotion 操作与收口文档 | 3.4c、3.4d3、3.4d4、3.4d5、3.4e | 5 | C-1、C-5 完成；3.4c 需 2.4 + Lane D 4.2/4.3；3.4d4 需 Lane E 5.1–5.4 | promotion/pause/abort/rollback dry-run 在 staging 等价环境执行成功；soak/canary/error-budget report 目标可用；audit/decision validate 与 post-deploy 只读检查通过；incident/runbook/docs 与目标一致性核对完成 |

片内顺序提示：C-3 的五条嵌套链（b4b2/b4b4/b4c/b4d/b4e）是长串行链，应作为 C-3 内部关键路径优先启动；C-1 与 C-5 互为部分前置，按 tasks.md 硬依赖交错推进，不强行排序。

## 4. Lane F 切片（53 项开放）

| 切片 | 范围（tasks.md） | 开放 | 入口依赖 | 出口标准 |
| --- | --- | --- | --- | --- |
| F-1 数据分类与清单冻结 | 6.0a1（含嵌套 15）、6.0a3、6.0a4 | 17 | 0.2 capability 冻结；6.0a1d 需 R1/R2 handoff 证据 | data classification/owner/retention inventory 冻结；legal hold、backup expiry、Owner external truth 语义冻结；lifecycle 合同兼容与安全负测通过 |
| F-2 Lifecycle 执行链 | 6.0b1–6.0b5 | 5 | F-1 的 6.0a2 合同（已完成）+ 6.0a1 清单；6.0b4 需 4.3 restore verifier | export/delete/tombstone/projection 清理/retention 核验逐项落地；6.0b5 跨存储 joint system gate 通过并产出 evidence |
| F-6 支持诊断包 | 6.3d（含 6.3d1b1c1a–c6 等嵌套 22） | 22 | 4.2/4.3/4.4/4.5、5.1/5.2；6.3d1b1b1 需 WP-I10 provider process、managed TLS/service mesh、issuer/JWKS/delegation authority（外部）；末环 6.3d1b1c6 需 R4 5.0b2b2e1（跨 release） | safe support diagnostics bundle 实现并验证；bundle 递归 redaction 核验 0 泄漏；support/operations 消费方验收 |
| F-3 独立安全总评 | 6.1 | 1 | 汇合门：1.4 + 2.4 + 4.5 + 5.4 + 3.4b5d3 stable candidate | independent security review 报告产出，无未解决 P0/P1；发现项回流 owning slice |
| F-4 隐私复核 | 6.2a–6.2d | 4 | F-3 通过 + 6.0b5 | independent privacy reviewer 完成 inventory/minimization/Owner 边界与 export/delete/hold/backup fault matrix 复核；privacy review authority 生成并被 Workbench release consumer 验证 |
| F-5 浏览器/a11y/support 签收 | 6.3a、6.3b、6.3c、6.3e | 4 | F-3 通过；F-6 完成（6.3e 依赖 6.3d） | browser critical journey 矩阵冻结；keyboard/screen reader/zoom/reduced-motion 与 browser security/session rescue/revoke/offline 验收通过；independent ui/a11y + operations 签收 |

调度说明：F-1/F-2/F-6 不依赖 6.1 汇合门，应与 Lane C 并行提前推进；F-3/F-4/F-5 是汇合门之后的独立 review 链，不得用自检代替独立 reviewer。

## 5. Lane G 切片（31 项开放）

| 切片 | 范围（tasks.md） | 开放 | 入口依赖 | 出口标准 |
| --- | --- | --- | --- | --- |
| G-1 Cutover 计划与 shadow dry-run | 7.0a（4）、7.0b（4） | 8 | 2.3 preflight；R1/R2 Provider Ready/Consumer Done；7.0b 另需 4.5、5.2 | 首租户 cutover allowlist 与 dry-run 计划生成；bootstrap + shadow dry-run 执行并产出 staging evidence；失败路径可回退 |
| G-2 Staging 进入与 24h soak | 7.1、7.2（含 7.2a–d 嵌套） | 6 | 1.x–6.x 全部关闭 + 7.0b；7.2 另需 5.3d | GA candidate manifest 进入 Staging；24h soak 与 rollback drill 达标（latency/error budget/receipt 齐全），非 24h 结果 fail-closed |
| G-3 Canary 阶梯 | 7.3a（5）、7.3b（4）、7.3c（4） | 13 | 7.2 通过；7.3b 需 R2/R3 owner + 用户批准；7.3c 需 R4 owner + 用户批准 | read-only → limited-write → workflow 三级 canary 逐级独立 evidence；每级 rollback/drain 演练通过；越级禁止 |
| G-4 7 天观察 | 7.4（含 7.4a–c） | 4 | 7.3c + 5.1 SLO authority | 7 天 canary/error-budget/incident/rollback 观察达标；观察报告作为 8.1 证据审计输入 |

Lane G 严格串行：G-1 → G-2 → G-3 → G-4，任一环节失败即停止扩大范围并按 8.5c 路由 blocker。

## 6. 治理节奏

1. 每周（或每完成一片）重跑 `bun scripts/execution-dag-snapshot.ts`，核对开放集中度是否从 C/F/G 转移。
2. 每片关闭时在 tasks.md 记录 evidence run-id；跨片 unblock 事件同步刷新 `docs/operations/active-execution-dag.md` §3 关键路径。
3. Lane V（8.1–8.5）不做预切片；仅当 1.x–7.x 全部关闭后按原序执行，8.3b 需用户/root 明确 production 批准。
