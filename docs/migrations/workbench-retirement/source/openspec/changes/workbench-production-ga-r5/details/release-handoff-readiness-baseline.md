# Release State、Handoff 与 Readiness T3-a/T3-b2a 基线

## 1. 已实现范围

当前已实现纯 Go `workbench-release` 本地 release-state 工具链：

```bash
task release:requirements:init ENV=integration REQUIREMENT_INDEX=temp/release/requirements.json
task release:handoff:init ENV=integration HANDOFF_REGISTRY=temp/release/handoff.json
task release:handoff:validate ENV=integration HANDOFF_REGISTRY=temp/release/handoff.json
task release:readiness ENV=integration HANDOFF_REGISTRY=temp/release/handoff.json
```

Requirement 和 handoff 事实通过 revision compare-and-swap 逐条推进：

```bash
task release:requirements:record \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements.json \
  EXPECTED_REVISION=1 \
  REQUIREMENT_ID=$(jq -r '.requirements[0].id' temp/release/requirements.json) \
  OWNER_REF=owner:release \
  'TEST_COMMAND=task release:gates:test' \
  EVIDENCE_REF=evidence:component:20260721032026-69ea4ad9-8470-441b-ac64-539cd9d917de \
  ROLLBACK_REF=rollback:disable-release
task release:requirements:verify-evidence \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements.json \
  EXPECTED_REVISION=2 \
  REQUIREMENT_ID=$(jq -r '.requirements[0].id' temp/release/requirements.json) \
  EVIDENCE_ROOT=temp/integration-test-runs \
  MAX_EVIDENCE_AGE=24h
task release:sources:validate \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements.json \
  EVIDENCE_ROOT=temp/integration-test-runs \
  MAX_EVIDENCE_AGE=24h
task release:handoff:record \
  ENV=integration \
  HANDOFF_REGISTRY=temp/release/handoff.json \
  EXPECTED_REVISION=1 \
  PACKAGE_ID=INT-R0-01 \
  GATE=provider_ready \
  OWNER_REF=owner:foundation \
  EVIDENCE_REF=evidence:contract:20260721024540 \
  DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
```

Manifest 绑定当前 requirement index、handoff registry 和 immutable artifact digest：

```bash
task release:manifest:generate \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements.json \
  HANDOFF_REGISTRY=temp/release/handoff.json \
  RELEASE_MANIFEST=temp/release/manifest.json \
  EVIDENCE_ROOT=temp/integration-test-runs \
  MAX_EVIDENCE_AGE=24h \
  ARTIFACT_DIGEST=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb
task release:manifest:validate \
  ENV=integration \
  REQUIREMENT_INDEX=temp/release/requirements.json \
  HANDOFF_REGISTRY=temp/release/handoff.json \
  RELEASE_MANIFEST=temp/release/manifest.json \
  EVIDENCE_ROOT=temp/integration-test-runs \
  MAX_EVIDENCE_AGE=24h
```

Taskfile 仅传递参数和退出状态；JSON structured assets 均由 CLI 创建或原子更新。命令不会执行 index 内存储的 `test_command`，也不会创建 deployment、promotion、approval、secret、tenant、Owner mutation 或外部状态。

## 2. Requirement Index 合同

`workbench.release_requirements.v2` 从 canonical R0-R5 OpenSpec 中的 `### Requirement:` 标题生成稳定 requirement ID 和 source digest。每条 requirement 保存：

- owning change 与 spec path；
- requirement title 和 `missing|recorded|verified` 状态；
- opaque owner/evidence/rollback ref；
- 用户可直接运行的 test command；
- index revision、environment 和 source digest。

`requirements init` 使用新文件语义，拒绝覆盖已有 index；`requirements record` 只把完整metadata推进为 `recorded`，不会授予生产证据结论。`requirements verify-evidence` 要求 expected revision 匹配，并解析显式 `evidence:<layer>:<run-id>`；只有project、layer、environment、实际argv、passed exit、redaction policy、finished timestamp、max-age和完整bundle digest全部匹配时才推进为 `verified`。

`sources validate` 会重新扫描index中所有owning change的`### Requirement:`来源，并重新读取同一evidence run；OpenSpec标题、路径、数量或stable ID发生漂移，或receipt存在symlink/root escape、超限bundle、stale/future timestamp和任何文件tamper时均拒绝。命令不会执行index中的test command；实际argv来自runner receipt并与规范化命令逐token比较。

T3-b1 的 v1 index 将 `record` 误表示为 `verified`，因此不做原地兼容升级；当前没有已发布production state。升级后必须重新运行 `task release:requirements:init ...` 生成v2 index，再逐条record与verify-evidence。CLI会拒绝旧v1资产，避免旧结论静默继承。

## 3. Handoff Registry 合同

当前只接受 `workbench.release_handoff.v1`，要求 registry environment 与命令 environment 一致，并固定六个 canonical packages：

- `INT-R0-01`
- `INT-R1-01`
- `INT-R2-01`
- `INT-R3-01`
- `INT-R4-01`
- `INT-R5-01`

