# Anatomia Reference Review（参考组件审阅面）

状态：`workbench-anatomia-reference-review-v1` 交付（2026-09-06）。根 change：`anatomia-production-reference-reuse-program-v1`（split-owner：播放器/覆盖层/risk queue/动作入口归 Workbench）。

## 是什么

- **typed 投影消费**：`WorkbenchClient.anatomiaReference`（`packages/task-sdk/src/anatomia-reference-client.ts`）经 Task 控制面读 `ProductionReference*` 投影（组件/gap/blocker/时间码），并提交 claim 审阅 decision。
- **播放器覆盖层**：`apps/web/src/workbench/agent/anatomia-reference/reference-overlay.tsx`——三类组件（人物外观/场景道具/动作镜头）、当前源对齐时间码、gap/risk 标注（文本+图标、键盘可达）、诚实降级（源/时钟不匹配、owner 不可用）。
- **审阅动作**：`workbench.anatomia_reference.claim.decide` → owner-approved action surface（anatomia `POST /api/v1/evidence-claims/{claim_ref}/decisions`，closed disposition 枚举 + expected_version + idempotency）；审阅只形成 owner 侧 decision，Workbench 不替 owner 签收。

## 边界

- 不读 Anatomia 数据库/私有文件；只调三个 allowlisted HTTP route（ownersec URL 策略）。
- 坐标锚定当前播放源（source_ref+media_clock_ref 双匹配）；源切换/时钟不匹配显式重新解析提示，不跨源外推。
- 无第二参考真源：session-scoped memoization，无 durable 缓存；覆盖层纯 props 消费。
- 服务端配置：`WORKBENCH_ANATOMIA_URL`/`WORKBENCH_ANATOMIA_TOKEN`（缺席 → operations ModeUnavailable，honest unavailable）。

## 验证

- Go：`service/internal/adapters/anatomia_reference_test.go`（投影 fail-closed、decision 封闭形状、unavailable 三态）。
- SDK：`packages/task-sdk/test/anatomia-reference-models.test.ts`（6/6）。
- 组件：`apps/web/test/anatomia-reference-overlay.test.tsx`（7/7：三类视图、三种 mismatch、owner 不可用、键盘可达、边界断言）。
