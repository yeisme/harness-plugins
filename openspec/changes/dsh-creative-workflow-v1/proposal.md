## Why

Workbench 退役后，可执行连接、范围预览与运行观察需要在 DSH 画布上继续。程序决定：单领域内部 workflow 用该 owner 原引擎，跨领域调度用 Ordo；浏览器/插件不新建执行循环。本变更只交付 DSH 侧执行连接编辑、计划预览与执行 owner 消费界面。依据 `docs/design/dsh-creative-studio-program.md` §3 与 `docs/interfaces/dsh-creative-studio-contracts.md`。

## What Changes

- 在项目画布上区分参考边与执行边：执行边明确输出版本与输入用途；连接时选择用途，不兼容保留草案并显示原因。
- 执行范围预览：单节点/选中分支/完整流程；分支=沿执行边可达下游；范围外输入无固定版本则列阻塞，不静默扩大范围。
- 确认预览冻结输入、参数、选定版本与计划摘要；预算 unknown 显式确认；人工审阅点暂停；范围/成本变化重新确认。
- 运行观察经 Ordo 计划适配：状态、进度、阻塞与恢复；上游修改标记受影响节点并保留已采用结果；重跑只产生新候选。
- 本 change 只交付规格与任务；实现与真实运行闭环验收保持未完成。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 执行图编辑（边/用途/兼容） | required | 本仓（呈现） | deliver-later | reducer 测试 |
| 范围预览与阻塞清单 | required | 本仓 + owner 输入版本 | deliver-later | 范围矩阵测试 |
| 计划冻结与确认 | required | 本仓 + Ordo | deliver-later | 冻结/重确认测试 |
| Ordo 计划适配与运行观察 | required | agent/ordo | deliver-later（依赖其 managed-work 面） | 适配合同测试 |
| 真实跨领域运行闭环 | required | agent/ordo + 领域 owner | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-creative-workflow`：执行连接编辑、范围预览、计划冻结与确认、Ordo 运行观察与恢复的 DSH 消费面。

### Modified Capabilities

无。画布 document 归属 `dsh-project-canvas-continuity-v1`；本 change 只消费其节点与引用，不建第二 graph document。

## Impact

拟用路径：`packages/client/ui-creative-workflow`（画布内嵌 + inspector）、`packages/host/creative-workflow`（Ordo 计划适配）；复用既有 dsh-ordo-agent-ops 投影。不创建 scheduler、task ledger 或第二执行循环。
