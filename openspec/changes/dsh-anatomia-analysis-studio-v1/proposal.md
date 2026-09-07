## Why

Workbench 退役后，视频分析、证据与参考提取工作继续在 DSH Pane 内完成。Anatomia 是视频观察与参考证据的 canonical owner；本变更只交付 DSH 侧分析台 Pane 与安全消费面。依据 `docs/design/dsh-creative-studio-program.md` 与 `docs/interfaces/dsh-creative-studio-contracts.md`。

## What Changes

- 新增 Anatomia 分析台专业 Pane：视频观察列表、时间坐标与关键帧访问、范围分析动作、审阅与固定版本参考包消费。
- 以 Anatomia 公共接口与视频观察合同为唯一消费面；先核对时间坐标、来源/关键帧访问、范围分析与参考包版本语义，再冻结 consumer 合同。
- 分析产出的参考引用按固定 owner/ref/version 回填画布与引用工作区；不建第二观察账本。
- 本 change 只交付规格与任务；实现与真实分析闭环验收保持未完成。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 视频观察与时间坐标 | required | agent/anatomia | deliver-later（合同核对先行） | 合同冻结文档 + adapter 测试 |
| 来源/关键帧授权访问 | required | agent/anatomia | deliver-later | 范围读取 adapter 单测 |
| 范围分析动作与回执 | required | agent/anatomia | deliver-later | 动作预览/回执测试 |
| 固定版本参考包消费 | required | agent/anatomia | deliver-later | 版本/stale 断言 |
| 真实分析/审阅闭环 | required | agent/anatomia | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-anatomia-analysis-studio`：Anatomia 分析台 Pane 的安全只读观察投影、范围分析动作、审阅与参考包消费。

### Modified Capabilities

无。

## Impact

拟用路径：`packages/client/ui-anatomia-analysis-studio`、`packages/host/anatomia-analysis-studio`、薄 bundle；先核对现有包可复用性。不复制观察状态机、媒体 blob 或证据真源。
