# workbench-anatomia-reference-review-v1

## Why

根仓 `anatomia-production-reference-reuse-program-v1`（design + handoffs.md）把视觉审阅定义为 required 能力：用户需要在播放器中定位参考组件、查看 gap/risk、覆盖时间码并执行审阅动作。该根 change 明确 Workbench 是这个面的 split-owner——"只消费 typed projections/actions，无新客户端真源"，且本轮只建立本地规格。

Workbench 已有 spatial-replica owner panels/actions、player 与 review 队列基础；本 change 只追加 Anatomia 参考组件的投影消费与审阅入口，不读 owner 数据库，不建立第二份参考真源。

## What Changes

- 定义 Anatomia 参考组件/gap/risk/时间码/动作的 typed projection 消费合同与坐标变换一致性要求（当前源与时间轴）。
- 定义播放器定位、覆盖层与审阅操作：键盘可达、不确定状态不只靠颜色表达。
- 定义动作边界：审阅动作走 owner-approved action surface（Anatomia 局部审阅/修正），Workbench 不替 owner 签收。
- 定义失败语义：owner 不可用/stale/坐标不匹配时诚实降级，不渲染猜测状态。

## Impact

- 新 capability `workbench-anatomia-reference-review`（ADDED requirements）。
- 复用既有 owner-actions/panels 管线；additive、opt-in，对既有面板零影响。
- 本 change 为规格冻结；implementation checkbox 保持未完成。
