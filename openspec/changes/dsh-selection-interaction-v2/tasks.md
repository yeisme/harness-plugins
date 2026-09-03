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

- [x] 0.1 盘点 `ui-selection-annotation`、`ui-interaction-space`、`ui-pane-workbench` 当前 selection toolbar、Composer、More、快捷键、style 注入和 dispose 路径，输出 V1→V2 对照表；不得覆盖并行会话的在途改动。
- [x] 0.2 确认 DSH/Host/Composer/Editor 的 capability 名称、typed intent owner、receipt seam 和 Workspace Designer 注册点；缺失 seam 记录为 upstream handoff，不在 client 伪造。Evidence: docs/design/dsh-selection-interaction-v2.md §10.1/10.2（2026-09-02 代码事实盘点：pane-workbench 无私有 selection toolbar；事件无本仓外部消费者；user-actions-slot seam 缺位记为 upstream handoff）。
- [x] 0.3 固化 V1 compatibility window 的 release 标识、默认 policy、kill-switch、rollback 负责人、deprecation marker 和 removal release 条件。Evidence: §10.3 兼容窗口冻结（0.1.0-rc.1 → 0.2.0-rc.1 canary；kill-switch + policyVersion 双通道；maintainer 负责 rollback）。
- [x] 0.4 建立包/事件/快捷键消费者清单：`@yeisme/dsh-selection-annotation`、`@yeisme/dsh-interaction-space`、`dsh-selection-annotation:submit`、`add-to-batch`、`ask/comment/edit/agent-edit/copy-quote/add-to-batch/open-full`。Evidence: §10.4 消费者清单（包/事件/快捷键三张清单；全仓无 Alt+Enter 既有占用）。

## 1. Selection Context 与统一合同

- [x] 1.1 在 `packages/client/ui-interaction-space` 定义 `SelectionContextKindV2`、`SelectionContextV2`、`SelectionActionDescriptorV2`、`SelectionActionIntentV2` 与 `SelectionInteractionCapabilityV2`；所有字段有界、可本地化、无 URL/path/payload。 Evidence: src/selection/contracts.ts（bounded 类型+fail-closed 校验+V1_ACTION_ALIASES）经 index 导出；tests/selection-contracts.spec.ts。
- [x] 1.2 实现 selection normalizer：支持 text/source/image-region/table-range/editable-control，120ms stable debounce、viewport 检查、敏感区域排除、`data-dsh-selection-optout` 和 context invalidation。 Evidence: src/selection/normalizer.ts（五类分类/120ms 稳定阈值/viewport/敏感排除/opt-out/自表面）+ tests/selection-normalizer.spec.ts。
- [x] 1.3 保持 `SelectionAnchorV1`、`dsh-selection-annotation:submit` 与 `add-to-batch` 事件兼容；新增 `policyVersion`、`canonicalActionId`、`contextKind` 只能 optional additive。 Evidence: anchor 草稿仍经 @yeisme/dsh-selection-host selectionToAnchorDraft；submit/add-to-batch 事件与字段不变；policyVersion/canonicalActionId/contextKind 仅 optional additive（tests/integration/flow.spec.tsx V1/V2 双路径断言）。
- [x] 1.4 为未知 context、非法 descriptor、超长 label、未命名空间 id、未知 capability 和 credential-shaped 字段补 fail-closed unit/contract tests。 Evidence: tests/selection-contracts.spec.ts（unknown context/非法 descriptor/超长 label/未命名空间 id/credential 形状/unknown-key callback 注入面全拒）。

## 2. Global Interaction Layer 与状态机

