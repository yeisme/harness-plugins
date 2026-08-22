## 1. Root 设计与路由
- [x] 1.1 [Owner: Harness Plugins] 冻结 profile 数据模型、owner 边界与安全红线（本 change proposal/design/specs）。Acceptance: `openspec validate dsh-web-session-cookie-manager-v1 --strict --no-interactive` 通过；红线在 spec 中有可验证 Scenario。
- [x] 1.2 [Owner: Harness Plugins] 创建 Harness Plugins 实施 handoff `openspec/changes/dsh-session-cookie-manager-plugin-v1/`。Acceptance: 子项目 change strict validation 通过，任务含 Phase 1 全部切片。
## 2. Phase 1 实施验证（Harness Plugins）
- [ ] 2.1 [Owner: Harness Plugins] profile CRUD UI 与元数据持久化（无凭据值）。Acceptance: 组件测试覆盖列表/新建/重命名/删除/失败态；持久化 schema 测试证明无凭据字段。
- [ ] 2.2 [Owner: Harness Plugins] 与 model-provider/account resume 组合的账号面板。Acceptance: 既有账号能力只读组合，无第二状态 owner。
- [ ] 2.3 [Owner: Harness Plugins] 配额只读面板骨架与降级态。Acceptance: 无数据源时 fail visible；有源时仅渲染 owner 投影字段。
- [ ] 2.4 [Owner: Harness Plugins] 安全审查：renderer/持久化/日志/evidence 四面凭据泄漏扫描。Acceptance: 审查记录归档，快照只含 digest/redacted。
## 3. Phase 2 seam（upstream-prs，backlog）
- [ ] 3.1 [Owner: DSH upstream-pr] `web.cookieJars` seam 系列实现+双语 Agent Note+测试。Acceptance: upstream-prs 归档且 apply-check 绿。
- [ ] 3.2 [Owner: Harness Plugins] 接通真实 jar 应用/原子切换/清除。Acceptance: 集成测试覆盖切换原子性与跨 profile 无泄漏。
## 4. 收尾
- [ ] 4.1 [Owner: Harness Plugins] 审阅 redacted evidence、同步跨项目文档引用。Acceptance: 差异化三线文档互相引用一致。
