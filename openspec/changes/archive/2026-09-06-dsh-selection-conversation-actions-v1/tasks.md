# 任务

## 1. 实施前复核

- [x] 1.1 用户明确恢复实施后，复核关联引用／主题与多 Pane change、当前源码和路径归属
- [x] 1.2 用真实浏览器复现浮层灰色背景、固定后隐藏及手柄拖动问题，记录 computed style 和真实输入基线
- [x] 1.3 核实目标会话、引用草稿、overlay 与来源 owner 能力；记录缺口，必要时补充 additive 合同

## 2. 添加到对话与引用询问

- [x] 2.1 收敛主动作和更多入口，保留现有批注、复制、批量收集能力
- [x] 2.2 接入宿主明确 workspace/session 目标及 revision/bookmark，覆盖 A/B 并排、跨项目与异步失效
- [x] 2.3 实现添加保留来源焦点、询问聚焦官方输入框；保留文字和引用，不自动发送
- [x] 2.4 支持显式选择另一会话或新建对话，覆盖取消、创建失败与重复触发
- [x] 2.5 接入原生引用节点的来源摘要、详情、定位、移除及 undo/redo/IME
- [x] 2.6 完善无 resolver 的可理解错误及显式未关联来源文字引用，保持结构化引用校验
- [x] 2.7 验证生成中追加、插入确认、重复点击、失败与 unknown，确保草稿连续

## 3. 固定位置与拖动

- [x] 3.1 分离可见位置固定与旧 pin 收藏／恢复语义，加入语义图标、文案和 aria-pressed
- [x] 3.2 实现 6 CSS px 阈值、指针捕获、实际坐标投影、松手固定及尾随 click 抑制
- [x] 3.3 实现 Escape/blur/pointercancel/lost capture/来源失效取消与几何还原
- [x] 3.4 完成视口约束、缩放、滚动、手柄触控与键盘移动，保留普通文字选择

## 4. 宿主视觉与可访问性

- [x] 4.1 根据实际 computed style 修复灰色浮层、字体或 token 污染，复用原 primitives 与 scope
- [x] 4.2 验证主题切换、目标选择和来源预览焦点回归，补齐中英文与可访问名称
- [x] 4.3 验证 360/560/960px、200% zoom、长名称、pseudo locale、44px 触控目标与 reduced motion

## 5. 验证与交付

- [x] 5.1 复用现有 Vitest 增加状态／目标／兼容合同回归，不建立并行测试框架
- [x] 5.2 复用 Playwright 执行 design 中 S1–S9，检查几何、pin 状态、草稿引用节点、目标与回执
- [x] 5.3 分开记录插件合同和真实宿主交互结果，保存本项目脱敏证据；未验证能力不计通过。Evidence: `node scripts/run-selection-conversation-actions-evidence.mjs --host` → `temp/integration-test-runs/selection-conversation-actions-2026-09-05T19-00-35-086Z-1693959/`（plugin_contract=passed；real_host=not_verified，HTTP 401，不计通过）。Playwright S1–S9 fixture 27/27 计入插件合同，不计入真实宿主。
- [x] 5.4 稳定后运行相关包测试、typecheck/build、check:surfaces、test:visual、check:plugins 及所需完整门禁。Evidence: 5.3 包 typecheck/test + `openspec validate --strict`；`pnpm run check:surfaces` / `pnpm run check:plugins` 通过；`pnpm run test:visual` 92/92 → `temp/integration-test-runs/ui-visual-2026-09-05T19-06-51-554Z-1889202/`。
- [x] 5.5 检查视觉变化后才决定是否更新基线；更新交付文档和回退说明，再通过证据推进任务状态。Evidence: 27 张表面基线因 visual-kit 宿主字体/token 对齐更新；选区 S1–S9 不依赖那些截图。交付与回退见 `docs/delivery/dsh-selection-conversation-actions-2026-09-05.md`。
