# DSH 引用动作与宿主题接入

本说明记录 `dsh-web-composer-references-theme-v1` 的插件侧接入边界。官方 DSH host 仍拥有亮色、暗色和系统偏好；插件不读取或保存主题偏好。

## 主题桥接

`ui-visual-kit` 的 `panelVar` 解析顺序固定为：项目 canonical override、官方 DSH alias、原 canonical fallback。这样已存在的 `--dsw-alias-text-primary` 等自定义主题继续优先，而官方 ThemeRuntime 仅提供 `label-primary`、`bg-overlay`、`interactive-bg-*`、`state-*-primary` 时，所有消费 `--vk-*` 的自有 surface 仍随 host 更新。

| Canonical token | 官方 host alias |
| --- | --- |
| `bg-elevated` | `bg-overlay` |
| `text-primary/secondary/tertiary/quaternary` | `label-primary/secondary/tertiary/caption` |
| `text-link` | `state-business-primary` |
| `border-focus`、`accent`、`state-info` | `state-business-primary` |
| `fill-hover/selected/active` | `interactive-bg-hover/interactive-bg-hover-accent/interactive-bg-active` |
| `state-error/positive/warn/neutral` | `state-error-primary/state-success-primary/state-warn-primary/label-tertiary` |

`bg-base`、`bg-layer-1`、`bg-layer-2`、`border-l1`、`border-l2` 与官方名称相同，保持单层 alias。

## 选区引用动作

`dsh:reference` 是 additive 的 canonical action；既有 `dsh:ask`、`dsh:comment`、`dsh:edit` 及所有旧 alias 不变。满足以下两个条件时，它在 text、source、image-region、table-range、editable-control 中都是主动作：

1. 宿主注入 `referenceBridge.target`，其中 `workspaceId` 和 `conversationId` 均非空；该目标来自 Conversation/Workspace owner，不能由 DOM 焦点推断。
2. 选区已经完成安全 anchor projection。

否则动作保留在 More 中并禁用，明确提示选择活动对话。点击后只 dispatch `dsh-composer-reference:add-to-main`，携带 version 1、captured target 与 selection reference；不自动发送或抢占输入焦点。consumer 必须重验 target、freshness 与 host seam，并以 `dsh-composer-reference:add-to-main-result` 回执。失败显示具体的已知原因和恢复提示；“错误信息 / Error output”仅为来源类型标签，不能当作运行失败。

## 验收边界

- 单元和集成测试覆盖 canonical→official→fallback 优先级、显式 target、reference receipt 与禁用原因。
- `tests/ui-visual` 提供 system light/dark 切换、fallback 和 canonical override 的浏览器切片，并覆盖 360/560/960 的 selection fixture。
- 该仓库的插件验收不等同于真实官方 DSH host 验收；host consumer 仍需在实际 profile 中重验结构化引用插入。
