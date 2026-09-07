# Release Manifest CLI Skeleton 基线

## 1. 结论

R5 `3.1` 的 release manifest schema 与 CLI skeleton 已完成。`workbench-release` 现在提供：

```bash
workbench-release manifest generate ...
workbench-release manifest inspect --manifest <path>
workbench-release manifest validate ...
```

`generate` 只创建 CLI-authored manifest，`inspect` 只读取并投影资产中已记录的状态，`validate` 才会重新绑定 requirement、handoff、artifact、OpenSpec、restore、review 与 SLO authority source。三个入口都不执行部署或 promotion。

## 2. Schema 与状态

当前 loader 显式支持：

- `workbench.release_manifest.v2`；
- `workbench.release_manifest.v3alpha1` 至 `v3alpha5`。

各版本按 authority 扩展独立校验，禁止混用 global OpenSpec 与 capability-scoped OpenSpec authority。Manifest 状态只有 `blocked|candidate`；缺失、过期、篡改、环境不匹配、输入 digest 漂移或 evidence 强度不足均 fail closed。

结构化资产由 CLI 以私有权限生成，拒绝覆盖；revision、source digest、artifact tree digest、requirement/handoff count、authority digest 与 blocker ID 可重验。stdout/stderr 不复制原始日志、credential、provider payload 或本地私有路径。

## 3. Inspect 安全边界

`manifest inspect` 是 additive 只读入口：

- 不重新验证外部 source；
- 不把 recorded `candidate` 转换为 production approval；
- 始终输出 `production_authorized=false`；
- 推荐下一步为 `task release:manifest:validate ENV=<manifest-environment>`；
- 无效或缺失资产返回 domain exit `2` 和 `manifest_invalid`，不回显路径。

因此 inspect 可用于诊断和自动化读取，但不能替代 validate、review、SLO、promotion、deployment receipt 或 Go/No-Go。

## 4. 验证

```bash
CGO_ENABLED=0 go test ./service/cmd/workbench-release/... -count=1
task release:gates:test
task release:manifest:inspect RELEASE_MANIFEST=<path>
openspec validate workbench-production-ga-r5 --strict
```

最新 component evidence：

- `temp/integration-test-runs/20260729073313-a53a03eb-0450-414d-a5b7-afedec3c059a/summary.json`

结果：release CLI Go tests、release state/gates tests 与 evidence runner tests 全部通过；redaction gate 通过。

## 5. 兼容与回滚

`manifest inspect` 是向后兼容的 additive command，不改变已有 manifest JSON shape、generate/validate 语义或 exit code。回滚时可移除 inspect 分发、Taskfile target 与测试；现有 v2/v3alpha manifest 仍可继续由 validate 读取。任何回滚都不得让 inspect 或旧 manifest 绕过 source revalidation 与 production approval。

## 6. 未完成边界

本项只完成 schema/CLI skeleton。当前 requirement、handoff、approved builder、deployment、review/SLO 与外部 provider authority 仍存在 blocker；manifest 能生成 blocked 诊断资产不代表 production candidate 或 deployment ready。
