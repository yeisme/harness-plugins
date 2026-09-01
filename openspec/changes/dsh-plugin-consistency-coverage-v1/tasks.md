> 状态：进行中（2026-08-31 设计定稿；硬门 = G18 归档产出基线报告——2026-09-01 G18 已归档、基线报告 temp/toolchain-runs/2026-09-01T014345901Z-toolchain 已产出，门达成；按设计文档 §6.3 推进 DAG 执行。2026-09-01 首波：基线 50 红清 34（1.1 达成、1.2/1.3 部分清零）+ §2/§3 两新包落地；余 16 红全在并行 lane 包）。

## 1. 红灯清零

- [x] 1.1 以 G18 基线报告为准，逐批修复 visual-token-conformance 红灯（裸控件 → ys-field/visual-kit 等价替换），五个已分类包不回退。
  - 证据（2026-09-01）：基线 visual-token 首跑即绿（26 checked, 0 findings），无可修红灯；首波收口复跑 PASS 26/0，已分类包零回退。
- [ ] 1.2 按观测门结果定点修复 dispose-hmr-conformance 红灯（监听器/定时器/observer/订阅释放补齐）。
  - 进展（2026-09-01）：36→12。已清 24 项 = ui-pane-workbench 8、ui-session-tags 4、ui-pane-domain 2、ui-conversation-rewrite 2、ui-selection-annotation 2（改 overlay 事件委托）、ui-pane-subagent 1、ui-creator-studio 1、ui-ai-drama-director 1、ui-desktop-workbench 1、ui-structured-content 1、ui-semantic-file-editor 1；sdk 增 `subscriptionHandle` 幂等句柄。余 12 项全在并行 lane 禁改包（dsh-terminal 3、ui-interaction-space 2、ui-pane-side-chat 2、ordo-agent-ops 2、ui-token-usage 1、command-experience-core 1、dsh-rich-media 1），待其冻结后清零。
- [ ] 1.3 清零 declaration-lint 与 safe-projection-audit 基线红灯。
  - 进展（2026-09-01）：decl-lint 2→0（dsh-browser-pane、dsh-file-document 补 cordis.patch.yml + package.json 三点接线）；safeproj 12→4，已清 8 = ui-pane-workbench 3、ui-desktop-workbench 3、ui-selection-annotation 1、ui-next-step-suggestions 1（统一走 sdk `probeCapability(browserPreferenceStorage)` 三态 seam）。余 4 项全在并行 lane 禁改包（ui-command-experience-web 2、dsh-rich-media 1、ui-mermaid-render 1）。

## 2. catalog 薄做

- [x] 2.1 新建 `packages/catalog/dsh-plugin-catalog`：构建工具从仓库包生成静态清单 + 本地查询 CLI；无网络服务、无遥测、不建第二 registry。
- [x] 2.2 清单覆盖全部可安装 bundle；新增 bundle 重建即含，不需手工登记。
  - 证据（2026-09-01）：typecheck+24 测试+build 全绿；`build` 尾步生成 lib/catalog.json = 30 bundles（30 installable，与 declaration-lint checked 30 同量级；bundle-contract 27 为已构建产物口径）；fixture 测试验证新增 bundle 目录重建即含（temp 沙箱）；CLI = bin `dsh-plugin-catalog` + scripts `catalog`/`manifest:generate`（list/show/search/generate，--json/--manifest）。

## 3. example 参考插件

- [x] 3.1 新建 `packages/example/dsh-plugin-example`：host+client+bundle 三层最小结构 + probe-first 降级写法；不接管 core state、不加运行时依赖。
  - 证据（2026-09-01）：typecheck+31 测试（probe 三态与 sdk contracts 双 parity、fail-closed host、client 降级矩阵、bundle 合同自检）+ ModuleLoader 冒烟全绿；零 dependencies（react/cordis 均 optional peer）；lib/client.js 仅 require("react")，banner id=包名。
- [x] 3.2 干净 web profile `dsh plugin add` 安装运行验证；seam 缺失时显示禁用与原因。
  - 证据（2026-09-01，按 plugin-host-protocol 完成门判读收口）：协议级门全过——安装形态由 bundle-contract/catalog 收敛语法校验；「seam 缺失→禁用+原因」由真实构建产物 ModuleLoader 冒烟（4 种 seam 组合，含 needs_contract 禁用+reason、unavailable、零注册）+ vitest 降级矩阵验证；完成门明文排除官方 `dsh web` 观测（「测试门禁不得依赖它们」），header slot 在空会话宿主不挂载属官方宿主行为、非本插件完成条件。另附可选 host 集成实证：隔离 DSH_HOME 真实 `dsh plugin --profile web add` + `dsh web` 启动，面板真机出现且如实 needs_contract 降级、boot manifest 含 example、client.js 字节一致。证据：temp/integration-test-runs/2026-09-01T0609Z-dsh-plugin-example-clean-web-profile/。

## 4. 验证与证据

- [ ] 4.1 `pnpm check:plugins` 对 31 包零红灯，报告与 G18 基线对照展示清零轨迹（R11 主指标达成点）。
- [ ] 4.2 全仓 `pnpm run typecheck && test && build` 全绿；openspec validate strict 通过。
- [ ] 4.3 更新 `docs/design/dsh-plugin-dev-toolchain-and-experience.md` 附四波收口结论与 14 天 dogfood 观测记录链接。
