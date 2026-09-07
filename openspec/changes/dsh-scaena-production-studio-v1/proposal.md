## Why

Workbench 退役后，镜头级制作、编排与交付继续在 DSH Pane 内完成。Scaena 是制作运行与交付的 canonical owner；本变更只交付 DSH 侧制作台 Pane 与安全消费面。依据 `docs/design/dsh-creative-studio-program.md` 与 `docs/interfaces/dsh-creative-studio-contracts.md`。

## What Changes

- 新增 Scaena 制作台专业 Pane：制作项目与镜头/资产/声音动作、候选 expected version/digest 校验、编排预览与导出交付。
- 以 Scaena Production API 与 review-package application/transport 合同为唯一消费面；先核对镜头/资产/声音动作模型与导出语义，再冻结 consumer 合同。
- 跨领域编排经 `dsh-creative-workflow-v1` 的 Ordo 通道，不在本 change 重复实现。
- 本 change 只交付规格与任务；实现与真实制作闭环验收保持未完成。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 制作项目与镜头/资产/声音动作 | required | agent/scaena | deliver-later（合同核对先行） | 合同冻结文档 + adapter 测试 |
| 候选 expected version/digest | required | agent/scaena | deliver-later | CAS 负向测试 |
| 编排预览与实际导出 | required | agent/scaena | deliver-later | 导出回执证据 |
| review-package 消费 | required | agent/scaena | deliver-later | 版本/传输断言 |
| 真实制作/导出闭环 | required | agent/scaena | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-scaena-production-studio`：Scaena 制作台 Pane 的安全只读制作投影、动作发现/预览、候选 CAS 与导出交付消费。

### Modified Capabilities

无。

## Impact

拟用路径：`packages/client/ui-scaena-production-studio`、`packages/host/scaena-production-studio`、薄 bundle；先核对现有包可复用性。不复制制作状态机、镜头账本或交付真源。
