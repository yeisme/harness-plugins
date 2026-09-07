# Release Authority Source Adapters 基线

## 1. 结论

R5 `3.2` 已将 manifest 所需的本地消费侧 authority adapters 接入 `workbench-release`。实现负责验证来源，不负责伪造 Provider、批准、观测或部署事实。

| Source | 已实现消费合同 | Fail-closed 条件 |
| --- | --- | --- |
| Artifact | reproducibility report、exact artifact tree digest、source/toolchain/lock metadata | dirty、missing artifact、tree/source/digest drift |
| Requirement evidence | evidence runner summary、command、environment、layer、freshness、bundle digest、redaction | missing/weak/stale/future/tamper/wrong command/environment |
| OpenSpec global | official status/validate output、artifact digest、tool version、freshness | incomplete、invalid、stale、source drift |
| OpenSpec capability | explicit selector、official task ID/description/done、selector/source/artifact digest | unselected substitution、task drift、stale/tamper |
| Restore | signed/generated receipt与integration evidence bundle、profile/schema/artifact/RTO/freshness | wrong environment/artifact、stale、RTO超限、bundle tamper |
| Review | review decision、external signed approval receipt、trust bundle、manifest digest、finding状态 | unsigned、wrong role/scope/digest、expired/revoked/tamper |
| SLO | provider report、managed policy digest、system evidence、signed observation receipt/trust bundle | wrong capability/artifact/window/query/source、coverage不足、expired/revoked/tamper |
| Handoff | Provider Ready、Consumer Done、Integration、Rollback 四独立gate与evidence digest | boolean-only、缺owner/evidence、revision冲突、package drift |

这些 adapters 允许 manifest 生成可追溯的 `blocked|candidate` 资产。缺任一强 authority 时返回稳定 domain blocker，不能把 partial source 解释为 candidate。

## 2. Freshness、digest 与 redaction

每个外部或 evidence source 都必须绑定 environment、artifact/capability/source digest 与 bounded freshness。Evidence runner 的 `summary.json`、`command.txt`、stdout/stderr、env、artifacts 与 digest/redaction receipt 作为一个整体重验；修改任一文件都会失效。

CLI 输出只包含稳定 code、count、digest、opaque ref 与安全状态，不复制 raw logs、provider payload、token、cookie、DSN、私钥、Authorization header 或本地绝对路径。

## 3. 验证

```bash
task release:gates:test
CGO_ENABLED=0 go test ./service/cmd/workbench-release/... -count=1
openspec validate workbench-production-ga-r5 --strict
```

最新 component evidence：

- `temp/integration-test-runs/20260729073313-a53a03eb-0450-414d-a5b7-afedec3c059a/summary.json`

测试覆盖 valid、missing、stale、future、wrong environment/artifact/capability、digest drift、tamper、redaction、unsigned/revoked receipt 与 partial authority。

## 4. 外部未完成边界

Adapter 完成不代表外部 authority 已存在。当前 approved builder/registry provenance、真实 Identity/Eikona provider handoff、managed PostgreSQL DR/PITR、observability provider连续窗口、独立 review approval、deployment receipt 与 production post-deploy authority 仍未交付，因此当前真实 manifest/readiness 必须保持 No-Go。

## 5. 兼容与回滚

各 source adapter 通过 v2/v3alpha expand-then-contract 方式接入；旧 v2 诊断 manifest 仍可读取，新增 authority 只在对应版本与显式参数存在时启用。回滚某个 alpha adapter 时必须回到较早诊断版本并保持 promotion blocked，不得丢弃 blocker 后沿用 candidate 状态。
