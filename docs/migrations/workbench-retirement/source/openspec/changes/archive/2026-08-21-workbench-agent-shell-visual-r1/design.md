## Context

`/agent` 主壳的视觉目标已在 `docs/design/agent-visual-language.md` 定义（当前为未提交文件，随本 change 一并入库）。现状盘点（改造前实测）：

- `conversation/conversation-blocks.tsx`：run/proposal 卡已是发丝线区段（合规），但状态徽章是 8px 方块 icon tile（:174）、kind 徽章是底色 pill（:209）、basis refs 是底色块 chip（:214）、StateBanner 是 border+bg 横幅（:26-29）、thinking/tool 行 `px-3 py-2` ≈32px 行高（:97-161）。
- `conversation/session-rail.tsx`：选中行圆角色块+box-shadow 模拟左条（:117）、行 `px-3 py-3`、未读徽章实心 accent pill（:123）、attention chip 描边 pill（:128）、过滤器手写 aria-pressed 按钮组（:86-92）。
- `conversation/composer.tsx`：容器 `rounded-2xl`（16px）贴底（:55-56）、tool chips 底色 pill（:57）、上下文 chips 绿/灰底 pill（:61）、context 按钮底色 pill（:69）；textarea 与按钮未走 primitive。
- `conversation/conversation-header.tsx`：按钮已是幽灵形态，但 `rounded-lg`（8px）且未走 primitive。
- `panes/agent-pane-host.tsx`：RunPane 摘要卡（:106）、事件流行盒（:126）、unknown_accept 卡（:137）、lastContextPack 卡（:88）、expectedVersions 行盒（:151）均为 border+bg+radius 方块。
- lucide 直接 import：`panes/agent-pane-icon.tsx`、`agent-pane-host.tsx`、`pane-command-palette.tsx`、`agent-pane-dock.tsx`。
- `agent-ops-*` 遗留空间壳（activity-rail/output-capsule/object-inspector）不在 `/agent` 活路径（`agent-conversation-workspace.tsx` 未引用），本 change 不动。

测试约束：`apps/web/test/agent-conversation-workspace.test.tsx` 等密集断言 aria/data 选择器（`data-agent-composer`、`data-block-kind`、`aria-pressed` 等），无 class 断言——视觉层有改动自由，但选择器与可访问名必须逐字保持。

## 决策

### D1 纯视觉层改动，选择器冻结

只改样式（Tailwind arbitrary 值/类）与控件换源，不改 DOM 结构的 aria/data 属性、不改 i18n key、不改组件 props 对外签名（内部可换 primitive）。验收测试因此应零断言改动或仅视觉相关改动。

### D2 逐区域目标形态（裁决依据 agent-visual-language.md §1/§2/§6）

| 区域 | 现状 | 目标 |
| --- | --- | --- |
| StateBanner | border+bg 横幅、状态色底 5% | 细线分隔+状态色文字/小色点，无大面积底色 |
| 状态/kind 徽章 | 方块 tile / 底色 pill | 色点+文字 或 发丝底 pill（优先复用 `StatusChip`） |
| basis/context chips | 底色块 | 发丝底 pill 或色点+文字 |
| thinking/tool 行 | ~32px 行高 | 24px 行节奏（py 压实） |
| session rail 选中行 | 圆角色块+shadow 左条 | border-l-2 accent 左条+浅底、去圆角块 |
| 未读徽章 | 实心 accent pill | 色点+数字 |
| rail 过滤器 | 手写 aria-pressed 组 | `SegmentedControl` |
| composer 容器 | rounded-2xl 贴底 | rounded-xl(12px)+细边+轻阴影浮起（视觉语言 §1 允许 composer 浮起） |
| header/pane 按钮 | 手写幽灵/描边按钮 | `Button`/`IconButton` primitive（ghost variant），radius 6–8px |
| pane host 方块卡 | rounded-xl border bg | 发丝线区段+语义左色条（proposal 已有先例 border-l-2） |
| 图标 | 4 文件直接 lucide | icons registry（缺名按 pane.*/action.* 分组补） |

### D3 不改运行时语义

诚实性状态（needs_contract/unknown_accept）的显示语义不得弱化；running shimmer 保留 `motion-safe`；reduced-motion 降级不变。

## 验收

1. 截图对比：/agent 主壳 1440/1024/390 三视口 before/after，逐区域确认无大方框、无渐变/玻璃、行节奏一致；证据存 `temp/`（gitignored）。
2. `apps/web/test/agent-conversation-workspace.test.tsx`、`agent-pane-dock.test.tsx` 等既有测试零选择器改动通过（允许因控件换源产生的角色断言更新，如过滤器 button→radio）。
3. 全量 vitest、design-system 套件、foundation-contract、e2e（agent-first/foundation-gallery）绿（HEAD 已知失败除外）。
4. UI Spec §8 视觉黑名单逐项过审，结论写入本 change 的 review 记录。
