# Slice 1 执行报告：workbench-identity-provider-contract-v1

日期：2026-08-28　执行者：workbench owner 代理（slice 1 消费端切片）

## 交付清单

| 交付物 | 路径 | 状态 |
| --- | --- | --- |
| OpenSpec change（proposal/design/tasks/spec delta） | `openspec/changes/workbench-identity-provider-contract-v1/{proposal,design,tasks}.md`、`specs/workbench-identity-provider-contract/spec.md` | 完成，strict valid |
| HTTP Provider 实现 | `service/internal/identity/http_provider.go`（新增文件） | 完成 |
| HTTP Provider 测试 | `service/internal/identity/http_provider_test.go`（新增文件） | 完成 |
| runtime 最小接线 | `service/internal/runtime/runtime.go`（4 处最小改动，见下） | 完成 |
| 本切片报告 | `openspec/changes/workbench-identity-provider-contract-v1/details/slice-1-executor-report.md` | 完成 |

### runtime.go 改动明细（全部为追加式，不改既有函数的既有行为）

1. `Config` 结构体新增 `IdentityProviderURL string` 字段（注释说明 default-off 语义）。
2. `LoadConfig` 的 `if profile == ProfileManaged` 分支内读取 `WORKBENCH_IDENTITY_PROVIDER_URL`（TrimSpace）；local 分支该值恒为空串。注意已知陷阱：LoadConfig 在 flag.Parse 之前运行，profile 来自 `WORKBENCH_PROFILE` env 或 user config——`-profile` flag 单独不足以让本 env 生效。
3. `Config.Validate`：local 分支新增「identity provider endpoint configuration is only supported by managed profile」拒绝（对齐既有 `identity provider configuration is only supported by managed profile` 风格）；managed 分支在 URL 非空时用 `identity.NewHTTPProvider` 跑 URL policy，失败 → startup fail-fast。
4. `New()`：在 `identity.NewService(...)` 之前，仅 `config.Profile == ProfileManaged && URL 非空` 时构造 `identity.HTTPProvider` 注入第三参；URL 为空保持 nil（与现状完全一致）。构造失败 → `create identity provider` 错误，不回退 nil 继续跑。

## 验证命令与结果（2026-08-28 实跑）

| 命令 | 结果 |
| --- | --- |
| `gofmt -l service/internal/runtime/runtime.go service/internal/identity/` | 空（干净） |
| `CGO_ENABLED=0 go vet ./service/internal/runtime/ ./service/internal/identity/` | 无输出（通过） |
| `CGO_ENABLED=0 go test ./service/internal/identity/ -count=1` | `ok github.com/yeisme/yeisme-workbench/service/internal/identity`（含新增 9 个测试函数、20+ 用例，既有 44+ 用例零回归） |
| `CGO_ENABLED=0 go test ./service/internal/runtime/ -count=1` | `ok`（42.9s，全包不回归——default-off 行为等价性由全包测试背书） |
| `CGO_ENABLED=0 go build ./service/cmd/workbenchd` | exit 0（BUILD OK） |
| `openspec validate workbench-identity-provider-contract-v1 --strict` | `Change 'workbench-identity-provider-contract-v1' is valid` |

### 测试覆盖点（负矩阵）

- URL policy：缺 URL→ErrNeedsContract；私网 http/userinfo/query/ftp→ErrNeedsContract；HTTPS origin 与 loopback（含空白 Trim + 尾斜杠归一）→接受。
- CheckReady：正路径；wrong contractVersion→ErrContractMismatch；unknown field→ErrContractMismatch；非 JSON Content-Type→ErrUnavailable；不可达→ErrUnavailable；超限体积（收紧 512B）→ErrContractMismatch；redirect→ErrUnavailable（SafeHTTPClient 恒拒 redirect）。
- Session：经 `Service.Session` 端到端（httptest 回显精确 principal 投影，`validateSession` 全量校验通过）。
- ListTenants：正路径；wrong version/unknown field/invalid tenant/duplicate tenants/invalid page token/trailing JSON→ErrContractMismatch；503→ErrUnavailable；>256 条→ErrContractMismatch。
- ListMembers：正路径；cross-tenant member→ErrContractMismatch；403→ErrPermissionDenied；401→ErrAuthenticationRequired。
- AllowedActions：经 `Service.AllowedActions` 端到端；响应 tenantRef 漂移→ErrContractMismatch。

## 未做与原因

- **identity-platform 侧端点（slice 2）**：cross-repo owner 职责；任务书明确禁止触碰 `backend-server/**`（该仓有 34 个未提交在制品文件）。合同已在 design.md 冻结，可作为其 owner change 的输入。
- **8.2 勾选 / `daily-ops-integration:real-stack:scenario` 转绿（slice 3）**：gated on slice 2；且 8.2 的 tasks.md 归 r3-gates change owner，本代理无权勾选他人 checkbox。
- **Taskfile / docs/operations / evidence runner**：文件租约禁止；接线后 operator 只需在 managed 环境注入 `WORKBENCH_IDENTITY_PROVIDER_URL` 即可启用（default-off 不变）。
- **未新增 gRPC/JSON-RPC provider 面**：Provider 是 server→identity 出站调用而非 four-transport operation 面，不触发 parity；见 design Non-Goals。
- **不 git commit**：按任务书要求留待主代理审阅。

## 已知边界与注意事项

- `validateProviderURL` 的 host 先入 ownersec allow-list 再强制 scheme：语义对齐 ownersec「默认 loopback，非 loopback 必须显式允许」，此处显式允许仅升级到 HTTPS（HTTPS 时 policy 的 loopback 硬门放行——安全上等价：HTTPS origin 不受私网 http 明文面影响）。若 ownersec 未来提供 first-class loopback-or-HTTPS policy，建议收敛实现。
- 线上合同为 `workbench.identity.provider.v1alpha1`（transport 绑定，请求头）+ `workbench.identity.v0.1`（domain 载荷，响应 contractVersion）双版本；不要混用。
- provider 请求不携带 Authorization 头、不转发 raw bearer token（design D4）；principal 只含 opaque refs。
- 并行在途：本切片验证期间 `service/internal/runtime/` 全量测试通过，未观察到相邻包编译失败；若后续有在途编辑冲突，以本报告验证命令复跑为准。

## 给主代理的勾选建议

- tasks.md 1.1-1.5 **可勾选**：勾选判据即上表验证命令（全部实跑通过）。建议勾选时按仓库惯例附 evidence 日期（2026-08-28）与命令结果摘要。
- slice 2 / slice 3 任务（2.1、2.2、3.1）**保持未勾**：2.1 需 identity-platform owner 开独立 change（注意该仓在制品协调）；3.1 gated on 2.2。
- 对 r3-gates 8.2：本切片解除了消费端结构性阻塞的一半（provider 合同消费端就绪）；8.2 仍需 slice 2 真实端点后才可转绿，不要因本切片单独勾选。
