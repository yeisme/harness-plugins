# 任务清单：workbench-agent-shell-visual-r1

设计输入：`docs/design/agent-visual-language.md`（目标形态裁决依据）+ 本 change `design.md` D2 映射表（现状盘点）。

## 1. 时间线去方块化（conversation-blocks.tsx）

- [x] 1.1 StateBanner：border+bg 横幅 → 细线分隔+状态色文字/小色点，去除大面积状态底色
- [x] 1.2 run 状态徽章（:174 方块 tile）与 proposal kind 徽章（:209 底色 pill）→ 色点+文字或发丝底 pill（优先复用 StatusChip）
- [x] 1.3 basis refs chips（:214 底色块）→ 发丝底 pill 或色点+文字
- [x] 1.4 thinking/tool 行压实到 24px 行节奏（px-3 py-2 → 收紧）；running shimmer 保持 motion-safe

## 2. Session rail（session-rail.tsx）

- [x] 2.1 选中行：圆角色块+box-shadow 左条 → border-l-2 accent 左条+浅底、去圆角块
- [x] 2.2 行内容 px-3 py-3 压实到行节奏；未读徽章实心 pill → 色点+数字；attention chip 描边 pill → 发丝底
- [x] 2.3 过滤器（最近/已置顶/未读/已归档）手写 aria-pressed 组 → design-system `SegmentedControl`

## 3. Composer（composer.tsx）

- [x] 3.1 容器：rounded-2xl 贴底 → rounded-xl（≤12px）+细边+轻阴影浮起形态
- [x] 3.2 needs_contract 工具 chips（:57）与上下文 chips（:61）、context 按钮（:69）去底色块化
- [x] 3.3 textarea/发送/附加上下文按钮迁到 `TextArea`/`Button`/`IconButton` primitive（保持 aria 名与 data-agent-composer）

## 4. Header 与 pane host

- [x] 4.1 conversation-header.tsx 按钮迁 `Button`/`IconButton` primitive，radius 收敛 6–8px，保持幽灵形态与 aria 名
- [x] 4.2 agent-pane-host.tsx 方块卡（RunPane 摘要卡 :106、事件流行盒 :126、unknown_accept 卡 :137、lastContextPack 卡 :88、expectedVersions 行盒 :151）→ 发丝线区段+语义左色条；pane 内描边按钮（:91-92,:138）→ Button primitive

## 5. 图标 registry 收敛

- [x] 5.1 `agent-pane-icon.tsx` 私有 lucide 映射并入 registry（缺名按现有分组补 icon-name.ts + registry.ts + registry.test.ts）
- [x] 5.2 `agent-pane-host.tsx`、`pane-command-palette.tsx`、`agent-pane-dock.tsx` 的 lucide 直接 import 迁 registry

## 6. 验收

- [x] 6.1 截图对比：/agent 主壳 1440/1024/390 before/after（证据存 temp/），逐区域确认无大方框、无渐变/玻璃、行节奏一致
- [x] 6.2 既有测试绿（选择器零改动；控件换源导致的角色断言更新允许）+ design-system/foundation contract 绿
- [x] 6.3 e2e（agent-first、foundation-gallery）绿；截图基线如有 diff 逐图签认更新
- [x] 6.4 UI Spec §8 黑名单逐项过审，结论写入本 change review-report.md
- [x] 6.5 最终验证：`openspec validate --all --strict`、`bun run typecheck`、`bun run --cwd apps/web vitest run`、`bun run compose:i18n && bun run check:i18n`

## 7. 简洁化（评审反馈：chips 常驻行占地方、入口重复、空态噪音）

- [x] 7.1 砍掉 composer 上方常驻 action-descriptor chips 行；改为 composer 底栏单个紧凑指示（状态点+计数，如"⚠ N 项缺少合同"），点击展开明细（Popover 列出每个 descriptor 的诚实状态与恢复路径）
- [x] 7.2 空状态去重：删除提示 pills（Enter 发送/Shift+Enter 换行/不自动附加上下文，与 composer 底栏重复）与重复的"附加上下文"链接，保留单一 CTA
- [x] 7.3 无线程可过滤时隐藏 session rail 的 SegmentedControl 过滤器（保留搜索与新建）
- [x] 7.4 同步更新受影响测试/e2e 断言与截图证据；复跑 typecheck、全量 vitest、agent-first e2e、黑名单过审补记 review-report

## 8. dsh 对齐与尺寸密度归一（评审反馈：对比 deepseek harness 不够好、UI 大小奇怪）

并行 change `workbench-ui-visual-refresh-r1` 已完成 token/控件 CSS 层刷新（Eikona 02 基线：圆角刻度、四级表面、accent tint）；本节只做结构与 accent 纪律收尾，与新视觉语言保持一致，不重复其 token 工作。

- [x] 8.1 accent 纪律（单主 CTA）：「新建线程」实心 accent 大按钮改 secondary/elevated 填充并收敛到正常控件高度（不再整宽横幅）；空态只保留一个 primary（hero composer 或单 CTA）；「发送」保持唯一实心 accent
- [x] 8.2 header 瘦身：元信息条（注意事项/运行时/更新/上下文/只读）收敛为单行极简或收进状态 popover；header 只保留标题+状态点+ghost 操作
- [x] 8.3 空态 hero 化：空会话时 composer 居中成为主角（小品牌位+composer），删除大标题/说明/CTA 堆叠；有会话时 composer 回到底部 dock
- [x] 8.4 composer 底栏收敛：次要动作（命令/引用保持显式）聚合进 + 菜单或 overflow；底栏保留 附加上下文 + 能力不可用指示 + 发送
- [x] 8.5 尺寸密度归一：壳内控件视觉高度协调（rail 操作/过滤器/输入统一档位）；排查 44px 触控覆盖导致的视觉比例失调，在保持既有 touch-target e2e 断言绿的前提下让视觉尺寸协调（如视觉与触控区分离）
- [x] 8.6 验证与证据：受影响测试/e2e 断言同步；三视口 after 截图存 temp/agent-shell-visual-r1/（after-r3-*）；黑名单复过；review-report 追加第 8 节

