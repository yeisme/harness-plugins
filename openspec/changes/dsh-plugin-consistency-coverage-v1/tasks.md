> 状态：骨架（2026-08-31 设计定稿；硬门 = G18 归档产出基线报告，且排队于 G20 之后；全任务未启动）。

## 1. 红灯清零

- [ ] 1.1 以 G18 基线报告为准，逐批修复 visual-token-conformance 红灯（裸控件 → ys-field/visual-kit 等价替换），五个已分类包不回退。
- [ ] 1.2 按观测门结果定点修复 dispose-hmr-conformance 红灯（监听器/定时器/observer/订阅释放补齐）。
- [ ] 1.3 清零 declaration-lint 与 safe-projection-audit 基线红灯。

## 2. catalog 薄做

- [ ] 2.1 新建 `packages/catalog/dsh-plugin-catalog`：构建工具从仓库包生成静态清单 + 本地查询 CLI；无网络服务、无遥测、不建第二 registry。
- [ ] 2.2 清单覆盖全部可安装 bundle；新增 bundle 重建即含，不需手工登记。

## 3. example 参考插件

- [ ] 3.1 新建 `packages/example/dsh-plugin-example`：host+client+bundle 三层最小结构 + probe-first 降级写法；不接管 core state、不加运行时依赖。
- [ ] 3.2 干净 web profile `dsh plugin add` 安装运行验证；seam 缺失时显示禁用与原因。

## 4. 验证与证据

- [ ] 4.1 `pnpm check:plugins` 对 31 包零红灯，报告与 G18 基线对照展示清零轨迹（R11 主指标达成点）。
- [ ] 4.2 全仓 `pnpm run typecheck && test && build` 全绿；openspec validate strict 通过。
- [ ] 4.3 更新 `docs/design/dsh-plugin-dev-toolchain-and-experience.md` 附四波收口结论与 14 天 dogfood 观测记录链接。
