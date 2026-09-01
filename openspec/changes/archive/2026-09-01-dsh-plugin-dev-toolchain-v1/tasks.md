> 状态：实现中（2026-09-01 Wave 1 启动：R8 硬门达成判读见设计文档 §6.4——V3 本地已尽、剩项全外部停车；§1–§6 已实现，§7 全量门进行中）。

## 1. 工具链骨架与入口

- [x] 1.1 新建 `packages/tool/dsh-plugin-toolchain` 包骨架（tsdown bundling、tsc 类型输出、workspace 接线），CI 中保持独立可运行。
  Evidence (2026-09-01): `packages/tool/dsh-plugin-toolchain`（tsdown ESM + dts、tsc 类型门、workspace 接线 + root devDependency）；包内 vitest 22/22，经 `pnpm -r` 进 CI 既有 typecheck/test/build 流程。
- [x] 1.2 将 `scripts/check-bundle-contracts.mjs` 收编为 toolchain 的 bundle-contract 子命令，`check:bundles` 保持为可用别名，现有 CI 引用零修改。
  Evidence (2026-09-01): `scripts/check-bundle-contracts.mjs` 改为薄委托（实现移入 toolchain `runBundleContractCheck`，语义逐字保留）；实测 `pnpm check:bundles` 输出 `BUNDLE CONTRACTS: 27/27 PASS` exit 0，CI 引用零修改。
- [x] 1.3 增加统一入口 `pnpm check:plugins`：顺序执行五类检查、逐包汇总结果、区分「检查器内部错误」与「检查发现红灯」的退出码语义。
  Evidence (2026-09-01): `pnpm check:plugins`（scripts/check-plugins.mjs → toolchain CLI）：五检查器顺序执行、逐包汇总；退出码 0/1（红灯）/2（检查器内部错误）三态，`--baseline` 降级红灯为记录；`--only`/`--report-root`/`--no-report` 支持。
- [x] 1.4 定义并落盘基线报告格式到 `temp/toolchain-runs/<date>/`（逐包逐检查器、红灯定位、脱敏规则同集成证据）。
  Evidence (2026-09-01): 报告落 `temp/toolchain-runs/<runId>/{report.json,report.md}`：逐检查器逐包定位（仓库相对路径+行号+稳定红灯码），不回显字段值；CLI 汇总行含 checked/findings/duration。

## 2. declaration-lint

- [x] 2.1 实现 `dsh.bundle.patch` / `cordis.patch.yml` / `package.json` 三方一致性校验：包名与 entry 对应、依赖行只指向本仓插件行或允许的外部依赖、workspace 边界不越层。
  Evidence (2026-09-01): declaration-lint 实现：磁盘核验 30/30 bundle 均为 `cordis.patch.yml`+`package.json` 双文件形态（无 `dsh.bundle.patch`，已记录）；行名必须命中本包导出（含 `/host` 子路径形态）、跨包 insert id 唯一、@yeisme 依赖可解析（workspace:* 或已发布 pin 均合法，pin 记 note）、层规则 host→client 红灯 + client→bundle/bundle→bundle 记 note（2026-09-01 基线校准：后者为仓内既定组合形态）。
