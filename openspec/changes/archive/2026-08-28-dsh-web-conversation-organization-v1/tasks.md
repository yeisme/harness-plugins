## 1. OpenSpec 与兼容门

- [x] 1.1 创建 proposal、design、两份 capability specs 和任务账本。
- [x] 1.2 严格验证 OpenSpec，并记录 additive surface、回滚和旧 `sessionTags` 兼容测试。

## 2. Host 组织合同

- [x] 2.1 新增 organization wire 类型、默认功能目录、assignment CAS 与自动分类策略纯函数。
- [x] 2.2 新增规则匹配、批次 plan/execute/undo、管理员解锁策略与聚焦测试。
- [x] 2.3 新增 `sessionOrganization` Remote/service 适配，保持 `sessionTags` Remote 不变。

## 3. Web 管理体验

- [x] 3.1 在 `ui-session-tags` 增加 Workspace→功能分组 projection 和快捷 assignment 编辑合同。
- [x] 3.2 在 `ui-desktop-workbench` 增加组合筛选、多选、批次预览、操作历史和管理员门管理页。
- [x] 3.3 补 loading、empty、error、partial、dense-data、键盘与无障碍组件测试。

## 4. Bundle 与上游 seam

- [x] 4.1 Bundle additive 装配 organization Host/Client，seam 缺失时诚实降级。
- [x] 4.2 为 grouping provider handoff 增加可选 `parentId`/`color`，并保持旧 provider 合同测试。
- [x] 4.3 更新 owning README 与兼容/回滚说明。

## 5. 验证与证据

- [x] 5.1 运行 Host、session-tags Client、Desktop Workbench 聚焦测试与 typecheck/build。
- [x] 5.2 运行仓库 test/build/check:bundles，并归因任何预存或并行失败。
  - `check:bundles` 19/19；本变更聚焦包全绿。
  - 全仓 test 的终止点是 `ui-pane-workbench` 两个既有在途用例；全仓 build 曾被并行删除的 `git-pane.tsx` 阻断，文件恢复后 Desktop Workbench client/bundle build 均通过。
- [x] 5.3 运行 profile integration entrypoint，检查 `temp/integration-test-runs/<run-id>/` 脱敏证据。
  - Evidence：`temp/integration-test-runs/2026-08-28T06-15-12-213Z-1834680-session-tags-web-profile/`。
  - build/pack/seam-prepare gates 全绿；official 与 seam runtime 均在 `dsh plugin add` 内部 pnpm 安装阶段失败，尚未进入 browser checks，summary 原 exit code 为 1。
