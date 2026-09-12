# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [ ] 1.1 核对当前 DSH Pane、项目 storage、引用 prepare/ack 和成果能力；交付真实 seam/缺口列表；不重复已有成果工作区 tasks。
- [ ] 1.2 冻结最小项目画布合同与 UI Contract；复用 host/client/bundle 脚手架；验收 session/project 分离与兼容。
- [ ] 2.1 实现五类节点及图片/视频/音频/文件/领域引用、相机、选择、移动、尺寸、分组、撤销；由5.1/5.2补全交互；focused reducer测试。 | evidence: 进行中：此前修复父组/子节点拖动顺序；本轮修复零位移及未变化viewport回声仍创建历史、清空redo的问题。相同值返回原editor，保持editVersion、历史与重做。reducer/controller两文件26项测试通过，含undo→零位移/相同camera→redo恢复原位置。完整真实交互验收仍开放。
- [x] 2.1a 完成共享文档schema与确定性Draft编辑内核：五类节点/两类边、选择/移动/尺寸/分组/复制/撤销，workspace/project/document/editVersion隔离；不含renderer/host持久化，父2.1保持未完成。 | evidence: implementation-baseline.md；17 focused unit tests / 11 existing protocol tests / package typecheck passed；非UI或真实owner验收。
- [ ] 2.2 实现 host 项目 Draft/layout 持久化与 revision 冲突恢复；关闭重开/存储失败不丢已确认数据。 | evidence: 进行中：此前Host存储/未知回执恢复证据保留于implementation-baseline；本轮先复现conflict reapply后undo退回旧存储revision，修复为同步重置当前文档、past/future和手势基线revision，非前进revision保持冲突。新增回归验证undo后再次保存使用owner revision7；reducer/controller27项测试及typecheck通过。完整Host/多会话与真实关闭重开验收仍未完成。
- [x] 2.2a 实现Host画布保存与只读对账、revision冲突、保存期间编辑保护；真实JSON存储销毁重挂载恢复；父2.2保留刷新草稿/unknown恢复与完整Host验收。
- [x] 2.2b 实现写前日志与确定性对账：save先落journal再commit；跨重挂载read返回journaled draft；reconcile对已记账未提交返回not_applied并可把草稿恢复为dirty重存；conflict提供reapply（重存到owner确认revision）/discard显式路径。父2.2保留真实Host生命周期与多会话冲突验收。 | evidence: implementation-baseline.md；13 Host store + 10 controller unit全绿；真实storage journal恢复证据 project-canvas-storage-20260908033330Z-3349834
- [ ] 2.3 注册 Pane，复用 DSH tokens/控件/locale，补对象列表和键盘等价操作；dispose 与 HMR 无残留。
- [x] 2.3a 接入固定React Flow、creator.canvas注册与ModuleLoader bundle；fixture浏览器验证三种宽度草稿保存重开、拖拽与相机撤销；父2.3保留真实locale/HMR/项目切换。
- [x] 2.3b 接入真实locale face订阅（getSnapshot/subscribe触发已挂载视图重渲染，translator调用时生效）、项目切换控制器按scope缓存隔离且重开保留未保存草稿不重读、注册销毁对称注销locale字典与控制器。父2.3保留真实HMR与运行中项目切换推送验收。 | evidence: implementation-baseline.md；3 pane spec（locale切换重渲染、项目隔离与草稿保留、销毁对称）；pane-domain 141项全绿、bundles 27/27、visual 4/4
- [ ] 3.1 对接既有选择引用 prepare/ack；明确目标会话，切换/迟到/重复提交测试不串数据。
- [ ] 3.2 复用既有 Creator Studio 成果预览/比较/receipt，将选定成果回填原画布；禁止复制保存/版本状态机。
- [ ] 3.3 实现项目续接摘要与显式继续；Pinax 缺席诚实降级，关闭不取消、unknown 只对账。
- [ ] 4.1 依赖2/3组与5.1–5.5稳定；完成协议 focused 测试及稳定后 typecheck/test/build/check:bundles/check:plugins/check:surfaces/test:visual。 | evidence: 进行中：现有画布reducer/workflow/controller/view/pane五文件36项定向测试及typecheck通过。UI测试曾产生大量React act环境未配置警告；两份画布UI测试beforeEach显式设置IS_REACT_ACT_ENVIRONMENT，afterEach沿用unstubAllGlobals恢复。修复后两文件5项UI测试通过且无act环境/未包裹警告。完整稳定门、视觉与真实画布验收仍未完成。
- [ ] 4.2 真实 DSH staging/profile 验证 Agent→成果→重开续接、双栏隔离、拖拽与无重复 Target 底栏；协议 pass 不替代本项。
- [ ] 4.3 三个项目两类工作、10次续接至少8次30秒内、60分钟零已确认丢稿/零重复提交；保存脱敏证据并更新实际 readiness。 300混合节点，输入p95≤100ms、缓存切换p95≤200ms，记录订阅/DOM/heap/帧趋势与机器/样本。
- [ ] 5.1 依赖1.2/2.1；实现完整素材/草稿/操作/成果/分组节点及六类引用，固定@xyflow/react@12.11.6；执行边只由workflow消费同一document；无第二状态owner。
- [ ] 5.2 依赖5.1；实现复制、撤销/重做、搜索、fit selection/全图、运行定位、小地图及键盘对象列表等价；复制操作不复制run。
- [x] 5.2a 键盘对象列表等价：Tab/Shift+Tab按搜索顺序循环选择、方向键±1（Shift±10）步进移动、Ctrl+D复制选中、Ctrl+Shift+F适配、Delete移除；输入控件内按键不劫持；复制不复制run。父5.2保留运行定位与全键盘走查验收。 | evidence: implementation-baseline.md；project-canvas-view.spec 2项键盘等价（循环/步进/复制/移除/输入不劫持）；pane-domain 145项全绿
- [ ] 5.3 依赖1.2/3.1；实现Agent指定范围内草稿/布局变更、摘要与撤销；拒绝修改领域正文/采用版本/运行快照，执行另确认。
- [ ] 5.4 依赖1.2；完成带fixture标识的可丢弃原型：五节点/两边/媒体/窄Pane与专业Pane并排，人工走查回填UI Contract；不升级实际能力。
- [ ] 5.5 依赖5.1/5.2；实现媒体lazy-load与离屏视频暂停；建立300混合节点60分钟性能样本和原始指标采集，阈值见design；不空匹配。
