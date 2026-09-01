> 状态：骨架（2026-08-31 设计定稿；实现排队于在途 V3 系列收尾之后，全任务未启动）。

## 1. 工具链骨架与入口

- [ ] 1.1 新建 `packages/tool/dsh-plugin-toolchain` 包骨架（tsdown bundling、tsc 类型输出、workspace 接线），CI 中保持独立可运行。
- [ ] 1.2 将 `scripts/check-bundle-contracts.mjs` 收编为 toolchain 的 bundle-contract 子命令，`check:bundles` 保持为可用别名，现有 CI 引用零修改。
- [ ] 1.3 增加统一入口 `pnpm check:plugins`：顺序执行五类检查、逐包汇总结果、区分「检查器内部错误」与「检查发现红灯」的退出码语义。
- [ ] 1.4 定义并落盘基线报告格式到 `temp/toolchain-runs/<date>/`（逐包逐检查器、红灯定位、脱敏规则同集成证据）。

## 2. declaration-lint

- [ ] 2.1 实现 `dsh.bundle.patch` / `cordis.patch.yml` / `package.json` 三方一致性校验：包名与 entry 对应、依赖行只指向本仓插件行或允许的外部依赖、workspace 边界不越层。
- [ ] 2.2 红灯输出文件与行级定位；对现有 31 包首跑收集基线红灯并写入报告。

## 3. safe-projection-audit

- [ ] 3.1 实现 host→client 导出面静态扫描：cookie/token/raw URL/绝对路径/任意 fetch 出投影即红灯，只报告形状定位不输出字段值。
- [ ] 3.2 扫描 wire fixture 与类型导出两面；只读 inspect，不改任何被测包 source。

## 4. dispose-hmr-conformance（R9 观测门）

- [ ] 4.1 把 V3 7.5 的 pane-workbench disposal 验证泛化为通用 mount/unmount/HMR 循环 harness。
- [ ] 4.2 断言事件监听器、定时器、ResizeObserver/MutationObserver、host 订阅四类资源释放，逐包给出释放明细。
- [ ] 4.3 对 31 个 client 相关包首跑收集释放基线；红灯清单作为后续波次定点修复输入。

## 5. visual-token-conformance

- [ ] 5.1 基于 ui-visual-kit token 定义与 ys-field 合同（80e3382 分类）实现 token 使用率与裸控件检测。
- [ ] 5.2 对五个已分类 web-surface 包校验既有分类不回退；其余包首跑只记基线不清零。

## 6. sdk 内部契约

- [ ] 6.1 新建 `packages/sdk/dsh-plugin-contracts`：收口 safe projection 类型、slot/capability probe helpers、dispose 合同；README 明示内部定位、不承诺 semver。
- [ ] 6.2 实现三类 contract 防漂移测试（projection 类型、probe helper 签名、dispose 合同）并在 CI 运行。
- [ ] 6.3 挑选 2–3 个消费包试点改用 sdk 契约，验证替换语义等价；全量迁移不在本 change 范围。

## 7. 验证与证据

- [ ] 7.1 `pnpm check:plugins` 对 31 包跑通并产出首份基线报告（首跑允许既有红灯）。
- [ ] 7.2 `pnpm run typecheck && pnpm run test && pnpm run build && pnpm run check:bundles` 全绿；openspec validate strict 通过。
- [ ] 7.3 更新 `docs/design/dsh-plugin-dev-toolchain-and-experience.md` §Wave 1 附基线红灯量化结论。
