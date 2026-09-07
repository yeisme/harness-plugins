# Acceptance Matrix

## Golden path

角色：已登录的个人创作者/开发者。

前置：WorkBench v2 cohort enabled；Conversation Runtime/Runtime Plane/Workbench contract 兼容；Pi/OMP Profile ready；Canvas 有至少一个 authorized object。

1. 用户打开 `/agent`，确认 Session Profile、预算和 soft-follow。
2. 在 Canvas 选择对象；对象进入 Composer pending tray，draft 不变。
3. 用户确认“用于本次提问”；Context service 以 exact revision 创建 Context Pack。
4. 用户发送消息；Conversation Runtime 先生成 sealed `turnIntentRef`，TaskService 再接受 turn。
5. Timeline 流式显示真实 safe Blocks；Run detail 显示工具/Task/gate，不重复主线噪声。
6. 回答引用 Canvas refs；soft-follow 高亮并更新 Context rail，不移动焦点/相机。
7. 回答产生一个 server-authored change-set；Canvas preview + Review rail 可见。
8. 用户 Accept；Task/receipt/Board projection 确认后才显示 persisted。

## Test matrix

| Test ID | Scenario | Required assertion | Layer |
| --- | --- | --- | --- |
| `WB-CC-CONTRACT-001` | content/profile/grant model normalize | unknown/unsafe fail closed | SDK unit |
| `WB-CC-STREAM-001` | content + lifecycle merge/reconnect | separate cursors, no duplicate | BFF/component |
| `WB-CC-GRANT-001` | ordinary turn in grant | no per-turn permission blocker | service/integration |
| `WB-CC-GRANT-002` | budget/runtime/tool scope exceeded | approval required, no auto switch | service/integration |
| `WB-CC-LAYOUT-001` | v2 default wide layout | left Chat, center document, right Context | component/e2e |
| `WB-CC-LAYOUT-002` | legacy `?view=` | maps to preference, no second shell | component/e2e |
| `WB-CC-DOCK-001` | Canvas + Pane tab/split | one reducer, limits/focus restore | unit/component |
| `WB-CC-SELECT-001` | selection pending | draft/Context unchanged | component |
| `WB-CC-SELECT-002` | stale selection attach | blocked; no omit/upgrade | integration/e2e |
| `WB-CC-SOFT-001` | live safe intent | highlight/context only, no focus/camera/mutation | component/e2e |
| `WB-CC-SOFT-002` | dirty/review/modal/replay | suggestion only | component/e2e |
| `WB-CC-CONTENT-001` | Markdown/code/table/artifact | safe render, no HTML/script | component/security |
| `WB-CC-PARTIAL-001` | runtime known failure | Blocks retained, explicit new attempt | integration/e2e |
| `WB-CC-UNKNOWN-001` | unknown acceptance | reconcile-only | integration/e2e |
| `WB-CC-CHANGE-001` | atomic change-set accept | no persisted UI before receipt | integration/e2e |
| `WB-CC-CHANGE-002` | operation conflict | whole set unapplied | integration |
| `WB-CC-MOBILE-001` | 390px Canvas-linked session | Chat/list/Review; no Pixi/WebGL | e2e |
| `WB-CC-A11Y-001` | keyboard/200%/reduced motion | focus restore, no overflow, Axe 0 serious/critical | e2e |
| `WB-CC-SEC-001` | sensitive sentinels | 0 in Workbench DB/log/SSE/evidence/screenshots | security/system |
| `WB-CC-CREATIVE-001` | Creative Production vertical slice | complete golden path with owner refs | opt-in system |

## Validation commands

Focused implementation commands must be selected per task. Final candidate runs:

```bash
openspec validate workbench-agent-chat-canvas-convergence-v2 --strict --no-interactive
bun run typecheck
bun test
bun run test:contract
CGO_ENABLED=0 go test ./service/...
bun run web:test
bun run web:e2e
bun run test:integration
bun run check:i18n
```

Integration/component/system/e2e commands must run through `scripts/test-evidence/run.ts` or the existing package scripts that wrap it, preserving `temp/integration-test-runs/<run-id>/` with the original exit code and redaction scan.

