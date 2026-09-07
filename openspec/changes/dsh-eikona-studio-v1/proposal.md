## Why

Workbench 退役后，图像生成、修改与资产工作必须继续在 DSH Pane 内完成。Eikona 是图像生成的 canonical owner；本变更只交付 DSH 侧生成台 Pane 与安全消费面，不复制其 provider 运行时、资产账本或版本真相。依据 `docs/design/dsh-creative-studio-program.md` 与 `docs/interfaces/dsh-creative-studio-contracts.md`。

## What Changes

- 新增 Eikona 生成台专业 Pane：项目/资产列表、生成与编辑动作发现、候选比较与采纳、资产引用回填共用画布与引用工作区。
- 以 Eikona 既有 generation/workflow/batch/asset/lineage/handoff 公共合同为唯一消费面；先核对遮罩/编辑动作模型支持、候选映射与项目列表，再冻结 consumer 合同。
- 复用 `dsh-prompt-reference-creative-workspace-v1` 的候选/采用/写回通道与 `dsh-project-canvas-continuity-v1` 的节点绑定，不建第二份资产缓存权威。
- 本 change 只交付规格与任务；实现与真实生成闭环验收保持未完成，不继承任何旧 Workbench 证据。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 图像生成/编辑/批量动作 | required | cli/eikona | deliver-later（合同核对先行） | owner 合同冻结文档 + adapter 测试 |
| 项目与资产列表（分页/freshness） | required | cli/eikona | deliver-later | 列表 adapter 单测 |
| 候选映射与采纳回执 | required | cli/eikona + 本仓工作区 | 复用既有 | 复用 change 证据引用 |
| 遮罩/局部编辑模型支持 | to-verify | cli/eikona | 合同核对任务 | 支持矩阵（支持/缺失/未验证） |
| 真实生成/取消/交接 | required | cli/eikona | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-eikona-studio`：Eikona 生成台 Pane 的安全只读投影、动作发现/预览、候选消费与资产引用回填。

### Modified Capabilities

无。既有 Eikona 公共合同、Pane 宿主与引用合同保持原义。

## Impact

拟用路径：`packages/client/ui-eikona-studio`、`packages/host/eikona-studio`、薄 bundle；在脚手架生成前先核对现有包可复用性。不创建第二 provider 运行时、资产账本或版本状态机。
