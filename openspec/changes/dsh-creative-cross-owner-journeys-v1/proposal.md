## Why

创作台程序按五个专业 Pane、画布与工作流分别交付；完整创作路径与跨项目故障恢复需要一份综合验收 change，验证组合行为而不是重复实现。依据 `docs/design/dsh-creative-studio-program.md` §1「综合验收」行与 `docs/interfaces/dsh-creative-studio-contracts.md` §6。

## What Changes

- 定义跨 owner 创作旅程验收：同一项目内画布→引用→专业 Pane→工作流→成果回填→关闭重开恢复的组合路径。
- 定义跨项目故障恢复演练：上游修改、版本冲突、运行 unknown、订阅 gap、seam 缺席、Pane 禁用/重装下的数据不串线不丢失。
- 各旅程证据引用所属 change 的验收任务，不重复实现；本 change 只拥有组合场景、演练矩阵与证据索引。
- 本 change 只交付规格与任务；实现与真实旅程验收保持未完成。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 组合旅程场景定义 | required | 本仓 | deliver-later | 旅程矩阵文档 |
| 跨项目故障演练矩阵 | required | 本仓 | deliver-later | 演练矩阵+脱敏证据 |
| 旅程证据索引与 readiness | required | 本仓 | deliver-later | 索引文档 |
| 真实多 owner 旅程执行 | required | 各 owner | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-creative-cross-owner-journeys`：跨 owner 创作旅程与故障恢复的组合验收合同与证据索引。

### Modified Capabilities

无。旅程成员行为由各自 capability 约束；本 change 不修改任何 owner 合同。

## Impact

拟用路径：`docs/design/dsh-creative-journeys-matrix.md`（矩阵与索引）+ 既有 evidence runner 任务；无新 package。旅程成员 change：dsh-project-canvas-continuity-v1、dsh-creative-workflow-v1、五个 studio change、dsh-prompt-reference-creative-workspace-v1。
