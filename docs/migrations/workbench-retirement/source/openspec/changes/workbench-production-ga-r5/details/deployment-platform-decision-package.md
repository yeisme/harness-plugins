# Workbench Deployment Platform 选型决策包

## 1. 当前事实

截至当前工作树，Workbench 没有 `deploy/**`、`Dockerfile`、container smoke、subproject CI workflow、deployment adapter或平台receipt实现。现有可部署拓扑至少包括：

- Bun Web/BFF；
- Go `workbenchd` API/control plane；
- Go `workbench-worker`；
- 独立migration、backup与restore verification命令；
- managed PostgreSQL；
- HTTP/SSE、gRPC与JSON-RPC入口；
- staging 24h、canary 7d、progressive rollout、pause/abort/rollback要求。

因此不能直接从Demo profile发布，也不能以现有本地Taskfile或二进制构建作为deployment authority。平台必须同时覆盖长运行API/worker、一次性migration job、managed secret/config、readiness/drain、progressive rollout、operation lookup和可签名receipt来源。

## 2. 决策目标

选择一个首个production runtime与deployment authority，使其能够：

1. 部署Web/API/worker和migration job；
2. 使用immutable image digest，不依赖mutable tag；
3. 支持non-root、read-only filesystem、resource limits、network/egress policy与graceful drain；
4. 支持rolling或blue/green、分wave canary、pause、abort与rollback；
5. 提供稳定operation ref、idempotency与lookup/reconcile；
6. 将environment、tenant scope、artifact、stable manifest和approval绑定到signed deployment receipt；
7. 与managed PostgreSQL、observability、KMS/secret manager和CI provenance集成；
8. 在staging sandbox中运行完整负向演练后才开放production。

## 3. 候选方案

### 3.1 Kubernetes + GitOps Controller

部署资源由Kustomize或Helm生成，GitOps controller负责apply与持续reconcile；provider adapter读取Git commit、Application/rollout operation、workload revision与health，使用批准signer生成Workbench deployment receipt。

优点：

- 最适合Web/API/worker/migration多工作负载和独立扩缩容；
- 原生支持readiness、drain、Job、NetworkPolicy、resource/security context；
- 可通过Argo Rollouts、Flagger或平台原生策略实现wave、pause、abort与rollback；
- Git revision、image digest、resource revision和operation可形成较强provenance；
- 适合后续多个Owner adapter与worker拓扑。

风险：

- 运维复杂度最高，需要cluster、GitOps、registry、KMS、managed PostgreSQL与on-call基础；
- Kubernetes health不是deployment receipt，仍需专用adapter规范化并签名；
- Helm/Kustomize与GitOps controller只能选择一套主authoring/reconcile路径，避免双重状态源。

### 3.2 Managed Container Platform

使用支持service/job、revision、traffic split和managed identity的平台，例如批准的云容器服务。Adapter消费平台deployment operation与revision API并签发receipt。

优点：

- 基础设施和on-call成本较低；
- 通常自带revision、traffic split、logs/metrics、secret integration；
- 适合首租户快速建立staging/canary。

风险：

- 长运行worker、gRPC/SSE、migration job、network policy和精细pause/abort能力需要逐项确认；
- 部分平台缺少稳定operation lookup或rollback receipt；
- 未来Owner数量和worker拓扑增长时可能遇到平台边界。

### 3.3 CI/CD 直接部署到VM或Compose

由CI runner通过SSH、systemd或Compose更新服务。

优点：初始实现最少，适合本地或短期integration环境。

风险：难以可靠实现tenant/environment隔离、progressive rollout、operation lookup、signed receipt、network policy、worker drain与并发安全。除非组织已有成熟的versioned deployment service和receipt signer，否则不适合作为production authority。

## 4. 评估矩阵

评分为1到5，5最佳；权重用于首个production tenant，不代表永久平台结论。

| 维度 | 权重 | Kubernetes + GitOps | Managed Container | VM/Compose |
| --- | ---: | ---: | ---: | ---: |
| 多工作负载与migration job | 15 | 5 | 4 | 2 |
| Worker、SSE、gRPC适配 | 15 | 5 | 3 | 3 |
| Progressive rollout/pause/abort | 15 | 5 | 3 | 1 |
| Operation lookup与receipt来源 | 15 | 4 | 4 | 1 |
| Security/network/resource policy | 10 | 5 | 4 | 2 |
| Managed Postgres/secret/KMS集成 | 10 | 5 | 5 | 2 |
| 运维复杂度与首发速度 | 10 | 2 | 5 | 4 |
| 长期Owner/worker扩展 | 10 | 5 | 3 | 2 |
| 加权结果 | 100 | 460/500 | 380/500 | 205/500 |