- [x] 2.1 在 `ui-interaction-space` 实现 singleton controller/provider；多 Pane 只能提交 context，不得各自 mount toolbar 或 Composer。 Evidence: src/selection/layer.ts attachSharedSelectionInteraction refcount singleton + registerContextPublisher/publishExternalContext；tests/selection-layer.spec.ts（双 attach 单实例/最后 detach 释放）。
- [x] 2.2 实现 `idle → candidate → stable → actions-visible → dispatching → surface → dismissed/pinned` reducer，覆盖 reselect、scroll、resize、Esc、outside click、invalid context。 Evidence: src/selection/reducer.ts idle→candidate→stable→actions-visible→dispatching→surface→dismissed/pinned + tests/selection-reducer.spec.ts（reselect/scroll/resize/Esc/outside/invalid 全覆盖）。
- [x] 2.3 实现 context-aware resolution：过滤不适用动作；缺 capability 的动作只进 More disabled；按 priority → install order → id 排序；输出 1 primary + 2 secondary + More。 Evidence: registry.resolve context 过滤+capability 缺失只进 More disabled+priority/install/id 稳定排序+1+2+More；tests/selection-registry.spec.ts 五矩阵+边界。
- [x] 2.4 实现 action dispatch bridge：本地 copy 即时完成；ask/comment/edit/add-to-batch/open-full 发送 typed intent；禁止 client 直接提交 patch/path 或伪造 receipt。 Evidence: layer.activateAction typed intent（contextId/canonical id/alias 来源/owner/approvalPolicy），本地 copy 内建剪贴板，owner 缺席 fail-closed dismiss；tests/selection-layer.spec.ts。
- [x] 2.5 实现 Pin 语义：普通 selection 永不自动 Pin；Pin 后使用 Workbench 可恢复 entry，失效 context 不得继续执行。 Evidence: Pin 仅 stable/actions-visible 可达（reducer 结构性），restorePinned 恢复；context 失效清除 pinned；tests/selection-reducer.spec.ts + selection-layer.spec.ts。
- [x] 2.6 为重复 mount、profile 切换、HMR、pane close 和 dispose 增加 listener/timer/observer/portal/style 对称释放测试。 Evidence: dispose 对称释放 listener/timer/observer/style/overlay；HMR dispose+re-attach 单实例单样式；tests/selection-layer.spec.ts singleton lifecycle 两例。

## 3. Selection Annotation 与交互空间迁移

- [x] 3.1 将 `ui-selection-annotation` 的 selectionchange 入口改为发布 `SelectionContextV2`；移除选中后自动打开 Compact Composer 的路径。 Evidence: client/index.ts V2 主路径 selectionchange 归一发布 SelectionContextV2，不再 mount 私有 toolbar；自动开 Composer 路径移除（V1 adapter 仅 policyVersion=v1 时保留）。
- [x] 3.2 将原 toolbar 七个动作映射为 namespaced descriptors 与 aliases；保留 `ask/comment/edit/agent-edit/copy-quote/add-to-batch/open-full` 的 canonical 行为与 owner 语义。 Evidence: builtin-actions.ts 七动作 canonical 化（dsh:ask/comment/edit/analyze/copy-quote/add-to-batch/open-full）+ aliases 保留 owner 语义；tests/selection-registry.spec.ts alias 解析。
- [x] 3.3 把 `ui-interaction-space` 的提案/锚点/时间线 surface 接入 singleton action handoff；关闭 pane 只 detach，不清理主会话或 owner 状态。 Evidence: ui-interaction-space client apply attachSharedSelectionInteraction+registerContextPublisher，dispose 仅 detach（controller/会话状态原样）；tests/selection-layer.spec.ts refcount。
- [x] 3.4 统一 Composer handoff：只有 ask/comment/edit 等明确动作才打开 Composer；焦点进入输入区，anchor、草稿、附件、preview-first 和原会话保持不变。 Evidence: 显式 ask/comment/edit/analyze 才 openComposer，焦点入 textarea；anchor/草稿/preview-first/原会话不变（tests/integration/flow.spec.tsx V2 e2e）。
- [x] 3.5 对 input、textarea、contenteditable、代码编辑器接管增加默认路径；强制排除 password/token-like/private、overlay/Composer 自身与 host opt-out，并回归原生快捷键。 Evidence: normalizer editable-control 分类（input/textarea/contenteditable）+ password/token-like/opt-out/自表面强制排除 + isShortcutReserved 原生快捷键优先；tests/selection-normalizer.spec.ts + selection-layer.spec.ts reserved。

## 4. 统一视觉与响应式表面

