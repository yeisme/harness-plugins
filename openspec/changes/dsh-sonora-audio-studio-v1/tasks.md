# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 核对 Sonora workflow/subtitle/tts 合同：各 provider 声音/字幕/对齐/导出能力逐项记录版本/digest、支持/缺失/未验证；明确 segment-to-cue 与 word-level alignment 的边界；与 cli/sonora 双向链接。（done 2026-09-11：implementation-baseline.md 增 1.1 复检节——owner HEAD 2c59817 合同面相对 09-08 基线零变更，七合同面逐项 digest 记录、支持/缺失/未验证标注、segment-to-cue≠word-level 边界维持、双向链接核验；未跟踪 workspace.go 在途文件排除）
- [x] 1.2 冻结最小声音台 consumer 合同与 UI Contract；核对脚手架复用。（done 2026-09-11：design.md UI Contract（转写/字幕增量+页面矩阵+补全节）与 docs/design/dsh-sonora-audio-studio.md 完整页面设计共同冻结最小 consumer 面；脚手架复用核对——CreatorActionComposer/artifact-workspace/ui-surface/visual-kit/rich-media 在 ui-creator-studio 实装组件（domain-studio/artifact-workspace/projection-components）与已交付 CreatorTranscriptionCapabilities/CreatorSubtitleResults 中复用，无私有 atoms/第二主壳）
- [x] 2.1 实现声音工作列表 adapter：project scope、分页、freshness、诚实态。（done 2026-09-11：`packages/host/creator-studio/src/sonora-works-table.ts`——`GET /api/v1/workspace-projections/table` 客户端 + `sonora.audio_workspace_projection.v1`(table) 严格 envelope（列≤64/行≤500/cell 有界、行级 revision、`sonora.audio_workspace.table.page.*` cursor 命名空间、fresh|stale|expired|denied × read_only|deep_link|refresh_required|unavailable 原样投影、null cell 保留）；project scope 由连接绑定 11 键 context fence + 非回环 http 拒绝；1MiB 响应上限；adapter 增 `readWorksTable` face（缺 works 客户端时诚实 unavailable）+ Gateway `@Remote('readWorksTable')` 三重 fence。Evidence: tests/sonora-works-table.spec.ts 11 项（分页透传/坏 cursor 零网络/缺绑定与 context 错位/403-404-422-500 类型化/非回环拒绝/adapter 缺席降级）+ 包全套 407/407 + typecheck 绿）
- [ ] 2.2 实现 provider 能力矩阵消费：owner 描述为源，缺失/未验证保留禁用入口并说明原因。 | evidence: implementation-baseline.md：转写能力UI正常/失败/空目录/未知诊断/stale已验证；最新中英12浏览器路径证据temp/integration-test-runs/ui-visual-2026-09-08T06-52-27-661Z-1745362/。实际HTTP/Gateway合同证据保留；完整声音能力矩阵和真实ASR仍未完成。
- [ ] 2.3 实现动作发现/预览/确认：descriptor、权限、费用状态；取消以 owner 确认为准。 | evidence: implementation-baseline.md：新增Sonora字幕导出Creator adapter及bundle导出，真实directory/gateway＋HTTP fixture验证固定track/review操作、回执输出、旧键只读恢复，24unit＋4integration通过；证据temp/integration-test-runs/sonora-subtitle-20260908T050631243Z-522725/，host build/bundle typecheck通过。实际连接安装、其他声音动作与浏览器仍未验收。
- [ ] 2.4 实现试听与字幕/对齐产物消费：授权 rendition、固定版本、既有媒体 renderer；不做本地转码。 | evidence: implementation-baseline.md：字幕查看/下载与实际Host→Sonora HTTP系统路径已验证；当前正文名称/完整版本在新回执到达后保持，复制字幕文案明确，64字符版本窄Pane换行。最新6组件/12浏览器与检查证据temp/integration-test-runs/ui-visual-2026-09-08T05-42-02-993Z-993177/；实际owner系统证据sonora-owner-http-20260908T053711476Z-941237。大文件、长期配置、声音试听/精细对齐仍未完成。
- [ ] 2.5 实现交接：owner receipt、版本与目标 scope 分别取得；回填画布/引用工作区。
- [ ] 3.1 注册声音台 Pane：token/locale/键盘等价、独立打开与重复绑定 focus、dispose/HMR 无残留。
- [ ] 4.1 依赖第2/3组及5.1–5.4稳定；focused 测试全绿后运行全门禁。
- [ ] 4.2 依赖4.1和本领域required owner交付；真实完整验收：选定台词/片段→配音/音乐/音效→试听比较→审阅采用→字幕/对齐核验→镜头绑定或支持的导出；逐能力标注fixture/real，至少一项拒绝与恢复：unknown费用、clone不可用、试听切版本、cue越界、rights拒绝、stale handoff digest、fixture不冒充production；零匹配/skip不能通过。 Recheck 2026-09-11: `[external-gate skipped]` 维持——@yeisme composition 包 npm 仍 E404（GET 实测）+ 0.1.5-rc.2 六包无对应 seam（temp/alpha-grep-0911/）。
- [ ] 4.3 保存脱敏证据并更新实际 readiness。
- [ ] 5.1 依赖1.1；负责领域adapter；对确认缺失动作在cli/sonora创建最小配套OpenSpec/tasks并双向链接，记录operation/交付物/受影响任务；无缺口则引用可验证合同，不重复创建API。 | evidence: implementation-baseline.md：确认workspace HTTP contract-only、默认ASR fixture、字幕导出/词级对齐缺口；已建cli/sonora的sonora-dsh-audio-consumer-gaps-v1八项配套tasks并双向链接；实际DSH adapter未完成。
- [ ] 5.2 依赖1.2；负责UI设计与本领域内容模块；按docs/design/dsh-sonora-audio-studio.md完成带fixture标识的可丢弃原型，走查所有required页面/主动作/窄Pane与并排交互；原型不启用真实能力。
- [ ] 5.3 依赖2.1–2.5、5.2；负责领域UI；补齐台词/角色声音、TTS/music/SFX三类配置、试听/片段/候选、转写cue与精度、权利/质量、固定版本镜头交接；复用既有共享组件；focused组件和动作合同覆盖每个可见控件。
- [ ] 5.4 依赖5.3；负责验证；覆盖unknown费用、clone不可用、试听切版本、cue越界、rights拒绝、stale handoff digest、fixture不冒充production，双会话/项目隔离、旧版本保留、unknown零重试、禁用不删除；与画布同步按可选消费单独验收，不能阻塞独立Pane。