## 5. 建议结论

**建议首选 Kubernetes + 单一 GitOps controller 作为production runtime与deployment source，使用独立provider adapter生成签名receipt。**

理由不是“行业标准”，而是Workbench已有明确的API、worker、migration job、managed PostgreSQL、SSE/gRPC、progressive rollout、workflow drain和未来多Owner扩展需求。Managed container platform可作为成本更低的备选，但必须先证明worker常驻、SSE/gRPC、job、traffic wave、pause/abort、operation lookup与rollback receipt全部满足。

该建议仍是技术推荐，不等于平台已批准。`2.0b`只有在root/operations指定实际platform、owner、repository、staging sandbox、GitOps controller、registry、KMS/secret manager和on-call之后才能完成。

## 6. 推荐实现边界

若批准Kubernetes + GitOps：

- `deploy/base/**`：Web/API/worker/migration的provider-neutral基础资源；
- `deploy/overlays/integration|staging|canary|production/**`：只保存非secret配置、resource policy、replica/wave差异和secret references；
- 单一Kustomize或Helm authoring体系，由平台owner选择，不同时维护两套；
- GitOps controller是reconcile source，image registry只接受immutable digest；
- rollout controller负责wave/pause/abort；普通Deployment rollout不能伪装精细canary；
- deployment adapter位于platform owner repository，不嵌入Workbench业务状态机；
- adapter签名key位于KMS/HSM，Workbench只消费public trust bundle；
- promotion record与receipt保留opaque Application/operation refs，不保存cluster endpoint/namespace credential。

## 7. Staging Sandbox 必须证明

在批准production前，staging sandbox必须完成：

1. immutable image digest部署Web/API/worker；
2. 独立migration Job，失败时阻止应用rollout；
3. readiness/liveness/startup、SIGTERM drain与worker claim pause；
4. non-root、read-only filesystem、resource limits、egress deny-by-default；
5. managed PostgreSQL连接、backup/restore验证和schema compatibility；
6. 10%或单实例canary wave、pause、继续、abort；
7. apply响应丢失后的lookup/reconcile，不重复创建operation；
8. partial、failed、aborted、deployed与rolled_back signed receipts；
9. signer key rotation/revocation；
10. post-deploy只读smoke与evidence redaction。

## 8. Platform Adapter 最小API

平台owner必须交付versioned machine API或CLI：

- `validate`：只读验证platform/environment/adapter capability；
- `plan`：生成绑定image/stable manifest/approval的canonical plan digest；
- `apply`：使用idempotency key创建operation；
- `lookup`：读取当前operation revision并签发receipt；
- `pause`、`abort`；
- `rollback-plan`、`rollback-apply`；
- `trust-export`或等价managed public trust distribution流程。

所有命令必须支持structured output、stable exit codes与redaction；human stdout不得作为state source。真实写操作必须经过显式approval gate。

## 9. 决策签收清单

Root/operations需要明确填写并批准：

| 决策项 | 必须给出的结果 |
| --- | --- |
| Runtime/platform | 实际产品与版本/服务层级 |
| GitOps/deployment controller | controller与版本，或managed platform operation API |
| Owner repository | adapter与deploy manifests归属仓库 |
| Environment inventory | integration/staging/canary/production的权威source |
| Artifact registry | immutable digest、retention与signature policy |
| Secret/KMS | credential注入与receipt signing authority |
| Managed PostgreSQL | provider、HA/backup/PITR/RPO/RTO能力 |
| Observability | metrics/logs/traces/incident authority与retention |
| Network | ingress、egress、private dependency访问和DNS ownership |
| Rollout | wave模型、观察窗口、pause/abort/rollback能力 |
| Operation SLA | apply timeout、lookup SLA、Unknown reconcile周期 |
| On-call | platform、DB、security、Workbench failure owner |
| Cost boundary | staging/canary/production预算与自动停止条件 |

缺少任一关键owner、repository、sandbox、operation lookup或receipt signer时，2.0b保持blocked，后续只能实现dry-run和本地validator。

## 10. 下一步任务

1. Root/operations在本决策包上确认Kubernetes + GitOps或指定managed container替代方案。
2. 创建platform-owned adapter与deployment manifest implementation owner；不得把新平台代码直接塞入Workbench release CLI。
3. Workbench实现container与artifact/supply-chain基础门禁。
4. Platform owner建立staging sandbox并完成只读`validate`/`plan`。
5. Security建立deployment trust bundle与signer。
6. Stable v3冻结后完成apply/lookup/pause/abort/rollback集成。