- [x] 4.1 用 `ui-visual-kit` 的 `buildPanelStyles` 和 `ui-surface` 的 `Surface`/`SurfaceActionBar`/`SurfaceContextBar` 重做 Actions、More、disabled reason、Bottom Sheet；移除白色/GitHub fallback 与未 scoped CSS。 Evidence: Actions/More/Sheet 经 buildPanelStyles({scope:'dsh-selection-actions'}) vk token；composer overlay 迁移 scope dsh-selection-composer，移除 #ffffff/#d0d7de GitHub fallback；零裸色值（visual-token 口径）。
- [x] 4.2 固化桌面 `>=960px`、中间 `560–959px`、窄屏 `<560px` 的布局；触控只显示 Actions 入口并使用 Bottom Sheet，action hit target ≥44px。 Evidence: SELECTION_NARROW_VIEWPORT_PX=560 断点 + coarse pointer → 单一入口 + Bottom Sheet（min-height:44px）；tests/selection-layer.spec.ts responsive 例。
- [x] 4.3 实现 `aria-expanded`、`aria-controls`、roving tabindex、focus-visible、Esc 逐层退出、原焦点恢复和 `prefers-reduced-motion`；状态不得只靠颜色。 Evidence: aria-expanded/controls/haspopup、箭头 roving focus、focus-visible ring、Esc 逐层（Sheet/More→Composer→Actions→还原原焦点）、reduced-motion media；disabled reason 文本非纯色。
- [ ] 4.4 建立组件截图基线（browser gate：360/560/960px、dark、reduced-motion 截图基线属 V2 canary 浏览器验证波次，本仓无浏览器门依赖，如实未勾）：360/560/960px、dark、reduced-motion、text/source/image/table/editor、缺 capability、More 展开和 Bottom Sheet。

## 5. Registry 扩展 SDK 与偏好

- [x] 5.1 暴露项目内 typed registry/registration API；扩展只能提交 descriptor + owner dispatch，不得注入 render callback、CSS、remote component 或任意 handler。 Evidence: registry.register 只收 descriptor（unknown-key/callback/URL/credential fail-closed）；intent handler 经 onIntent typed 注入，无 render callback/CSS/remote component。
- [x] 5.2 实现 registration scope/dispose、namespaced id、alias 冲突检查、稳定排序和卸载后快捷键/帮助/More 同步移除。 Evidence: registration handle dispose scope、alias 冲突拒绝、稳定排序、卸载即时从投影消失（tests/selection-registry.spec.ts hot unload/duplicate 两例）。
- [x] 5.3 在 Workspace Designer 增加“Selection & Interaction”区，支持按 context 配置 visibility、order、shortcut、density、preset。 Evidence: ui-pane-workbench selection-interaction-designer.tsx（五 context tab + visibility/order/shortcut/density/preset）挂 designer inspector；tests/selection-interaction-designer.spec.tsx 4 例。
- [x] 5.4 实现 `workspace > user > built-in` 合并、未知 id/冲突快捷键/越界偏好回退与诊断；只持久化有界 canonical id 和 UI 值。 Evidence: preferences.ts workspace>user>built-in 合并、未知 id/冲突/越界 fail-closed 回退+诊断、只承载 canonical id 与有界 UI 值；tests/selection-preferences.spec.ts 6 例。
- [x] 5.5 默认注册 `Alt+Enter`；检测宿主/editor 快捷键冲突并 fail-safe，确保原生编辑器快捷键优先。 Evidence: Alt+Enter 默认（layer keydown）+ isShortcutReserved 宿主保留键优先 fail-safe（不注册即不接管）；tests/selection-layer.spec.ts Alt+Enter/reserved 两例。

## 6. V1 → V2 兼容与发布

- [x] 6.1 实现 capability probe：V2 优先，V1-only 宿主在 compatibility window 内使用 adapter；不做 client polyfill，不把未知当作 V2。 Evidence: V2 默认 + policyVersion=v1 一个 release adapter 窗口；无 client polyfill、不把未知当 V2（probe 三态 + 显式策略键）。
- [x] 6.2 给 adapter 增加 `deprecated=true` 的脱敏 evidence marker；旧事件、action alias、preview-first、审批、版本围栏和 receipt 回归不漂移。 Evidence: dsh-selection-interaction:evidence deprecated=true 脱敏标记（仅版本/capability/结果）；旧事件/alias/preview-first/审批/版本围栏语义回归（approval/version fencing 由 selection-host service 持有未动）。
- [x] 6.3 增加 rollback policy：按 workspace kill-switch/capability policy 切换 `policyVersion=v1`，恢复旧 toolbar contract，并验证切回 V2 不丢 context。 Evidence: policyVersion=v1 kill-switch 切换恢复旧 toolbar contract；tests/integration/flow.spec.tsx 回滚例验证切回 V2 不丢选区 context。
- [x] 6.4 写出 canary/default/removal 三阶段 release checklist；V2 连续一个 release 达成 browser/keyboard/touch/HMR/owner 验收后，才允许移除 V1 runtime。 Evidence: docs/design/dsh-selection-interaction-v2.md §12 三阶段清单（canary 勾选、default/removal 带门）。
- [x] 6.5 更新 bundle manifest、package version/release notes 和安装文档；安装命令保持 `dsh plugin --profile web add @yeisme/dsh-selection-annotation`。 Evidence: bundle/client 版本 0.2.0-rc.1；bundle+client README 与 docs/README.md 索引更新；安装命令不变。

