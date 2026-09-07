## Why

Workbench 退役后，配音、音乐、音效、字幕与声音交接继续在 DSH Pane 内完成。Sonora 是声音工作流的 canonical owner；本变更只交付 DSH 侧声音台 Pane 与安全消费面。依据 `docs/design/dsh-creative-studio-program.md` 与 `docs/interfaces/dsh-creative-studio-contracts.md`。

## What Changes

- 新增 Sonora 声音台专业 Pane：workflow/subtitle/tts 能力发现、provider 声音与字幕能力矩阵、对齐与导出形态消费、声音成果交接。
- 以 Sonora workflow/subtitle/tts 命令合同为唯一消费面；先核对各 provider 声音/字幕/对齐能力与接入形态（现有 segment-to-cue 不等于 word-level alignment 或 SRT/VTT 导出），再冻结 consumer 合同。
- 声音成果按固定 owner/ref/version 回填画布与引用工作区；不建第二音频运行时。
- 本 change 只交付规格与任务；实现与真实声音闭环验收保持未完成。

## Required Capability Ledger

| 能力 | 状态 | canonical owner | 本切片 | 验收证据 |
| --- | --- | --- | --- | --- |
| workflow/subtitle/tts 动作 | required | cli/sonora | deliver-later（合同核对先行） | 合同冻结文档 + adapter 测试 |
| provider 声音/字幕/对齐能力矩阵 | required | cli/sonora | deliver-later | 能力矩阵（支持/缺失/未验证） |
| 字幕/对齐产物消费与导出 | required | cli/sonora | deliver-later | 导出/对齐断言 |
| 声音成果交接 | required | cli/sonora | deliver-later | 交接回执证据 |
| 真实配音/字幕闭环 | required | cli/sonora | 真实验收任务 | staging 证据（fixture/real 标注） |

## Capabilities

### New Capabilities

- `dsh-sonora-audio-studio`：Sonora 声音台 Pane 的安全只读声音投影、动作发现/预览、能力矩阵消费与交接。

### Modified Capabilities

无。

## Impact

拟用路径：`packages/client/ui-sonora-audio-studio`、`packages/host/sonora-audio-studio`、薄 bundle；先核对现有包可复用性。不复制音频运行时、字幕状态机或对齐真源。
