## Why

Workbench 退役后，小说、剧本和文本版本工作继续在 DSH Pane 内完成。Auctra 是文本创作与版本链的 canonical owner；本变更只交付 DSH 侧文本台 Pane 与安全消费面。依据 `docs/design/dsh-creative-studio-program.md` 与 `docs/interfaces/dsh-creative-studio-contracts.md`。

## What Changes

- 新增 Auctra 文本台专业 Pane：文本项目列表、各文本类型结构映射、编辑正文授权读取、候选与版本链、保存与冲突恢复。
- 以 Auctra Service API 与 text working copy 合同为唯一消费面；先核对各文本类型结构映射与授权读取语义，再冻结 consumer 合同。
- Agent 对正文的修改走 owner candidate 通道（程序 §4），不进插件草稿；与既有引用工作区的可编辑提示词正文互不复制。
- 本 change 只交付规格与任务；实现与真实写作闭环验收保持未完成。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| 文本项目/结构映射 | required | cli/auctra | deliver-later（合同核对先行） | 合同冻结文档 + adapter 测试 |
| 编辑正文授权读取 | required | cli/auctra | deliver-later | 授权范围单测 |
| 候选与版本链/冲突恢复 | required | cli/auctra | deliver-later | 冲突负向测试 |
| 保存/写回回执 | required | cli/auctra | deliver-later | receipt 断言 |
| 真实写作/保存闭环 | required | cli/auctra | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-auctra-writing-studio`：Auctra 文本台 Pane 的安全文本投影、授权读取、候选/版本链消费与保存冲突恢复。

### Modified Capabilities

无。

## Impact

拟用路径：`packages/client/ui-auctra-writing-studio`、`packages/host/auctra-writing-studio`、薄 bundle；先核对现有包可复用性。不复制正文存储、版本状态机或 Canon 规则。

## 页面与范围补全

所有页面与能力均为required：[页面控件设计](../../../docs/design/dsh-auctra-writing-studio.md)。遮罩/音乐/字幕等具体模型或provider能力的未验证状态不构成需求删除。第5组tasks补全页面、原型、owner缺口与恢复；第4组closeout必须依赖它们。
