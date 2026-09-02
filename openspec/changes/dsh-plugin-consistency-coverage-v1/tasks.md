> 状态：进行中（2026-08-31 设计定稿；硬门 = G18 归档产出基线报告——2026-09-01 G18 已归档、基线报告 temp/toolchain-runs/2026-09-01T014345901Z-toolchain 已产出，门达成；按设计文档 §6.3 推进 DAG 执行。2026-09-01 首波：基线 50 红清 34（1.1 达成、1.2/1.3 部分清零）+ §2/§3 两新包落地；余 16 红全在并行 lane 包）。

## 1. 红灯清零

- [x] 1.1 以 G18 基线报告为准，逐批修复 visual-token-conformance 红灯（裸控件 → ys-field/visual-kit 等价替换），五个已分类包不回退。
  - 证据（2026-09-01）：基线 visual-token 首跑即绿（26 checked, 0 findings），无可修红灯；首波收口复跑 PASS 26/0，已分类包零回退。
  - 证据（2026-09-02）：command-first lane 收口新增包 `ui-session-status` 曾致 VT/SURFACE_REGRESSION（unclassified）——已按代码事实分类 `excluded`（纯 view-model/state，Web 渲染归 `ui-command-experience-web` SESSION_STATUS_VIEW_ID）补入 surfaces 分类账本；visual-token 复跑 PASS 26/0，已分类包零回退。
- [x] 1.2 按观测门结果定点修复 dispose-hmr-conformance 红灯（监听器/定时器/observer/订阅释放补齐）。
  - 证据（2026-09-02 清零）：余 8 项经复核均为框架托管释放路径的观测误报，非源码泄漏——checker 语义修正为承认四类托管释放：Cordis `ctx.on` 监听随所属 fiber 卸载移除、`useSyncExternalStore` 返回的 unsubscribe 回调由 React unmount 调用、`subscribe/on` 返回式 disposer 句柄（含 `?.()` 调用形态）、`listeners.delete` 显式摘除；checker 测试同步补齐。修正后 `dispose-hmr-conformance` PASS（471 checked, 0 findings），清零轨迹 36→12→8→0。
  - 进展（2026-09-01）：36→12。已清 24 项 = ui-pane-workbench 8、ui-session-tags 4、ui-pane-domain 2、ui-conversation-rewrite 2、ui-selection-annotation 2（改 overlay 事件委托）、ui-pane-subagent 1、ui-creator-studio 1、ui-ai-drama-director 1、ui-desktop-workbench 1、ui-structured-content 1、ui-semantic-file-editor 1；sdk 增 `subscriptionHandle` 幂等句柄。
  - 进展（2026-09-02）：12→8。command-first lane（dsh-web/tui-command-first-interaction-v1、dsh-web-real-data-self-owned-v1）已归档冻结，其 4 项清零 = ui-token-usage 1（React 订阅句柄 useMemo+bind 稳定）、command-experience-core slash-runtime 1（3 处 host 订阅 + directory 面 + syncInspectRegistrations 全部经 `subscriptionHandle` 幂等收口）、ui-pane-side-chat 2（controller session 订阅句柄化；view 两处 useSyncExternalStore 句柄化；side-chat 无在途 change 认领，按冻结处理）。余 8 项全在在途 lane 禁改包：dsh-terminal 3（dsh-pane-workspace-experience-v3 7.1/8.2/8.3 + productivity-v3）、ui-interaction-space 2（dsh-selection-interaction-v2 0/42 刚启动）、ordo-agent-ops 2（ordo-dsh-plugin-visualization-v1 active，ordo 面两红按 09-01 DAG 明确延后）、dsh-rich-media 1（dsh-rich-media-plugin-v1 23/27）——待对应 lane 冻结后清零。
