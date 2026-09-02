## 执行顺序与门

```text
Gate A  基线与合同      0 → 1
Gate B  统一交互层          2
Wave C  消费方/视觉/配置    3 → 4 → 5
Gate D  兼容发布            6
Gate E  稳定验收            7
Closeout                   8
```

- Gate A 结束前不修改 selection runtime；先冻结 capability、event、alias、owner 和 rollback。
- Wave C 的 3/4/5 可按文件边界分批推进，但 `ui-interaction-space` 与 `ui-selection-annotation` 存在重叠写入时必须串行。
- Gate D 只在 V2 主路径与 V1 adapter 的 focused tests 稳定后开始。
- Gate E 才运行仓库级完整 typecheck/test/build/bundle/visual 门；实现阶段只跑拥有切片的 focused checks。

## 0. 迁移前基线与 owner 对齐

- [ ] 0.1 盘点 `ui-selection-annotation`、`ui-interaction-space`、`ui-pane-workbench` 当前 selection toolbar、Composer、More、快捷键、style 注入和 dispose 路径，输出 V1→V2 对照表；不得覆盖并行会话的在途改动。
- [ ] 0.2 确认 DSH/Host/Composer/Editor 的 capability 名称、typed intent owner、receipt seam 和 Workspace Designer 注册点；缺失 seam 记录为 upstream handoff，不在 client 伪造。
- [ ] 0.3 固化 V1 compatibility window 的 release 标识、默认 policy、kill-switch、rollback 负责人、deprecation marker 和 removal release 条件。
- [ ] 0.4 建立包/事件/快捷键消费者清单：`@yeisme/dsh-selection-annotation`、`@yeisme/dsh-interaction-space`、`dsh-selection-annotation:submit`、`add-to-batch`、`ask/comment/edit/agent-edit/copy-quote/add-to-batch/open-full`。

## 1. Selection Context 与统一合同

- [ ] 1.1 在 `packages/client/ui-interaction-space` 定义 `SelectionContextKindV2`、`SelectionContextV2`、`SelectionActionDescriptorV2`、`SelectionActionIntentV2` 与 `SelectionInteractionCapabilityV2`；所有字段有界、可本地化、无 URL/path/payload。
- [ ] 1.2 实现 selection normalizer：支持 text/source/image-region/table-range/editable-control，120ms stable debounce、viewport 检查、敏感区域排除、`data-dsh-selection-optout` 和 context invalidation。
- [ ] 1.3 保持 `SelectionAnchorV1`、`dsh-selection-annotation:submit` 与 `add-to-batch` 事件兼容；新增 `policyVersion`、`canonicalActionId`、`contextKind` 只能 optional additive。
- [ ] 1.4 为未知 context、非法 descriptor、超长 label、未命名空间 id、未知 capability 和 credential-shaped 字段补 fail-closed unit/contract tests。

## 2. Global Interaction Layer 与状态机

- [ ] 2.1 在 `ui-interaction-space` 实现 singleton controller/provider；多 Pane 只能提交 context，不得各自 mount toolbar 或 Composer。
- [ ] 2.2 实现 `idle → candidate → stable → actions-visible → dispatching → surface → dismissed/pinned` reducer，覆盖 reselect、scroll、resize、Esc、outside click、invalid context。
- [ ] 2.3 实现 context-aware resolution：过滤不适用动作；缺 capability 的动作只进 More disabled；按 priority → install order → id 排序；输出 1 primary + 2 secondary + More。
- [ ] 2.4 实现 action dispatch bridge：本地 copy 即时完成；ask/comment/edit/add-to-batch/open-full 发送 typed intent；禁止 client 直接提交 patch/path 或伪造 receipt。
- [ ] 2.5 实现 Pin 语义：普通 selection 永不自动 Pin；Pin 后使用 Workbench 可恢复 entry，失效 context 不得继续执行。
- [ ] 2.6 为重复 mount、profile 切换、HMR、pane close 和 dispose 增加 listener/timer/observer/portal/style 对称释放测试。

## 3. Selection Annotation 与交互空间迁移

- [ ] 3.1 将 `ui-selection-annotation` 的 selectionchange 入口改为发布 `SelectionContextV2`；移除选中后自动打开 Compact Composer 的路径。
- [ ] 3.2 将原 toolbar 七个动作映射为 namespaced descriptors 与 aliases；保留 `ask/comment/edit/agent-edit/copy-quote/add-to-batch/open-full` 的 canonical 行为与 owner 语义。
- [ ] 3.3 把 `ui-interaction-space` 的提案/锚点/时间线 surface 接入 singleton action handoff；关闭 pane 只 detach，不清理主会话或 owner 状态。
- [ ] 3.4 统一 Composer handoff：只有 ask/comment/edit 等明确动作才打开 Composer；焦点进入输入区，anchor、草稿、附件、preview-first 和原会话保持不变。
- [ ] 3.5 对 input、textarea、contenteditable、代码编辑器接管增加默认路径；强制排除 password/token-like/private、overlay/Composer 自身与 host opt-out，并回归原生快捷键。

