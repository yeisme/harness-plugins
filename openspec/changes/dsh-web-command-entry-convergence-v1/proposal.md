## Why

grill-me 2026-08-31 决策（R2/R5）：dogfood 痛点四层中的「发现与入口」——31 个 bundle 装齐后入口散落在各 Modal、按钮与插件局部状态，无法形成可预测的「发现命令 → 执行 → 看结果」主路径。并行会话已建 `dsh-web-command-first-interaction-v1`（Composer slash Assist + 全局 Palette + 状态中枢），本 change 不重复造壳，只做消费侧收敛：把散落入口 additive 注册进其统一目录。

## What Changes

- 硬门：`dsh-web-command-first-interaction-v1` 冻结/归档后启动；本 change 只消费其 command directory、反馈链与 Pane handoff 合同，不修改其任何文件。
- 对 31 个 bundle 盘点散落入口（Modal 专属动作、面板按钮命令、面板局部状态入口），产出入口清单。
- 各插件入口 additive 注册进统一 slash+Palette 目录（canonical id、可用性、禁用原因、danger、handler owner 遵循 command-first 目录合同）；旧入口保留 probe-first fallback，不移除既有 surface。
- 插件热卸载后目录无陈旧行；命令执行反馈进入统一 receipt/Activity 链。

## Capabilities

### New Capabilities

- `dsh-web-command-entry-convergence`：入口盘点清单、additive 注册合同、旧入口 probe-first fallback、热卸载无陈旧行与统一反馈链。

### Modified Capabilities

无。command-first capability 的 requirement 归其 owner change；本 change 是纯消费侧。

## Impact

- 主要实现：具备命令性动作的 client 包（逐包 additive 注册）；`packages/bundle/*` 不改 patch 结构。
- 硬门依赖：`dsh-web-command-first-interaction-v1`（并行会话在途）冻结；未冻结前本 change 不启动实现。
- 兼容分类：additive——新目录贡献 + 旧入口 fallback；无移除、无重命名、无 wire breaking。
- 实现时点：G19 之后按序启动；本骨架 tasks 全不勾。
- 设计来源：`docs/design/dsh-plugin-dev-toolchain-and-experience.md` §Wave 3。