## 9. 能力展示与全局 chrome 完善（评审反馈：能力 Popover 信息重复粗糙、语言切换浮空）

- [x] 9.1 能力不可用 Popover 重设计：行 = 完整 mono 操作名（不再截断为 episode.cre…，超长时省略+tooltip）+ tint 状态 chip；删除每行重复的 `needs_contract` 原文代码（状态语义由 chip 承载，raw code 降为次级 muted 小字或移除）；按 owner/域分组；容器限宽限高+滚动；恢复/审阅入口保留
- [x] 9.2 语言切换器整合：从 fixed 浮空挂件改为顶栏 chrome 内嵌元素（与搜索等顶栏操作同排同档位），trigger 幽灵化/图标化；移动端不断档；保持既有切换行为与 e2e 交互（radix Select trigger）
- [x] 9.3 验证与证据：受影响测试/e2e 断言同步；截图存 temp/agent-shell-visual-r1/（after-r4-*）；review-report 追加第 9 节；typecheck/全量 vitest/agent-first e2e/i18n 全绿

## 10. 能力展示用户化（评审反馈：character.get 等原始操作 ID 对终端用户无意义，正常生产不应展示）

依据：服务端 `ActionDescriptorV1` 只有 `actionId`/`availability`/`reasonCode`/`recoveryHint`，无人读 label，因此展示层必须做域级影响化表达。

- [x] 10.1 能力 Popover 改为域级影响列表：行 = 本地化域名（角色/场景/剧集/项目等，i18n 映射，未知域回退通用标签）+ 该域主导状态 chip；页脚指示同步改为域级计数（如"N 类能力暂不可用"）
- [x] 10.2 原始操作 ID 与 reason code 移入默认折叠的「技术明细」disclosure（面向运维/开发者，mono 名 + chip + code + recoveryHint 全保留，诚实性不弱化）
- [x] 10.3 全部 ready 时零占位（既有行为，补断言）；域名映射 i18n key 进 agent/*.json + catalog-policy
- [x] 10.4 验证与证据：测试/e2e 断言同步；截图（after-r5-*：域级列表、技术明细展开、全 ready 零占位）；review-report 追加第 10 节；typecheck/全量 vitest/agent-first e2e/i18n 全绿

## 11. Composer 照齐 dsh 参考（评审反馈：照着参考图抄，差距太大）

- [x] 11.1 卡片形态：elevated 填充底（非描边空底）+ 近隐形低透明边 + 柔和投影；圆角升到 overlay 档（14px，hero 可 16px）；padding 放宽；hero 与 dock 两种模式统一限宽居中（约 720px），不再拉满 canvas
- [x] 11.2 发送钮：圆形 icon-only accent 按钮（send 图标，aria-label「发送」不变，loading 态保留）；Enter 发送 · Shift+Enter 换行 文字提示从底栏移除（迁入发送钮 tooltip）
- [x] 11.3 底栏极简：左簇 + 菜单、附加上下文；右簇能力指示（仅非常备时出现）、圆形发送；视觉对齐 dsh 的稀疏底栏
- [x] 11.4 同步 agent-visual-language.md 的 composer 条款（dock 态圆角/elevated 底）；验证+截图（after-r6-*）+review-report 第 11 节；typecheck/全量 vitest/agent-first e2e/i18n 全绿

## 12. 交互过程展示美化（评审反馈：agent 交互来回调用过程展示，对齐 Eikona 01 对话参考）

- [x] 12.1 工具调用行人读化：行 = icon tile + mono 工具名 + 人读中文描述（read_context→读取上下文包、check_constraints→核对约束与权限 等映射，复用/扩展现有 label helper）+ 右侧状态 chip/色点 + 耗时；`tool.call.start:xxx` 等原始事件名不再是主文本
- [x] 12.2 工具执行区块化：回合内工具调用归入「工具执行 N/M」区段（发丝线分隔的行列表）；原始事件流水（task.submitted/gate.resolved 等）收进默认折叠的「事件明细」disclosure
- [x] 12.3 思考行升级：「推理摘要」折叠区段 + 右侧思考用时；运行中 shimmer 保留 motion-safe
- [x] 12.4 提案 CTA 区段：对齐 01 参考的确认横幅形态（图标 + 说明 + 查看/批准操作按钮），操作入口仍走既有 review pane/审批链，不伪造 approve 能力
- [x] 12.5 回合卡头信息分层：标题+状态 chip+用时为主，「N 个安全事件 · Task · id」降为次级 muted meta；server 原文（safeSummary）保留但视觉降权
- [x] 12.6 验证与证据：测试/e2e 断言同步；截图（after-r7-*：含工具执行区段、推理摘要折叠、提案横幅、事件明细展开）；review-report 第 12 节；typecheck/全量 vitest/agent-first e2e/i18n 全绿
