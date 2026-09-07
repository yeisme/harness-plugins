# 05 · Text Development control inventory（task 8.1a）

冻结时点：2026-09-05。范围：`apps/web/src/workbench/agent/text-development/**`。

## 准入结果

| Control | Primitive / composite | Surface | Disabled reason |
| --- | --- | --- | --- |
| posture switch | `SegmentedControl` | studio | none |
| deck tabs | `Tabs` | studio | none |
| selection actions | `Button` + `disabledReason` | selection-action-bar | stale-anchor |
| inline patch decide | `Button` | inline-patch-review | stale / decided / busy / unknown |
| candidate view tabs | `Tabs` | document-candidate-compare | none |
| change-set decide | `Button` | atomic-change-set-review | conflict / unknown / applied |
| working-set remove/refresh | `Button` | text-context-rail | none |
| team template | `RadioGroup` | team-template-picker | invalid-override |
| team override fields | `Input` | team-template-picker | contract-invalid |
| team plan simulate/approve | `Button` | team-plan-surface | status / unknown |
| team sim recover | `Button` | team-simulation-view | none |
| team canary start | `Button` | team-canary-gate | blocked-readiness |
| timeline keyboard move | typed intent | timeline-intent | invalid-fields |
| editor commands | CodeMirror commands | text-editor | readOnly |
| save feedback | live region / quiet badge | save-feedback | none |
| version ledger reconcile | `Button` | version-ledger | not-unknown |

## 清理

- 手写 `role="tablist"`：studio deck 与 candidate compare 已迁到 `Tabs` primitive。
- Context rail「移除」已从裸 `<button>` 迁到 `Button`。
- 选区动作 `disabled` 现绑定 `disabledReason`。
- 扫描锁定：零直接 `@radix-ui/*` / `lucide-react`、零原生 `<select>`、零私有 focus trap。

机器真值：`control-inventory.ts` + `text-development-control-inventory.test.ts`。
