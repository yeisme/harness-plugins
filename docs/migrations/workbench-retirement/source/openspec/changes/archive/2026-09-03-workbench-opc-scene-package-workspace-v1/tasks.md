# Workbench OPC 场景生产工作区任务

## 1. Contract adapter

- [x] 1.1 在现有 Scaena owner connector 中增加 OPCScenePackageSummaryV1alpha1 typed mapper；owner：Workbench SDK/adapters；依赖：Scaena additive contract；验收：未知字段兼容、缺失字段不转成 ready/pass、保留 action/receipt identity；验证：focused Vitest contract tests。
- [x] 1.2 增加 summary-first view model 与 stale/offline/partial/contract-mismatch 映射；owner：Workbench SDK；依赖：1.1；验收：view model 只读、不持久化 canonical state、不重算 action；验证：Vitest table tests。

## 2. Creative Production Lens

- [x] 2.1 在现有 /agent Creative Production Lens 组合 Scene Workspace；owner：Workbench web；依赖：1.2；验收：Context、Now、Why、Next、gate rail 和 Scene → Shot → Asset 逐级展开均可见；验证：Testing Library component tests。
- [x] 2.2 增加 primary action detail、copyable CLI/API detail 和 owner refetch flow；owner：Workbench web/TaskService adapter；依赖：1.2；验收：只提交 server-authored action，unknown/timeout 进入 reconcile_required；验证：component + mocked transport tests。
- [x] 2.3 增加 direction_confirm、visual_foundation_accept、export_confirm 与 Exception Inbox；owner：Workbench web；依赖：2.1；验收：正常路径只显示三门，rights/cost/stale/unknown/partial/offline/amendment 仅按触发出现；验证：UI state tests。
- [x] 2.4 增加 9:16/16:9 successor reframe、balanced/cinematic upgrade 和 cost envelope 展示；owner：Workbench web；依赖：2.1；验收：不得 crop-only/metadata-only 假装第二画幅，cinematic 必须显式确认；验证：component tests + fixture snapshots。
- [x] 2.5 增加安全 package download、manifest/checksum/receipt/grant 展示和 partial 下载提示；owner：Workbench web/typed client；依赖：Scaena receipt/grant；验收：浏览器不拼包、不改 manifest，过期 grant 只 refetch；验证：download integration tests。

## 3. Accessibility and verification

- [x] 3.1 完成 1440/1024/768/390 布局、键盘焦点、dialog focus return、屏幕阅读器顺序和 reduced-motion 行为；owner：Workbench web；依赖：2.1–2.5；验证：Playwright critical paths + accessibility assertions。
- [x] 3.2 完成 Workbench/DSH cross-entry conformance fixture；owner：Workbench integration；依赖：DSH summary/action adapter；验收：同 package revision 的 action/receipt 语义完全一致；验证：fixture evidence。
- [x] 3.3 运行 focused tests、integration evidence、build 和 strict OpenSpec；owner：Workbench；验证：
  - buf lint
  - CGO_ENABLED=0 go test ./service/...
  - CGO_ENABLED=1 go test -race ./service/...
  - bun run typecheck
  - bun test
  - bun run build
  - bun run test:contract
  - bun run test:integration
  - openspec validate workbench-opc-scene-package-workspace-v1 --strict --no-interactive
  - evidence 写入 temp/integration-test-runs/<run-id>/
  - **Evidence (2026-09-03 收口)**：全部验证命令当日终态复跑通过——`buf lint` exit 0；`CGO_ENABLED=0 go test ./service/...` 209 包全绿（此前 3.3 归因的 config-check/workers-runtime 失败实为 managed PG DSN 合同迁移漏改，已在 b863c2c 修复，非 environmental）；`CGO_ENABLED=1 go test -race` 聚焦改动包全绿（owners/scaena、workbench-release、dbpolicy、projectsoak、stagingcontrol、clihost、missionbrief/events、agentruntime、observability）；`bun run typecheck` ✓；`bun test` 939 pass/8 skip/0 fail（152 文件）；`bun run build` ✓（dist 四二进制）；`bun run test:contract` 552 pass/0 fail；`bun run test:integration` evidence run `20260903152155-69a878ce-cb06-49cb-bccc-d710a192f426` status=passed/exit 0/redaction 0；`openspec validate --strict` valid。