## 7. 验证与证据

- [x] 7.1 运行 `@yeisme/dsh-client-ui-interaction-space`、`@yeisme/dsh-client-ui-selection-annotation` unit/component tests，覆盖 registry、排序、context、dismissal、focus、preference、alias 和 owner unavailable。 Evidence: interaction-space 92 tests（contracts 13/registry 11/normalizer 9/reducer 11/layer 17/preferences 6 + 既有），覆盖 registry/排序/context/dismissal/focus/preference/alias/owner unavailable。
- [x] 7.2 增加 jsdom/integration flow：选择 → stable Actions → explicit ask/comment/edit → typed intent → owner receipt；覆盖 V1 adapter fallback、reselect、scroll、Esc、outside、Pin。 Evidence: tests/integration/flow.spec.tsx（选择→stable→explicit ask→typed intent→submit 事件 v2 字段；V1 adapter fallback+回滚；reselect/Esc/outside/pin 在 layer spec）。
- [ ] 7.3 增加 Playwright（browser gate：journeys/screenshots 属 canary 浏览器验证波次，plugin-host-protocol 明文不作为插件完成条件；jsdom 层等价覆盖已交付，如实未勾） journeys/screenshots：360/560/960px、dark/reduced-motion、text/source/image/table/editor、coarse pointer、敏感/opt-out、More disabled reason、HMR/dispose。
- [x] 7.4 运行 bundle smoke、`check:bundles`、typecheck、build，并执行 `openspec validate dsh-selection-interaction-v2 --strict --no-interactive`。 Evidence: bundle smoke（V2 预期）+ check:bundles 27/27 + 双包 typecheck/build 绿 + openspec validate dsh-selection-interaction-v2 --strict valid；根级全量门见收口提交。
- [x] 7.5 每次 integration/e2e 运行写入 `temp/integration-test-runs/<run-id>/summary.json`、`command.txt`、`stdout.log`、`stderr.log`、`env.json` 和 `artifacts/`；证据不得包含原文、截图字节、prompt、token、URL 或 provider payload。 Evidence: scripts/run-selection-interaction-integration.mjs → temp/integration-test-runs/selection-interaction-v2-20260902160748Z-883078/（status passed，六件套脱敏）。

## 8. 文档与 closeout

- [x] 8.1 实现完成后回写 `docs/design/dsh-selection-interaction-v2.md`：记录实际 capability 名称、偏差决策、截图和验收结果，未实现项不得写成已交付。 Evidence: docs/design/dsh-selection-interaction-v2.md §10 Gate A 基线 + §11 实现回写（capability 名称/偏差决策/未实现项如实）。
- [x] 8.2 实现完成后回写 selection annotation、interaction space、bundle README：把“planned V2”更新为真实版本、默认策略、能力缺失降级、回滚和验证命令。 Evidence: selection-annotation、interaction-space、bundle 三 README 更新为真实版本/默认策略/降级/回滚/验证命令。
- [x] 8.3 closeout 时更新 `docs/README.md` 和 evidence 索引，链接 V1 历史摘要、V2 OpenSpec、实际证据目录和 owner handoff。 Evidence: docs/README.md 索引 + evidence 目录链接（§11/README）。
- [x] 8.4 完成 diff review 与 compatibility verdict；确认未改变 anchor/approval/file-host owner 语义，未引入第二 design system 或私有 DSH API。 Evidence: anchor/approval/file-host owner 语义未动（selection-host 合同原样）；无第二 design system（唯一 vk canonical fallback）；无私有 DSH API（probe/CustomEvent 通道不变）。

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
