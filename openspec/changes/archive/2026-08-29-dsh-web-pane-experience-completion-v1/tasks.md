# Tasks: dsh-web-pane-experience-completion-v1

## 1. Workspace 能力矩阵与 Experience Tier 判定

- [x] 1.1 在 `packages/client/ui-pane-workbench/src/` 新增 `experience-tier.ts`：纯函数 `resolveExperienceTier(probes)` 判定 Tier 0/1/2，输出 `WorkspaceExperienceTierV1`（tier + probes + 标准 reason keys）
- [x] 1.2 把 tier 判定接入 `client.ts` 的 `apply()`/probe 流程，订阅 seam 热插拔事件触发重判并广播；tier 状态不落盘
- [x] 1.3 新增 Workspace Capabilities 视图（受限投影：tier、seam 布尔、reason 文案、解锁文档锚点），接入 Quick Pick/设置入口与命令面 probe 链
- [x] 1.4 标准化 disabled reason：i18n namespace（zh/en/pseudo）+ reason key → 文案/解锁锚点映射；替换现有散落 reason 字符串
- [x] 1.5 诊断证据事件（tier 分布、reason 类别、unlock_hint_clicked 类别）接入既有脱敏证据管道
- [x] 1.6 单测：tier 判定纯函数矩阵（含 rc.9 残缺 workspaceLayout 中间态）、热插拔重判、投影脱敏断言
- [x] 1.7 probe 会话级缓存与失效：交互路径不重复 probe RPC，热插拔/owner 版本变化触发重判；残缺 seam 判 `contract_mismatch` 的负向测试

## 2. Tier 0 Overlay 宿主完整交互升级

- [x] 2.1 重写 `official-host.ts`：移除手写 tab 条，挂载共享 tab 系统组件（pinned/preview/overflow/bulk close 预检），保留 `PaneViewBoundary` 与挂载协议
- [x] 2.2 单 region 拓扑门：capability gate 在 dispatch 前拦截 split/move-region/maximize/dock 意图，返回标准 reason；确认无第二 region 渲染路径
- [x] 2.3 接入 `PaneDragCoordinator`：Tier 0 下 drop intent 收敛为 `reorder_within_group`；region 边缘不出现 edge zone/indicator，取消完整恢复
- [x] 2.4 接入锚定 Quick Pick、视图 More 菜单与完整键盘路径（Tab APG、Shift+F10、关闭后焦点恢复）到 overlay 宿主
- [x] 2.5 响应式与可访问性收尾：≤720px 全屏 Sheet、44px 目标、reduced-motion、`aria-label`/role 审计
- [x] 2.6 组件测试矩阵（1440/1024/768/390px）：tab 塌缩、bulk close 预检、reorder 拖拽、禁用控件可见性、键盘路径、Sheet 投影
- [x] 2.7 持久化 round-trip 无损（Tier 1 布局经 Tier 0 会话往返不丢 region/group 结构）与 Tier 0→1 热升级状态保持测试；高密度 tab 列表性能预算断言

## 3. AI Drama Director client 真接线

- [x] 3.1 `packages/client/ui-ai-drama-director/src/client/index.ts`：六个视图经 Pane Workbench `registerView()` 注册（effect-scoped、dispose 精确），删除 console.log stub
- [x] 3.2 `probeDramaCapability` 改真实组合 probe（pane-workbench 注入面 + creator-studio projection transport + drama host transport），缺失映射到具体视图/命令禁用
- [x] 3.3 /drama 命令面经 command-experience `/` 目录贡献（`presentation.launcher` + `slash.name: 'drama'`/aliases/category=work，P0 保留名冲突禁用语义）；上游 router seam 仅作增强 probe；command-experience 缺失时命令组禁用+标准 reason，不影响 pane 视图
- [x] 3.4 Director preset 经 preset service 应用；实现 Tier 0 塌缩语义（单 region 有序 tab 集、默认 ≤4 visible、secondary 按需）
- [x] 3.5 DramaContextV1 经 host transport 真实解析与切换 reconcile；unknown/partial/stale 禁 mutation 不自动重试
- [x] 3.6 证据事件接线（命令发现/首次打开/review 完成/handoff 结果类别/恢复时长），复用脱敏合同
- [x] 3.7 包测试：注册/dispose 幂等、probe 矩阵、preset 塌缩、context partial/stale 分支、证据脱敏断言
- [x] 3.8 键盘快捷键经 command-experience 共享 keymap 面注册（替换 stub 裸 window keydown）；preset 写操作 receipt（ok/rejected/permission_denied）处理：持久化被拒不阻断布局应用

