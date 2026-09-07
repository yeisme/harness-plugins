# Production T1a Config 与 Doctor 基线

## 1. 已实现范围

R5 `3.4b1` 已实现两个公开Taskfile目标：

- `task ops:doctor ENV=<environment>`：检查core tool、项目锁文件、container runtime与supply-chain工具状态。
- `task config:validate ENV=<environment>`：组合Web BFF与Go workbenchd managed config权威validator。

实现文件：

- `scripts/production-ops.ts`：统一doctor/config projection和summary/json/agent/explain renderer。
- `service/cmd/workbench-config-check/**`：调用`runtime.DefaultConfig().Validate()`的Go checker。
- `Taskfile.yml`：`build:config-check`、`ops:doctor`、`config:validate`、`production:ops:test`和component evidence目标。
- `tests/production-ops.test.ts`：doctor/config组合、redaction、local fallback、machine output与help测试。

## 2. 权威校验边界

| Surface | Authority | T1a行为 |
| --- | --- | --- |
| Web/BFF | `apps/web/server/config.ts::resolveBFFConfig` | 直接调用；不复制URL、Postgres、secret file、TTL和local/managed互斥规则 |
| workbenchd | `service/internal/runtime.Config.Validate` | Go checker直接调用；验证managed Postgres、Identity、local token禁用、client runtime和telemetry限制 |
| Task safety | `scripts/production-task-contract.ts` | `production:guard`要求显式ENV、read effect和dry-run |
| Tooling | `scripts/production-ops.ts::evaluateDoctor` | core缺失失败；container/supply-chain缺失返回partial，不伪造production ready |

Go checker和组合CLI只输出配置来源状态/布尔值，不输出DSN、issuer/endpoint值、secret path、token、cookie或private ref。BFF错误只提取稳定`WORKBENCH_*`字段名；Go runtime错误映射为稳定code，不透传可能包含值的原始错误。

## 3. 状态与退出语义

- doctor `success`：core、container和supply-chain prerequisites全部存在。
- doctor `partial`：core可用但可选的container/supply-chain工具缺失；exit 0仅表示doctor完成，`production_ready=false`。
- doctor `failed`：必需core工具或项目文件缺失；CLI exit 4。
- config `success`：BFF与workbenchd均为managed且结构校验通过；不代表依赖可达、credential有效或release ready。
- config `failed`：环境、BFF或runtime配置失败；CLI exit 2。
- `go-task`可能把子进程非零exit映射为自身非零code，但不会吞错；需要精确domain code时直接调用CLI machine mode。

## 4. 当前环境事实

2026-07-20本地doctor结果为`partial`：

- ready：Bun、Go、Task、OpenSpec、Taskfile/package/lock/go.sum、Syft。
- missing：Docker/Podman、Cosign、Trivy/Grype。

该结果证明T1a能诚实发现后续T1c/T1d阻塞，不是要求自动安装工具，也不允许将缺失项标记为通过。

## 5. 验证证据

聚焦命令：

```text
task production:ops:test
task ops:doctor ENV=integration
task config:validate ENV=integration
```

AI-native validator已验证：doctor JSON/agent、组合config JSON/agent、Go runtime JSON/agent及失败envelope。

- 最新component suite：`temp/integration-test-runs/20260720160748-56768834-096f-4391-9313-8d15e5b9c674/`。
- 真实BFF→Go组合config target：`temp/integration-test-runs/20260720160641-2339622f-18f0-462b-bf44-a2ef17b7962e/`。

两条证据均通过redaction扫描；未发现测试DSN、Identity host、public origin或secret mount path。

## 6. 未完成边界

T1a只验证配置结构和工具存在性，未验证：

- Identity/JWKS、PostgreSQL、Owner、audit或OTel真实连通/readiness。
- secret file存在、权限、内容、expiry或secret-manager authority；这些由managed runtime startup/security integration验证。
- reproducible artifact、container image、SBOM/provenance/signature、advisory和artifact secret scan。
- deploy profile、resource/network policy、release manifest与production approval。

上述能力分别属于R5 `2.x`、`3.4b2b-3.4b5`、`3.4c-3.4d`；T1b-a当前制品可复现基线也不能替代这些production gate。
