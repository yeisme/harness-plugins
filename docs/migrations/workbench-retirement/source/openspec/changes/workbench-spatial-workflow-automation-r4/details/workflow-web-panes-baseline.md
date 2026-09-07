# Workflow Web Pane 基线

## 结论

R4 Workflow Web Lane 已完成 Definition、Run/Rescue 与 Operations 三个业务 Pane，并接入 Workbench 路由、统一 Pane 展示状态机和 same-origin 安全预览。当前实现以服务端 Workflow 合同为唯一事实来源，不在浏览器维护第二套 step allowlist、运行状态机、terminal 结果或运维连接状态。

## 已交付范围

- `/workflows/:tenantRef/:workspaceRef` 提供 Definition、Run & rescue、Operations 三个具备 `tablist/tab/tabpanel` 语义的 Pane。
- Definition Pane 只读取 canonical step registry，支持 typed step、typed input binding、directed edge、schema ref、cost/authority metadata、服务端校验、versioned save 与 publish；不提供 script、URL 或 raw payload 编辑器。
- Run Pane 展示 authoritative run/step/event、lease/gate/receipt/evidence safe ref，并支持 pause、resume、cancel、reconcile；mutation pending 时禁止重复命令，inactive Pane 停止订阅，恢复时从 durable sequence 继续且去重。
- Operations Pane 默认只读；没有公开 diagnostics contract 时 fail closed。注入快照时仅显示 bounded diagnostics，强操作同时要求 allowed action、fresh snapshot、re-authentication、audit ref 和精确 `CONFIRM`，并禁止 double submit。
- PanePresentationFrame 支持 expanded、browser fullscreen、ESC restore、focus restore 与 reduced-motion；Workflow safe preview 只接受 `/v1alpha1/workflows/previews/` 下的 same-origin 无 query/fragment/traversal 引用，并使用 sandboxed iframe。
- Identity return-path allowlist 已包含 bounded Workflow 路由，外部 URL、query、fragment 与路径穿越仍被拒绝。

## 验证证据

- Component：`temp/integration-test-runs/20260729055125-db14fdfc-7218-419e-a1bc-004090f8f6e8/summary.json`
  - 6 个测试文件、27 个测试通过。
  - 包含 Definition typed wiring、needs_contract、fresh validation/publish、Run rescue/stream gap/durable cursor/double-submit、Operations permission/re-auth/audit/stale snapshot/double-submit、fullscreen focus restore 与 safe preview 边界。
  - `bun run typecheck` 通过，evidence redaction 通过。
- Browser E2E：`temp/integration-test-runs/20260729054911-7f40177b-9322-404f-98ed-88a23a1a8d0c/summary.json`
  - 5/5 Chromium 场景通过：workflow publish、workflow run/reconcile、workflow operations fail-closed、pane fullscreen、workflow file preview/pane restore。
  - 包含 reduced-motion、critical Axe、截图与无 terminal fabrication 检查，evidence redaction 通过。

## 生产边界

- R4 8.4 已与 Spatial Board 基线联合关闭；Board/Definition/Run/Operations 已统一验证 expanded/fullscreen/ESC/focus/reduced-motion、safe preview 与 subscription continuity。Board 证据见 `details/spatial-board-web-baseline.md`。
- Operations 当前没有公开 Workflow diagnostics/intervention BFF 合同。路由必须保持 fail closed；组件注入接口不是后端连通性或 production readiness 证据。
- 浏览器 E2E 使用同源 HTTP fixture 验证消费者合同，不替代真实 PostgreSQL、worker、Owner 或 production canary 证据。
