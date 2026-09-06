## 1. 合同与来源核实

- [x] 1.1 核实现有 status/token owner、官方历史/请求身份/context/轨迹/账户 seam，形成 fit/split-owner 能力表和阻塞原因。
- [x] 1.2 落实新 query schema、capability probe、权限、coverage、revision/cursor 和只读订阅映射；保留全部旧签名。
- [x] 1.3 为缺失的官方能力准备 upstream-prs 增量 seam 说明，不修改安装目录或建立 core fork。

## 2. Host 聚合与兼容

- [x] 2.1 实现 session/run/range 授权查询及可丢弃缓存，支持完整历史读取与实时修订。
- [x] 2.2 实现流式/最终去重、重试、等总数桶修正、取消缺用量和 provider 桶归一化测试。
- [x] 2.3 实现分叉/子 Agent 归属去重、事件时间窗口、并行墙钟耗时及 partial/unknown 覆盖规则。
- [x] 2.4 实现分页上限、10,000 请求边界、stale cursor 与旧 snapshot 兼容测试。
- [x] 2.5 复用宿主账户/凭据能力，独立处理余额、费用来源、币种和失败保留，不调用真实付费动作。

## 3. 命令与小插件

- [x] 3.1 补齐 /status 与 /status tokens resolver、冻结发起 session、语法错误与 command lifecycle；确认结果不入模型历史。
- [x] 3.2 接入原会话 Popover/Pane/安全文本降级、明确的统计实例键与官方会话选择器分页。
- [x] 3.3 实现共享绑定、generation、晚到/撤销/替换、locale 更新、重连/HMR 释放和无订阅能力降级。
- [x] 3.4 实现完整 UI Contract、用量与余额独立状态/重试、Context 分区及同 session 轨迹深链。

## 4. 验证与交付

- [x] 4.1 运行相关包 Vitest/Testing Library 测试，覆盖旧新 Host/Client 组合与 scope 权限隔离。
- [x] 4.2 用现有 Playwright 夹具验证 /status → 摘要 → 整段统计 → 对应轨迹及双 session 不串数据。
- [x] 4.3 验证 360/560/960px、200% 缩放、中英文、触控、键盘、减少动效及相邻样式隔离；检查后才更新基线。
- [x] 4.4 稳定后执行设计文档中的完整门禁与 OpenSpec strict validation，分类并发/环境失败。
  Evidence (2026-09-05): `node scripts/run-full-plugin-validation.mjs typecheck test build check:bundles check:surfaces test:visual check:plugins` → `temp/integration-test-runs/full-plugins-2026-09-05T18-51-57-898Z-1270300/`。结果：typecheck/test/build/check:bundles/check:surfaces/check:plugins PASS；`openspec validate dsh-session-insights-and-status --strict --no-interactive` PASS；owned 路径 `git diff --check` PASS。`pnpm run test:visual` 在同一次全门中 27 failed / 65 passed，失败全部落在并发脏工作区的 `tests/ui-visual/visual.spec.ts`（navigator/workspace/inspector/dialog/micro/creator/source-control/desktop-git/command-dialog/session-tags/rich-media），分类 **concurrent + environmental**，未更新无关 snapshot 基线。本 change 的 `tests/ui-visual/visual-status.spec.ts` 不在失败列表；聚焦复核 17/17 PASS。先前隔离跑 `temp/integration-test-runs/ui-visual-2026-09-05T18-20-23-203Z-462829/` 为 92/92 PASS。协议门绿不等于完整会话功能已验证。
- [x] 4.5 通过项目 runner 留存脱敏证据、实现前后截图、真实/估算/未知口径说明、未验证 owner 能力和回退方式。
  Evidence (2026-09-05):
  - runner 六件套：`temp/integration-test-runs/full-plugins-2026-09-05T18-51-57-898Z-1270300/{summary.json,command.txt,stdout.log,stderr.log,env.json,artifacts/}`；视觉证据 `temp/integration-test-runs/ui-visual-2026-09-05T18-20-23-203Z-462829/` 与失败分类对照 `temp/integration-test-runs/ui-visual-2026-09-05T18-59-04-498Z-1664996/`。redaction 由 runner 执行（项目根/home/`Bearer`/`token=`）。
  - 实现前无 status-flow 夹具；实现后截图 `tests/ui-visual/__screenshots__/status-flow-{pane-360,pane-560,pane-960,popover-560,dual-960,zh-560,legacy-560}.png`（4.3 人工检查后写入，本轮未再改基线）。
  - 口径：`source.cost` 为 `provider_settled`（owner 结算）/ `price_snapshot`（带来源与生效时间的估算）/ `unknown`（无价格不估算）；`cost.kind` 为 `settled`/`estimate`；不同币种不求和；未知桶与未知数字保持 null，不以 0 补齐。`coverage.complete` 仅当 owner 证明历史完整且无缺用量/未知桶语义/缺时间戳/未验证子 Agent 合并。旧 `snapshot()` 仍为进程观察，UI 标 `Legacy process-observed statistics`。
  - 未验证 owner：完整历史 revision/cursor 与跨 retry/fork/子 Agent 权威 request identity（`upstream-prs/session-history-usage-identity/`，缺则 partial/unknown）；原生轨迹定位（`upstream-prs/session-trajectory-locator/`，入口禁用并说明原因）；真实账户凭据与线上价格/余额查询（默认测试不调用）。
  - 回退：停用新 `/status tokens` query 适配，恢复旧 `snapshot()`/`refreshBalance()` 与旧 bundle；会话与偏好保留；可丢弃聚合缓存可忽略，不改写业务数据。