- [x] 2.2 红灯输出文件与行级定位；对现有 31 包首跑收集基线红灯并写入报告。
  Evidence (2026-09-01): 行级定位（DECL/* 红灯码 + 文件:行）；31 包首跑基线：30 bundle、2 红灯（dsh-browser-pane/dsh-file-document PATCH_MISSING，属实）+ 30 条 note（21 bundle→bundle、9 client→bundle、已发布 pin 记录）；报告 `temp/toolchain-runs/2026-09-01T014345901Z-toolchain/`。

## 3. safe-projection-audit

- [x] 3.1 实现 host→client 导出面静态扫描：cookie/token/raw URL/绝对路径/任意 fetch 出投影即红灯，只报告形状定位不输出字段值。
  Evidence (2026-09-01): safe-projection-audit 实现：client/bundle src 浏览器侧红线访问（document.cookie/storage/fetch/绝对路径字面量/非本地 URL）+ host 导出类型敏感命名字段（SAFEPROJ/PROJECTION_FIELD）静态扫描，只报形状定位不回显值；fixture 测试钉住脱敏断言。
- [x] 3.2 扫描 wire fixture 与类型导出两面；只读 inspect，不改任何被测包 source。
  Evidence (2026-09-01): wire fixture（fixtures/ 与 *.fixture.*）扫描两面齐；只读 inspect 零 source 修改。首跑基线：597 文件 12 红灯（10 storage 访问+2 URL 字面量，全部为观测点待 owner 复核，清零归 G21）。

## 4. dispose-hmr-conformance（R9 观测门）

- [x] 4.1 把 V3 7.5 的 pane-workbench disposal 验证泛化为通用 mount/unmount/HMR 循环 harness。
  Evidence (2026-09-01): dispose-hmr-conformance：把 V3 7.5 disposal 验证泛化为全包静态释放对称性 harness（V3 7.5 为 registry slot/observer/订阅源级钉住，本检查器同源泛化），四类资源（listener/interval/observer/host 订阅）acquire vs release 逐文件计数。
- [x] 4.2 断言事件监听器、定时器、ResizeObserver/MutationObserver、host 订阅四类资源释放，逐包给出释放明细。
  Evidence (2026-09-01): 两档红灯：NO_RELEASE_PATH（有 acquire、released<acquired 且全文无释放标记）/ COUNT_ASYMMETRY（有释放路径但计数不配对，跨模块释放可能）；配平（内联 remove）不报。逐文件释放明细入报告。
- [x] 4.3 对 31 个 client 相关包首跑收集释放基线；红灯清单作为后续波次定点修复输入。
  Evidence (2026-09-01): 31 个 client/bundle 相关包首跑：449 文件 36 红灯（观测点清单已入基线报告，含 session-tags provider×4、pane-workbench client.ts 等强信号项，作为 G21 定点修复输入）。

## 5. visual-token-conformance

- [x] 5.1 基于 ui-visual-kit token 定义与 ys-field 合同（80e3382 分类）实现 token 使用率与裸控件检测。
  Evidence (2026-09-01): visual-token-conformance：子进程复用 `check:surfaces`（80e3382 分类账本单一 owner 不复制，VT/SURFACE_REGRESSION 回收其错误行）+ 新增 `--vk-/--dsw-` token 引用 vs 裸色值使用率分析。
- [x] 5.2 对五个已分类 web-surface 包校验既有分类不回退；其余包首跑只记基线不清零。
  Evidence (2026-09-01): `--allow-pending` 下 surfaces 门全绿（五分类包不回退）；26 包 token-rate 记 note 基线（无阈值不清零，阈值化归 G21）。首跑 PASS 0 红灯。

## 6. sdk 内部契约

- [x] 6.1 新建 `packages/sdk/dsh-plugin-contracts`：收口 safe projection 类型、slot/capability probe helpers、dispose 合同；README 明示内部定位、不承诺 semver。
  Evidence (2026-09-01): `packages/sdk/dsh-plugin-contracts`：projection（ProjectionFreshness 三态/SafeProjectionMeta/BoundedSummary）+ probe（probeCapability 三态：undefined→needs_contract、抛错→unavailable 附脱敏 reason）+ dispose（Disposable/Disposer/SubscribeFace/composeDisposers 幂等组合）；README 明示内部定位不承诺 semver。
- [x] 6.2 实现三类 contract 防漂移测试（projection 类型、probe helper 签名、dispose 合同）并在 CI 运行。
  Evidence (2026-09-01): contract 防漂移测试 8/8（形状冻结 expectTypeOf + probe 三态/disposer 幂等行为），随包 `pnpm test` 进 CI；消费试点自身 typecheck 构成第二层漂移网。
- [x] 6.3 挑选 2–3 个消费包试点改用 sdk 契约，验证替换语义等价；全量迁移不在本 change 范围。
  Evidence (2026-09-01): 三个干净包试点（避开并行会话脏包）：ui-pane-domain（DomainOwnerSourceService extends Disposable + subscribe→Disposer）、ui-next-step-suggestions（registerSource→Disposer）、ui-session-tags（SessionTagsController implements Disposable）；三包 typecheck/test/build 全绿（109/33/56 tests），替换语义等价（纯类型层，零运行时变更）；全量迁移不在本 change 范围。

## 7. 验证与证据

- [x] 7.1 `pnpm check:plugins` 对 31 包跑通并产出首份基线报告（首跑允许既有红灯）。
  Evidence (2026-09-01): 首份基线报告 `temp/toolchain-runs/2026-09-01T014345901Z-toolchain/`（report.json+report.md）：bundle-contract 27/27 PASS、declaration-lint 2 红、safe-projection 12 红、dispose-hmr 36 红、visual-token PASS——合计 50 基线红灯，首跑允许（R9 观测门），清零归 G21。
- [x] 7.2 `pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles` 全绿；openspec validate strict 通过。
  Evidence (2026-09-01): 全仓门禁 2026-09-01：`pnpm run typecheck`（build+typecheck 全 33 包）exit 0；`pnpm run test` exit 0；`pnpm run build` exit 0；`pnpm run check:bundles` 27/27 PASS；`pnpm run doc-sync` 6/6；`git diff --check` 干净；`openspec validate dsh-plugin-dev-toolchain-v1 --strict --no-interactive` PASS。
- [x] 7.3 更新 `docs/design/dsh-plugin-dev-toolchain-and-experience.md` §Wave 1 附基线红灯量化结论。
  Evidence (2026-09-01): 设计文档 §3 Wave 1 增「Wave 1 基线结论」表：五检查器覆盖/红灯/基线要点 + 50 红灯构成与清零轨迹归属（G18 基线对照 → G21）。