## 4. 做剧 ↔ Workbench 场景回路

- [x] 4.1 WorkbenchHandoffV1 消费门：expiry/nonce/intent 白名单校验，拒绝路径记证据事件，无自动重试
- [x] 4.2 目标端重取数据：handoff 只消费 opaque refs/versions/intent，目标端经 owner projection 重新解析；负载含内容字段即拒绝
- [x] 4.3 跨模块 artifact handoff 菜单与拖拽意图按本仓 `pane-artifact-handoff` 合同实现（ref 版本校验、intent 有限词汇、目标重新 admission）
- [x] 4.4 官方 ArtifactRef/Intent seam probe-gated 切换：命中走官方通道（证据记 `official`），缺失回退本仓路径且无死按钮
- [x] 4.5 场景 preset ↔ workbench 模块映射表（Drama/Code/Review/Media），版本化声明式数据 + 缺项禁用指引
- [x] 4.6 集成测试：drama → Workbench 深链端到端（本地 signer/门校验）、拖拽 handoff 双通道、映射表缺项场景，证据落盘 `temp/integration-test-runs/<run-id>/`。Evidence (2026-08-28): `temp/integration-test-runs/2026-08-28T07-04-26-892Z-2578096-web-pane-experience/summary.json` passed all three checks.
- [x] 4.7 消费门负向矩阵：digest 篡改、nonce 重放（有界去重存储 + expiry sweep）、目标模块未安装指引；artifact intent idempotency key 去重测试

## 5. 验证与证据

- [x] 5.1 `pnpm run typecheck` / 受影响包测试 / `pnpm run build` / `pnpm run check:bundles` 全绿。Evidence (2026-08-28): root typecheck/build passed; Pane 247/247, Drama 92/92, Compose 26/26; bundle contracts 19/19.
- [x] 5.2 `openspec validate dsh-web-pane-experience-completion-v1 --strict --no-interactive` 通过
- [x] 5.3 集成证据六件套落盘 `temp/integration-test-runs/<run-id>/`（含 Tier 0 交互矩阵、drama 接线、handoff 回路），脱敏复核。Evidence (2026-08-28): six required entries plus `artifacts/integration-matrix.json`; redaction scan clean.
- [x] 5.4 协议合规自查：无 AppFrame 几何实现、无第二侧栏/工作台、无伪造 host、probe 失败可见——对照 `docs/plugin-host-protocol.md` 反例表逐条确认

## 6. 文档与收口

- [x] 6.1 新增 `docs/design/dsh-web-pane-experience-completion.md`：诊断（三层残废根因）、Experience Tier 模型、做剧/Workbench 用户旅程 walkthrough（Tier 0/1/2 各一遍）、交互缺口 owner 矩阵
- [x] 6.2 更新 `docs/design/dsh-workbench-roadmap-goals.md`：新增 G12（Pane 体验完成度）并映射本 change tasks；标注 G1–G4 与 Tier 2 的关系
- [x] 6.3 更新 `docs/README.md` 入口索引（新设计文档与本 change）
- [x] 6.4 更新 `packages/bundle/dsh-ai-drama-director/README.md` 与 `packages/bundle/pane-workbench/README.md`：Tier 行为、做剧入口、排障（对照能力矩阵）
- [x] 6.5 登记相邻 change 跟进：`dsh-core-pane-only-next-rc`、`dsh-pane-agents-host-compat-v1` 归档以消除主 spec 漂移；`dsh-ai-drama-director-pack-v1` 3.5/3.6 metadata CLI 缺口保持原 owner
- [x] 6.6 归档前复核：四个新 capability 均为 ADDED；归档后主 spec 落位检查（复核于 2026-08-29：dsh-ai-drama-client-runtime / pane-overlay-workbench-experience / workbench-scenario-handoff / workspace-capability-matrix 四 delta 均 ADDED-only，归档后 validate --specs 绿）
  - Pre-archive evidence (2026-08-28): all four delta specs use `## ADDED Requirements`; post-archive main-spec landing remains pending until the separate archive workflow is authorized and run.
