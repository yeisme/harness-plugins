## Why

harness-plugins 已有 31 个可安装 bundle，但质量检查只有 bundle 产物合同（`check:bundles`）一处机械化门：声明一致性、safe projection 红线、dispose/HMR 资源释放和视觉 token 使用全靠人肉评审与逐 change 手工验证。AGENTS.md 定义的 `packages/sdk|tool` 两层 0 落地。dogfood 日常使用中最痛的稳定性与跨插件一致性问题（grill-me 2026-08-31 决策 R2/R5/R9）缺少可持续的观测与门禁手段，导致同类问题（监听器泄漏、裸控件、声明漂移）在 V3 系列中被逐包重复发现、逐包手工修复。

本 change 建立一次性投入两用的机械化地基：tool 层把四类检查做成统一 `pnpm check:plugins` 入口（稳定性观测门 + 一致性工具同体），sdk 层收口 31 包重复的内部类型契约并用 contract 测试防漂移。首跑允许既有红灯——Wave 1 验收以「跑通 + 基线报告」为界，红灯清零归 G21。

## What Changes

- 新建 `packages/tool/dsh-plugin-toolchain`：统一入口 `pnpm check:plugins`，收编 `scripts/check-bundle-contracts.mjs`（保留 `check:bundles` 别名），含四个检查器：
  - declaration-lint：`dsh.bundle.patch` / `cordis.patch.yml` / `package.json` 三方声明一致性（包名、entry、依赖行只指向本仓插件行、workspace 边界）；
  - safe-projection-audit：host→client 导出面与 wire fixture 静态扫描，cookie/token/raw URL/绝对路径/任意 fetch 出投影即红灯；
  - dispose-hmr-conformance：mount/unmount/HMR 循环断言监听器、定时器、observer 与 host 订阅释放，把 V3 7.5 的 pane-workbench disposal 验证泛化为全包工具；
  - visual-token-conformance：ui-visual-kit token 使用率与 ys-field 裸控件检测。
- 新建 `packages/sdk/dsh-plugin-contracts`（内部定位，不承诺 semver）：收口 safe projection 类型、slot/capability probe helpers、dispose 合同；附 contract 测试，消费方类型与 sdk 声明不一致即红。
- tool 层只读 inspect 被测包、不修改 source；报告落 `temp/toolchain-runs/<date>/`，脱敏规则同集成证据。
- 验收为「对 31 包跑通并产出基线报告」：首跑既有红灯只量化、不阻塞本 change；红灯清零是 `dsh-plugin-consistency-coverage-v1`（G21）的完成判据。

## Capabilities

### New Capabilities

- `dsh-plugin-toolchain`：`pnpm check:plugins` 统一入口、四检查器语义、只读 inspect 边界、基线报告格式与首跑红灯处理。
- `dsh-plugin-contracts`：内部共享类型契约范围、contract 防漂移测试、无对外 semver 承诺的演进规则。

### Modified Capabilities

无。本 change 不触碰任何既有 capability 的 requirement；`check:bundles` 以别名形式保持原命令可用。

## Impact

- 主要实现：新增 `packages/tool/dsh-plugin-toolchain`、`packages/sdk/dsh-plugin-contracts`；`package.json` 增 `check:plugins` script；`scripts/check-bundle-contracts.mjs` 收编为 toolchain 子命令。
- 复用/消费：ui-visual-kit token 定义、`80e3382` web-surface 分类与 ys-field 合同、V3 7.5 disposal 测试模式、既有 `check-bundle-contracts` 逻辑。
- 不修改：任何 `packages/host|client|bundle` 现有包的 source（tool 层只读 inspect）；在途 V3/ordo/command-first 系列 change 一律不碰。
- 兼容分类：纯 additive；`check:bundles` 保持可用别名，CI 已有引用不受影响。
- 实现时点：在途 V3 系列收尾后启动（grill-me R8）；本骨架 tasks 全不勾。
- 设计来源：`docs/design/dsh-plugin-dev-toolchain-and-experience.md` §Wave 1（决策记录 R1–R12）。
