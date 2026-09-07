# 04 · 既有 diff 实现清点与组件归属决策（task 4.7）

冻结时点：2026-09-05。范围：Screenplay Room、CLI pane、Replica Review、Text Studio。

## 清点结果

| 面 | 文件 | diff 形态 | 可复用的文本 diff 组件？ |
| --- | --- | --- | --- |
| Screenplay Room | `spatial/creative-production/screenplay-room/screenplay-room-surface.tsx` | 冲突面板的 server diff「入口」（compare/refetch 动作）+ change-set ghost 显示；无文本 diff 渲染体 | 否 |
| CLI pane | `panes/cli/**` | 无 diff 面 | 否 |
| Replica Review | `spatial/replica-review/replica-proposal.tsx` | proposal 卡片的 diff 字段是 metadata 引用（`actionId @ expectedOwnerVersion`），非文本 diff | 否 |
| Text Studio | `text-development/document-candidate-compare.tsx`（4.5）+ `inline-patch-review.tsx`（4.4） | 唯一真实文本 diff 渲染：split（source/rendered 双栏）+ unified（+/- 行）+ inline（hunk 列表） | 是（本仓唯一） |

## 决策

**保持 feature-local（`TextCandidateReview` 族），不晋级全局 `DiffView` composite。**

依据（任务规则：至少两个真实调用方才晋级全局组件）：

1. 当前只有 Text Studio 一个真实文本 diff 调用方；其余三面分别是 metadata 引用、动作入口或不存在。
2. 三种形态（inline/split/unified）的消费语义与候选合同绑定（base revision/digest、changedRanges、provenance），抽公共组件会引入与候选无关的耦合面。
3. 组件不持有 owner state：`document-candidate-compare.tsx` 与 `inline-patch-review.tsx` 均为纯 props 投影（数据来自显式 compare 的 owner 投影，决策经 authority port），无内部 owner 真值副本。

晋级条件（未来重评）：第二个真实调用方出现（例如 Screenplay 冲突面板落地实际文本 diff 渲染，或 Versions deck 需要 checkpoint 对比）时，以既有 inline/split/unified 合同为基底评估共享 `DiffView`；届时须新开 OpenSpec change 而非顺手重构。