## 4. 统一视觉与响应式表面

- [ ] 4.1 用 `ui-visual-kit` 的 `buildPanelStyles` 和 `ui-surface` 的 `Surface`/`SurfaceActionBar`/`SurfaceContextBar` 重做 Actions、More、disabled reason、Bottom Sheet；移除白色/GitHub fallback 与未 scoped CSS。
- [ ] 4.2 固化桌面 `>=960px`、中间 `560–959px`、窄屏 `<560px` 的布局；触控只显示 Actions 入口并使用 Bottom Sheet，action hit target ≥44px。
- [ ] 4.3 实现 `aria-expanded`、`aria-controls`、roving tabindex、focus-visible、Esc 逐层退出、原焦点恢复和 `prefers-reduced-motion`；状态不得只靠颜色。
- [ ] 4.4 建立组件截图基线：360/560/960px、dark、reduced-motion、text/source/image/table/editor、缺 capability、More 展开和 Bottom Sheet。

## 5. Registry 扩展 SDK 与偏好

- [ ] 5.1 暴露项目内 typed registry/registration API；扩展只能提交 descriptor + owner dispatch，不得注入 render callback、CSS、remote component 或任意 handler。
- [ ] 5.2 实现 registration scope/dispose、namespaced id、alias 冲突检查、稳定排序和卸载后快捷键/帮助/More 同步移除。
- [ ] 5.3 在 Workspace Designer 增加“Selection & Interaction”区，支持按 context 配置 visibility、order、shortcut、density、preset。
- [ ] 5.4 实现 `workspace > user > built-in` 合并、未知 id/冲突快捷键/越界偏好回退与诊断；只持久化有界 canonical id 和 UI 值。
- [ ] 5.5 默认注册 `Alt+Enter`；检测宿主/editor 快捷键冲突并 fail-safe，确保原生编辑器快捷键优先。

## 6. V1 → V2 兼容与发布

- [ ] 6.1 实现 capability probe：V2 优先，V1-only 宿主在 compatibility window 内使用 adapter；不做 client polyfill，不把未知当作 V2。
- [ ] 6.2 给 adapter 增加 `deprecated=true` 的脱敏 evidence marker；旧事件、action alias、preview-first、审批、版本围栏和 receipt 回归不漂移。
- [ ] 6.3 增加 rollback policy：按 workspace kill-switch/capability policy 切换 `policyVersion=v1`，恢复旧 toolbar contract，并验证切回 V2 不丢 context。
- [ ] 6.4 写出 canary/default/removal 三阶段 release checklist；V2 连续一个 release 达成 browser/keyboard/touch/HMR/owner 验收后，才允许移除 V1 runtime。
- [ ] 6.5 更新 bundle manifest、package version/release notes 和安装文档；安装命令保持 `dsh plugin --profile web add @yeisme/dsh-selection-annotation`。

## 7. 验证与证据

- [ ] 7.1 运行 `@yeisme/dsh-client-ui-interaction-space`、`@yeisme/dsh-client-ui-selection-annotation` unit/component tests，覆盖 registry、排序、context、dismissal、focus、preference、alias 和 owner unavailable。
- [ ] 7.2 增加 jsdom/integration flow：选择 → stable Actions → explicit ask/comment/edit → typed intent → owner receipt；覆盖 V1 adapter fallback、reselect、scroll、Esc、outside、Pin。
- [ ] 7.3 增加 Playwright journeys/screenshots：360/560/960px、dark/reduced-motion、text/source/image/table/editor、coarse pointer、敏感/opt-out、More disabled reason、HMR/dispose。
- [ ] 7.4 运行 bundle smoke、`check:bundles`、typecheck、build，并执行 `openspec validate dsh-selection-interaction-v2 --strict --no-interactive`。
- [ ] 7.5 每次 integration/e2e 运行写入 `temp/integration-test-runs/<run-id>/summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`；证据不得包含原文、截图字节、prompt、token、URL 或 provider payload。

## 8. 文档与 closeout

- [ ] 8.1 实现完成后回写 `docs/design/dsh-selection-interaction-v2.md`：记录实际 capability 名称、偏差决策、截图和验收结果，未实现项不得写成已交付。
- [ ] 8.2 实现完成后回写 selection annotation、interaction space、bundle README：把“planned V2”更新为真实版本、默认策略、能力缺失降级、回滚和验证命令。
- [ ] 8.3 closeout 时更新 `docs/README.md` 和 evidence 索引，链接 V1 历史摘要、V2 OpenSpec、实际证据目录和 owner handoff。
- [ ] 8.4 完成 diff review 与 compatibility verdict；确认未改变 anchor/approval/file-host owner 语义，未引入第二 design system 或私有 DSH API。

## 完成门命令

```bash
cd /workspaces/yeisme-agent/agent/harness-plugins
pnpm --filter @yeisme/dsh-client-ui-interaction-space run test
pnpm --filter @yeisme/dsh-client-ui-selection-annotation run test
pnpm run test:visual
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check:bundles
openspec validate dsh-selection-interaction-v2 --strict --no-interactive
```