每个 package 验证 `provider_ready`、`consumer_done`、`integration_passed`、`rollback_passed` 四个独立 gate。每个已完成 gate 必须同时存在 `owner_ref`、`evidence_ref` 和 SHA-256 digest；只有布尔值没有证据时 registry 无效。package 缺失、ID 重复、schema/environment 不匹配或文件不可读时都不会返回 Ready。

`handoff init` 生成 revision 1 的全 blocked registry；`handoff record` 以 expected revision 原子记录一个 gate。当前 owner/evidence 是 opaque refs，尚未接入 provider/consumer authority adapter，因此它们不能替代后续真实双签、environment verification 或 capability/version 验证。

## 4. Manifest 与漂移检测

`workbench.release_manifest.v2` 保存：

- immutable artifact tree digest；
- reproducibility report digest、run ID、clean source digest/commit和artifact count；
- requirement index file digest、source digest、revision、总数和 verified 数；
- handoff registry file digest、revision、总数和 ready 数；
- `blocked|candidate` 状态与 blocker IDs。

`manifest generate` 要求显式OpenSpec changes root、evidence root、reproducibility report和artifact digest。它先重扫OpenSpec requirement source，再重验每个verified evidence bundle，并解析`workbench.reproducibility.v2`报告：source必须clean/pinned，Go/Bun toolchain和三类lock digest完整，deterministic parameters固定，双构建artifact/tree完全一致，required set完整，且请求digest必须等于report tree digest。v2 新增 vendor block：本地 source-closed 不等于上游 authority；manifest/source-tree digest、source_closed、upstream authority、license status 与 authority receipt digest 必须完整且由获批 authority 绑定。历史 v1 只记录本地 source/reproducibility，不再是可接受的 release authority。无restore输入时继续生成严格原始shape的v2；传入restore receipt与integration evidence ref时生成`workbench.release_manifest.v3alpha1`，绑定receipt/evidence digest、profile/format/schema、backup manifest/artifact digest、verified timestamp和duration。两者必须来自同一bundle并匹配environment/freshness/RTO。证据不完整时仍会写出 blocked manifest并返回domain exit `5`；vendor authority 未获批返回`artifact_vendor_authority_missing`，OpenSpec/evidence stale或tamper返回`release_sources_invalid`，artifact report无效返回`artifact_source_invalid`，restore authority无效返回`restore_source_invalid`。Requirement index或handoff输入被追加、替换、降级或与environment不一致时返回`manifest_input_drift`，不会把旧manifest继续当作candidate。

Manifest v1不做静默兼容；当前没有已发布production manifest。升级后必须使用显式artifact report重新生成v2 manifest。v2保持无restore的兼容诊断shape；`v3alpha1`是新增预发布shape，不替代稳定v3，也不能绕过后续review/SLO/provider authority。

生成文件父目录权限为 `0700`，文件权限为 `0600`；新资产拒绝覆盖，revision 更新使用同目录临时文件加 rename。stdout/stderr 不回显本地私有路径、credential、endpoint 或 provider payload。

## 5. 输出与退出语义

`workbench-release` 从同一 projection 渲染默认 English summary、`--json`、`--agent` 和 `--explain`。稳定 domain exit code 为：

| Code | 含义 |
| --- | --- |
| `0` | 当前命令成功，或 manifest 为 candidate |
| `2` | 输入、schema、revision、environment、digest 或资产漂移无效 |
| `5` | 结构有效，但 requirement/handoff 不完整，release 保持 No-Go |

`go-task` 会把子命令失败映射为自己的非零状态；需要精确 domain exit code 的自动化应直接调用 `./dist/workbench-release ... --json`。

## 6. 验证证据

```bash
task release:gates:test
task test:release-gates:component
```

当前证据：

```text
temp/integration-test-runs/20260721041316-09186673-8f04-4fe1-a7d2-94b351044c8c/
```

该 component run 为 `passed`、exit code `0`、`environment=integration`，包含 `summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`；目录为 `0700`、文件为 `0600`，敏感字符串扫描无命中。

## 7. 未完成边界

本基线及后续增量已完成Workbench消费侧的OpenSpec requirement/task/status、integration/component/system/e2e receipt、artifact reproducibility、restore、review与SLO authority validators；以下外部权威事实或Provider交付仍未实现，R5 readiness继续保持No-Go：

1. approved artifact registry/provenance、真实独立review approval、managed PostgreSQL DR/RPO/PITR、连续窗口SLO/error budget、risk与deployment approval事实；
2. provider/consumer 独立身份验证、真实双签和 capability/version/flag/kill-switch matrix；
3. Identity/Eikona/PostgreSQL/deployment platform receipt authority adapters；
4. 真实promotion apply、pause/abort、rollback与deployment receipt authority；
5. soak/canary/error-budget report；
6. audit、decision、真实 deployment receipt 和 post-deploy；
7. Identity、Eikona、managed PostgreSQL、deployment platform、on-call 与 privacy lifecycle 的真实权威证据。

因此新生成的 registry 和 requirement index 默认都处于 blocked/missing；这代表正确的生产门禁状态，不是测试环境错误，也不得通过手改 JSON、复用旧 digest 或 consumer 代签 provider 绕过。
