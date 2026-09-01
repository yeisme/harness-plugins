## Why

grill-me 2026-08-31 决策（R5/R6/R11）：跨插件一致性收尾与内部插件生态薄收口放在地基（G18）与真实数据（G19）、入口收敛（G20）之后。G18 的 `pnpm check:plugins` 首跑只产出基线红灯；本 change 负责把 visual-token 与 dispose 红灯清零至「31 包零红灯」，并按内部定位薄做 catalog（静态清单）与 example（单个参考插件），不建对外平台。

## What Changes

- visual-token-conformance 红灯清零：剩余包按 ui-visual-kit token 与 ys-field 合同修复至零红灯（五个已分类包不回退）。
- dispose-hmr-conformance 基线红灯按观测门结果定点修复（R9 观测门的消费波次）。
- 新建 `packages/catalog/dsh-plugin-catalog`：静态插件目录清单 + 本地查询工具；不建网络服务、不收集遥测。
- 新建 `packages/example/dsh-plugin-example`：1 个参考插件，展示 host+client+bundle 三层最小结构与 probe-first 降级写法；可在干净 profile 安装运行。
- 验收即 R11 主指标达成点：`pnpm check:plugins` 31 包零红灯。

## Capabilities

### New Capabilities

- `dsh-plugin-consistency-coverage`：visual-token/dispose 红灯清零门禁、catalog 静态清单边界、example 参考插件要求。

### Modified Capabilities

无。toolchain 检查器语义归 `dsh-plugin-toolchain`；本 change 只消费其报告并修复被测包。

## Impact

- 主要实现：G18 基线报告中的红灯包逐批修复；新增 `packages/catalog/dsh-plugin-catalog`、`packages/example/dsh-plugin-example`。
- 硬门依赖：G18（`dsh-plugin-dev-toolchain-v1`）归档产出基线报告。
- 兼容分类：修复为包内 additive/等价重构；catalog 与 example 为全新包；不改既有 capability requirement。
- 实现时点：G20 之后按序启动；本骨架 tasks 全不勾。
- 设计来源：`docs/design/dsh-plugin-dev-toolchain-and-experience.md` §Wave 4。
