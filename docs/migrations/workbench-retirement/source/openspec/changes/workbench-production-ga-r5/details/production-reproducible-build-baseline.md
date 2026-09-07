# Production T1b 可复现构建基线

## 1. 已实现范围

R5 `3.4b2a` 已实现当前WorkBench制品集合的确定性构建与双构建比较：

- `scripts/production-build.ts build`：先在同父目录的唯一 staged 输出中生成完整 tree（包含 metadata），canonicalize 后再 recoverably publish 到`dist/release/`；发布前会原子落盘私有、canonical JSON 的 transaction-id receipt，且每次 promote/restore 都重算并核对闭合 tree digest。已有输出只会改名为唯一`.superseded-*`保留，不会被自动删除；下一次调用会先依据 receipt 恢复中断的 rename，不能静默覆盖证据。失败 staged 输出保留带`failed` receipt 的审计材料，需显式清理授权后才可删除。
- `scripts/production-build.ts verify`：在两个隔离输出目录构建、计算逐文件SHA-256和tree digest、生成`report.json`。
- `task build`：构建当前制品并显示候选阻塞。
- `task build:reproducibility`：通过evidence runner执行双构建。
- `--json/--agent/--events/--explain`：来自同一projection，已通过AI-native validator。

## 2. 当前制品集合

已构建：

```text
bin/workbenchd
bin/workbench-migrate
bin/workbench-backup
bin/workbench-restore-verify
bin/workbench-config-check
web/**
build-metadata.json
```

生产required set仍缺`bin/workbench-worker`。该binary属于R4 durable workflow实现；T1b不得在R5创建空worker或用workbenchd副本替代。

## 3. 确定性控制

- Go：`CGO_ENABLED=0`、`-trimpath`、`-buildvcs=false`、empty build id。
- Build环境：`SOURCE_DATE_EPOCH=0`、`TZ=UTC`、`LC_ALL/LANG=C`、`NO_COLOR=1`、`NODE_ENV=production`。
- Child环境只继承工具/缓存必要变量，不传入Workbench credential、endpoint或普通开发环境变量。
- Source digest基于显式build input集合和相对路径，不读取`dist/temp/node_modules/coverage`或旧binary。
- Metadata记录commit、dirty、source digest、file count、Go/Bun版本、lock digests、build参数和missing artifact；不记录时间、workspace/home/private path。
- Tree digest绑定闭合的相对文件清单（path、mode、size、content SHA-256）和目录清单（包含root、path、canonical mode）；mtime和创建顺序不影响结果。文件count仍只计算文件，目录为独立闭合清单。

## 4. 当前证据

最终component run：`temp/integration-test-runs/20260720162037-3f813171-0a9b-4932-87fe-7d2eaaa00ef6/`。

Reproducibility report：`temp/reproducibility/20260720162037-d4e5f95f-8e22-4675-9e00-e39f5c92a34b/report.json`。

结果：

```text
match=true
mismatch_count=0
artifact_file_count=13
source_digest=0ae13a58ad093567beb507d3951f334d8a59351eeba14dd0b3f326a52c3906fe
first_tree_digest=2d079e8183f5c8be8a82da88495155f505f078418a93e71feffe04e4d1321a58
second_tree_digest=2d079e8183f5c8be8a82da88495155f505f078418a93e71feffe04e4d1321a58
missing_required=bin/workbench-worker
source_dirty=true
```

Evidence/report secret和private path扫描通过。

## 5. 状态语义

当前命令返回`Partial`和exit 0：这只表示“现有制品可复现检查完成”，同时`production_candidate_complete=false`。两个独立阻塞为：

1. `missing:bin/workbench-worker`；
2. `source:dirty`。

`workbench-release artifact validate`与manifest v2 resolver已经把该报告接入release authority：同时要求clean/pinned source、完整required artifact set、固定deterministic参数、完整toolchain/lock metadata、双构建tree一致和requested artifact digest binding。当前历史report会因`source_dirty=true`与缺`bin/workbench-worker`被明确拒绝；不得把`match=true`单独解释为release ready。

## 6. 未完成边界

R5 `3.4b2b`仍需：

- R4完成 `4.3a-4.3c`、`5.0a-5.2b`、`6.1a-7.4`，再由 `9.2b` 交付真实`workbench-worker` binary、worker/version/contract/step/schema compatibility metadata与fault evidence，并通过 `10.5` closeout。
- 在clean commit/submodule refs上重跑构建。
- 在approved/isolated builder或CI中验证同source/toolchain digest，而非只在当前机器复现。
- 冻结Web/API/worker/migration/config-check artifact naming、version和release inclusion policy。
- 将最终artifact digest接入SBOM/provenance/signature和release manifest。

R5不得通过空`main`、sleep loop、`workbenchd`副本、永久claim-disabled配置或只有health endpoint的binary满足上述依赖；worker必须符合R4 `details/workbench-worker-production-process-contract.md`并携带lease/fencing/drain/unknown reconcile证据。

因此R5 `1.1`完整reproducible build与后续container/supply-chain gate仍未完成。
