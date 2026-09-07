# R0-R4 Requirement / Evidence Owner Map 基线

## 结论

R5 `0.1` 已建立由 `workbench-release` CLI 生成的 requirement/evidence owner map。当前索引覆盖 R0-R5 六个 canonical OpenSpec change 的 106 条 requirement，并为每条 requirement 生成 owner、code capability ref、验证命令、environment、rollback ref、capability state 与 evidence strength。索引不把 OpenSpec artifact complete、fixture 或缺失证据推断为完成；当前 106 条全部保持 `state=missing`、`capability_state=missing`、`evidence_strength=missing`。

## CLI 合同

- `workbench.release_requirements.v2` 以向后兼容方式新增可选字段：`code_ref`、`capability_ref`、`capability_state`、`evidence_strength`。
- 旧 v2 索引仍可读取；新增字段只扩展诊断信息，不改变 `missing → recorded → verified` evidence authority 状态机。
- `requirements init` 从 canonical OpenSpec specs 生成确定性 requirement ID 与 source digest，同时按 change/capability namespace 生成安全 opaque refs。
- `missing` requirement 可以携带 owner/code/test/rollback 映射，但不能携带 `evidence_ref` 或 verified authority。这样可以区分“已建立责任映射”和“已有直接证据”。
- 所有 refs 继续通过 opaque-ref、安全命令和 forbidden token/secret 校验；不允许 URL、私有路径、shell 语法或 credential 字段进入资产。

## 当前诊断资产

```text
temp/release/requirements-mapped.json
temp/release/evidence-audit-mapped.json
```

- requirements：106 条，mapping 缺失 0 条。
- owner namespaces：foundation、identity、owner integrations、daily operations、spatial workflow、release。
- evidence audit：106/106 blocked，`production_authorized=false`。
- 该诊断资产位于 `temp/`，只能通过 CLI 重建，不作为 tracked production state。

## 验证证据

- Component：`temp/integration-test-runs/20260729065358-6736073a-45a0-4764-98cd-13f25fbf8107/summary.json`
  - `service/cmd/workbench-release` 全包测试通过。
  - R0、R1、R2、R3、R4、R5 六个 OpenSpec change strict validation 全部通过。
  - evidence runner 六件套与 redaction gate 通过。
- `requirements init` 对同一 OpenSpec source 生成稳定 source digest，并拒绝 unsafe mapping metadata。
- `release:audit:generate` 按预期以 exit 5 和 `release_evidence_audit_blocked` fail closed，同时保存 106 条 blocked requirement 的诊断报告。

## 兼容与回滚

- 变更类型：稳定 JSON/CLI structured asset 的 additive optional-field 扩展，不删除、不重命名、不改变已有字段类型。
- OpenSpec owner：`workbench-production-ga-r5`，对应任务 `0.1`。
- 迁移窗口：无需强制迁移；旧 v2 文件与旧调用方继续有效，新索引重建后才出现扩展字段。
- 回滚：停止由 `requirements init` 填充新增映射字段即可；现有 evidence record/verify 与 release consumers 不需要回退或重写。

## 后续边界

- `0.1` 关闭只表示完整 requirement 责任图已经建立，不表示任何 requirement verified 或 capability ready。
- `0.2` 必须从 CLI-authored map、真实 flags/digests 与 readiness evidence 生成 GA candidate matrix；不得把当前 `missing` 映射提升为 available。
- 每条 requirement 的真实 `evidence_ref`、直接测试 environment 和 verified authority 仍需由对应 R0-R4 owner 通过 `requirements record` 与 `requirements verify-evidence` 逐项推进。
