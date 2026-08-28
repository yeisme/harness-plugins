## 1. Selection Anchor 与 Annotation 协议

- [x] 1.1 新增 `@yeisme/dsh-selection-host`：五类 SelectionAnchorV1、共同字段、zod 校验、quote digest、freshness 与 reanchorEvidence 合同测试
- [x] 1.2 新增 AnnotationBatchV1（draft/submitted/resolved）、标记编号分配、多点联合提交与 owner 发布边界测试
- [x] 1.3 补齐不可信上下文边界：锚点字段白名单、不含原始截图/敏感键、失败 fail-closed 测试

## 2. 可复用 Compact Agent Composer seam

- [x] 2.1 定义 AgentComposerSeamV1（density/intent/anchor/approvalPolicy/expandable/draft）与 adapter 缺失降级
- [x] 2.2 实现紧凑控制器：意图切换、草稿展开保留、1–6 行增长、280–480px 宽度约束、preview-first 强制、评论默认不调模型
- [x] 2.3 浮动选区操作条：上方 8px/自动翻转/不遮挡、键盘导航与 Esc、窄面板图标降级、滚出视口收缩为边缘锚点

## 3. 文件和 Markdown 选区适配

- [x] 3.1 文件源码选区 → FileRangeAnchor（行范围、版本、digest）
- [x] 3.2 Markdown 渲染选区 → 源码范围映射（data-source-line 收敛+单调性校验）；无提示降级 DomRegion 并标记 unmapped，不伪造行号
- [x] 3.3 跨块选择、滚动后锚点刷新与 reanchorEvidence 测试

## 4. 页面截图与批注画布

- [x] 4.1 WebCaptureAdapterV1 合同（viewport/fullPage、范围预览、密码遮盖、private DOM 排除、retention/删除）
- [x] 4.2 批注画布：点/矩形/文本/DOM 元素锚点、归一化坐标、≥20 标记、缩放与高 DPI 对齐
- [x] 4.3 Desktop Capture handoff capability（window/fullDesktop）：probe 永远 unavailable+原因，不渲染死入口

## 5. 多位置 Proposal 和 Approval 面板

- [x] 5.1 ProposalHunkV1 状态机（pending→approved/rejected/revision_requested/stale；approved→applying→applied/failed/reconcile_required）与逐位置操作
- [x] 5.2 部分批准语义：只应用已批准且依赖闭包完整的 hunks；依赖不完整阻断并列出依赖关系
- [x] 5.3 Agent 回复引用标记编号（#N）与批次引用投影

## 6. File Host 版本化局部应用

- [x] 6.1 应用动作只接受 owner action descriptor + baseVersion；浏览器不得提交任意 patch 字符串
- [x] 6.2 版本漂移 → reconcile_required，禁止静默覆盖；应用结果 receipt（含 failed 诊断）
- [x] 6.3 node 参考实现：内存 annotation service + FileHost 围栏 apply loop 闭环测试

## 7. 审计、隐私和证据

- [x] 7.1 receipt/审计投影：批准、拒绝、应用结果均产生 owner receipt，字段脱敏
- [x] 7.2 unit/contract/component tests + jsdom 集成闭环（选择→批注→提案→审批→应用 receipt）
- [x] 7.3 `temp/integration-test-runs/<run-id>/` 脱敏证据与验证门（typecheck/test/build/check:bundles/openspec validate）

## 8. Desktop Capture Adapter handoff

- [x] 8.1 DesktopCaptureAdapterV1 capability 合同与 Web 侧 probe/降级说明，系统权限边界写入文档与测试
- [x] 8.2 bundle 交付：`@yeisme/dsh-selection-annotation` 单行 profile patch + ModuleLoader 冒烟