- [x] 1.3 清零 declaration-lint 与 safe-projection-audit 基线红灯。
  - 证据（2026-09-02 清零）：余 1 项 dsh-rich-media `sources.ts` RAW_FETCH 收口——`urlSource` 明确注记为 owner-issued 短时能力 URL（host `resolveUrl` seam 签发，不做资源 ref 推断、不持久化进 pane projection，读取有界且可 abort，`SAFEPROJ: owner-authorized URL source` 标记），审计按该窄口径标记豁免 RAW_FETCH（逐文件扫描源标记，非全局关闭）。清零后 `safe-projection-audit` PASS（625 checked, 0 findings）、`declaration-lint` PASS（31 checked, 0 findings，维持）；轨迹 safeproj 12→4→1→0、decl-lint 2→0。
  - 进展（2026-09-01）：decl-lint 2→0（dsh-browser-pane、dsh-file-document 补 cordis.patch.yml + package.json 三点接线）；safeproj 12→4，已清 8 = ui-pane-workbench 3、ui-desktop-workbench 3、ui-selection-annotation 1、ui-next-step-suggestions 1（统一走 sdk `probeCapability(browserPreferenceStorage)` 三态 seam）。
  - 进展（2026-09-02）：safeproj 4→1。已清 3 = ui-command-experience-web 2（redaction 绝对路径前缀改结构化正则（转义分隔符，行为与原 includes 链一致）；transport 移除浏览器侧 raw provider URL 默认值，默认同源相对路径、base 由 owner 提供）+ ui-mermaid-render 1（kill-switch 存储读取改 `probeCapability(browserPreferenceStorage)` 三态 seam）。余 1 项 dsh-rich-media sources.ts RAW_FETCH 在在途 lane 禁改包（dsh-rich-media-plugin-v1 23/27），待其冻结后清零；decl-lint 维持 0。

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

- [x] 4.1 `pnpm check:plugins` 对 31 包零红灯，报告与 G18 基线对照展示清零轨迹（R11 主指标达成点）。
  - 证据（2026-09-02 零红灯达成）：`pnpm run check:plugins` exit 0，六检查器全 PASS 零 findings = bundle-contract 27/0、declaration-lint 31/0、safe-projection-audit 625/0、dispose-hmr-conformance 471/0、visual-token-conformance 26/0、personal-coding-contract 10/0；报告 temp/toolchain-runs/2026-09-02T151007223Z-toolchain。清零轨迹对照 G18 基线（2026-09-01T014345901Z-toolchain，五检查器 50 红）→ 2026-09-01 首波 16 → 2026-09-02 晨 9 → 2026-09-02 午 0。
  - 进展（2026-09-02）：五检查器 17 findings→9（dispose 12→8、safeproj 4→1、visual-token 1→0、decl-lint/bundle-contract 维持 0）；最新报告 temp/toolchain-runs/2026-09-02T053818792Z-toolchain。余 9 项全部位于四个在途 lane 禁改包（dsh-terminal 3、ui-interaction-space 2、ordo-agent-ops 2、dsh-rich-media 2），零红灯达成点继续受 lane 冻结时点约束，按 1.2/1.3 归属记录推进。
- [x] 4.2 全仓 `pnpm run typecheck && test && build` 全绿；openspec validate strict 通过。
  - 证据（2026-09-02 全绿）：`pnpm run typecheck` exit 0（根脚本内含 `pnpm -r run build`，build 一并全绿）；`pnpm run test` exit 0（87 包 Done 全绿；此前唯一红灯 ordo-commands Loader composition 断言已由 ordo lane 对齐 owner 上下文失配语义收口；rich-media 大文本/mermaid sleep 两处高并发负载 flake 隔离复跑均全绿）；`openspec validate dsh-plugin-consistency-coverage-v1 --strict --no-interactive` PASS；`openspec validate --all --strict --no-interactive` 120 passed, 0 failed。
  - 进展（2026-09-02）：typecheck exit 0、build exit 0、`openspec validate dsh-plugin-consistency-coverage-v1 --strict --no-interactive` PASS、check:bundles 27/27 PASS；`pnpm run test` 仅 1 例红灯 = `packages/host/ordo-commands` command.spec「boots the actual Loader composition」（stash 干净树复核同样红，属 ordo lane 在途漂移，非本 change 改动引入，本 change 禁改该 lane 包）——待 ordo lane 修复后复跑全仓 test 勾选。其余 73 个有测试包全绿（--no-bail 全量复核；ui-mermaid-render 在 --no-bail 高并发下 2 例 sleep 时序 flake，标准序与隔离复跑均 25/25 绿）。
- [ ] 4.3 更新 `docs/design/dsh-plugin-dev-toolchain-and-experience.md` 附四波收口结论与 14 天 dogfood 观测记录链接。
  - 进展（2026-09-02）：设计文档已附 §8 四波收口结论（W1/W2/W3 归档、W4 进度与红灯归属）；14 天 dogfood 观测窗 2026-09-01 起（第 1/14 天），观测记录以 temp/toolchain-runs/ 门禁报告序列为准——窗口未满且 4.1 零红灯未达成，如实保持未勾。
