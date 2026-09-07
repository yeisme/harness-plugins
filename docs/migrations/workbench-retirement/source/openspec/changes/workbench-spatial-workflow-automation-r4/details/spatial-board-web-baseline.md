# Spatial Board Web 基线

## 结论

R4 Spatial Board Web Experience 已完成 Board 路由、canonical registry 校验、viewport/LOD 渲染、typed mutation、冲突恢复、模板与分组操作，以及键盘、触屏、移动端和无障碍基线。浏览器只维护可撤销的本地预览与交互状态；Board revision、mutation receipt、inverse、event cursor 和 target projection 继续由服务端合同负责。

## 已交付范围

- `/boards/:tenantRef/:workspaceRef/:boardRef` 使用统一 `PanePresentationFrame` 承载 Spatial Board，并纳入 bounded auth return-path allowlist。
- 画布使用 `@xyflow/react`，只查询 settled viewport，按 zoom 计算 far/medium/near LOD，并带 20% overscan；启用 visible-element rendering、pan/zoom、节点选择、连接、分组、类型过滤、详情跳转和事件 gap 救援。
- palette、node type、relation compatibility 和 availability 全部消费 CLI 生成的 canonical registry 与服务端 capability snapshot；digest 不一致时 fail closed，不在前端维护第二套 allowlist。
- geometry mutation 先显示明确的 pending preview，再以 expected board revision 提交；只有 receipt 返回后才进入 undo/redo 历史。版本冲突保留意图并支持 reapply/discard，离线或权限拒绝会回滚预览且不伪造 persisted success。
- template apply 使用 published template/version 与 typed placeholder values；group create 后按服务端 receipt revision 顺序移动成员，部分失败时刷新 authoritative state。
- 可见节点同时提供屏幕阅读器可识别的操作列表；支持键盘移动、键盘选择/连接/分组、触屏选择、44px 移动端操作目标、React Flow zoom、reduced-motion、live region、Axe serious/critical gate。
- Board expanded/fullscreen/ESC/focus restore 不会重新挂载业务 Pane；浏览器测试验证一次 event subscription 在 Pane 恢复过程中保持连续。

## Asset 编排与 Scaena 交接 slice

- Asset Library 与 Board 的共享拖放格式仅为 `{assetRef, sourceVersion}`；Board 从 payload 重新授权安全投影后，才会使用既有 `CreateNode` 以当前 revision 与新 idempotency key 创建 asset node。receipt 前不显示本地 persisted node，错误、冲突或 scope/version/rights/status 失败均不留下 ghost node。
- Board 额外提供 asset picker、缩放/适配/选择工具栏、右键菜单、`Shift+F10`/`Escape` 焦点路径和可访问的节点操作列表；它们继续只编排 Workbench typed refs。
- 选中 asset 的右侧 Inspector 只显示安全 ref 与状态。Scaena 打开动作需要匹配的 Owner descriptor 和注入式 host bridge；这两个条件任一缺失时明确显示 `needs_contract`，不会构造 URL 或启动生成。
- 当前 R3 Asset HTTP/owner integration 未在本 change 中提升为可用合同；真实 route 因此必须保持 capability-gated `needs_contract`，而组件级 injected client 覆盖已提升消费者的 receipt、拒绝和 handoff 行为。该边界不是对未接线 Asset transport 的隐式 fallback。

## 验证证据

- Component：`temp/integration-test-runs/20260729062826-51ea981b-b38a-4ccd-b802-c7d14e4b23a4/summary.json`
  - 5 个聚焦测试文件与 typecheck 通过。
  - Board 覆盖 viewport/LOD/overscan、registry mismatch、capability palette、filter、event gap、template apply、keyboard geometry、version conflict、receipt-backed undo/redo、sequential group revision、offline/permission rollback。
  - Identity、Pane presentation 与 Workflow integration 回归通过，evidence redaction 通过。
- Browser E2E：`temp/integration-test-runs/20260729063116-f9ca08c9-585a-44d1-961e-366602984e63/summary.json`
  - 4/4 Chromium 场景通过：conflict/undo/redo、keyboard selection/canonical connection/zoom/Axe、touch/mobile/reduced-motion、Pane restore/focus/subscription continuity。
  - 移动端截图：`temp/integration-test-runs/20260729063116-f9ca08c9-585a-44d1-961e-366602984e63/artifacts/spatial-board-mobile.png`。
  - evidence redaction 通过。

## 生产边界

- 本基线证明 Web 消费者合同与恢复语义，不替代未完成的真实 PostgreSQL viewport/performance、target projection production promotion、四 transport event/resolver component gate 或 production canary。
- Board palette 中 `needs_contract` 类型保持禁用；未绑定或未提升的后端能力不能因 Web UI 存在而宣称 ready。
- 浏览器事件和 mutation fixture 只验证严格 HTTP 消费合同，不是 Owner、数据库、outbox 或跨进程重启证据。
