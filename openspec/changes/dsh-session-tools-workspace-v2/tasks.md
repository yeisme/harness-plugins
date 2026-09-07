# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 复现目录不可用链路并保存失败证据：区分 Host 注册、remote 挂载、来源采集、scope 与存储错误；不得以空目录替代失败 | evidence: 重现Gateway外层响应被当作目录和业务失败被当作成功：temp/integration-test-runs/2026-09-07T07-36-25-690Z-1460859/；新增两项回归先失败，修复后remote测试通过。
- [x] 1.2 修复目录连接生命周期：无 controller 时仍可重探测，支持服务晚到/重连、并发去重、迟到响应隔离及 HMR 对称释放 | evidence: temp/integration-test-runs/2026-09-07T09-40-21-865Z-2725320/；remote 7项含并发挂载和卸载后迟到清理，pane含重连和最终引用释放。
- [x] 1.3 接入会话 referenceTools 与安全 Skills 目录；区分全局 inventory 与 session 可见能力，缺来源标 partial | evidence: temp/integration-test-runs/2026-09-07T09-40-21-865Z-2725320/；session-catalog查询按sessionId隔离，缺Skills完整性标记为partial；宿主Skills 9项通过。
- [x] 1.4 保留全局 toolHub CAS 启停与来源健康语义，建立独立管理入口并复用已有安装/连接/配置 owner | evidence: temp/integration-test-runs/2026-09-07T09-40-34-468Z-2724973/；真实Loader/Gateway/JSON存储，CAS成功、冲突、写入失败；temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/验证独立管理和Settings。
- [x] 2.1 恢复会话 conversation.view 工具 Tab，显式传递 sessionId；默认活动与失败定位，不读取全局 current | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/；/mcp进入来源会话Tools Tab，默认活动。
- [x] 2.2 实现会话级共享展示 controller：Tab/旁栏同步筛选与选择，跨会话隔离，最后一个视图关闭才释放订阅 | evidence: temp/integration-test-runs/2026-09-07T09-40-21-865Z-2725320/；A Tab/A旁栏共享筛选和选择，B隔离，最终关闭释放订阅/轮询，StrictMode重挂载保留资源。
- [x] 2.3 实现按会话唯一的固定工具旁栏与打开意图；关闭对话标签仍保留绑定，重复固定只聚焦已有实例 | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/；A/B固定唯一，重复聚焦，关闭来源对话保留旁栏并能重开。
- [x] 2.4 对接调用时来源会话的 /mcp 入口、无来源选择和旧 mcp-inspector 布局迁移；无绑定不得静默跟随 | evidence: temp/integration-test-runs/2026-09-07T09-40-21-865Z-2725320/；旧无绑定Pane要求选择；command-experience pane-commands 3项通过，来源会话不读global current。
- [x] 3.1 通过宿主 seam 完善 Pane 标题会话标签组：名称/工具类型、搜索、切换、固定、重新打开原会话 | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/；标题搜索和A到B显式改绑定去重；同名短ID及重命名宿主标题测试通过。
- [x] 3.2 补齐 sessionId 序列化与刷新恢复，覆盖同名会话、重命名、删除/不可访问及显式切换去重 | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/刷新恢复；unified-host 8项覆盖持久metadata/旧布局；pane删除A不显示B；session-tools-title测试同名与重命名通过。
- [x] 3.3 在兼容 staging 导出仅含自有改动的宿主增量补丁，验证完整补丁链逐字重建和幂等，不整体导出脏 checkout | evidence: temp/integration-test-runs/workbench-patches-2026-09-07T09-54-57-008Z/；完整链、幂等、已审阅自有源码SHA256均通过，共享文件排除并行prompt增量。
- [x] 4.1 重构紧凑活动首屏：单工具栏、运行中分区、失败筛选、列表/时间线、明确最近200条边界 | evidence: temp/integration-test-runs/ui-visual-2026-09-07T09-26-29-635Z-2485858/；活动优先、失败/运行筛选、列表/时间线及最近200条；activity 7项通过。
- [x] 4.2 移除常驻详情一级页签和卡片套卡片，按选中调用/目录项呈现有界详情；实现窄屏返回和焦点恢复 | evidence: temp/integration-test-runs/ui-visual-2026-09-07T09-26-29-635Z-2485858/；6组尺寸有界列表、选中详情、返回原行焦点通过；Escape代码路径与无常驻详情Tab。
- [x] 4.3 接入 owner-authored 脱敏调用详情与 session-addressed 原消息聚焦；无摘要/无引用诚实降级，不新增重试执行 | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/；B原消息焦点定位成功；安全错误码白名单，无摘要明确降级，无执行重试。
- [x] 5.1 在现有 Vitest 测试层补齐目录恢复、CAS、会话绑定、固定生命周期、订阅释放和旧布局回归；focused 门先行 | evidence: temp/integration-test-runs/2026-09-07T09-40-21-865Z-2725320/与temp/integration-test-runs/2026-09-07T09-40-34-468Z-2724973/；Tools客户端46项、Host13项、bundle3项、命令3项、适配8项通过，生命周期及旧布局有回归。
- [x] 5.2 扩展现有 integration 入口：可丢弃 profile/storage 中验证真实装载、remote 查询、全局启停及失败恢复，保存六件套 | evidence: temp/integration-test-runs/2026-09-07T09-40-34-468Z-2724973/；真实Loader+Include+Storage+DomainFacility+Gateway，外部来源明确fixture，六件套完整。
- [x] 5.3 扩展现有真实浏览器场景：A/B会话Tab和旁栏、关闭来源标签、刷新恢复、标题管理、详情定位与4个以上Pane交互 | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/；会话Tab/旁栏、标题改绑定、关源/恢复/详情原消息、四Pane循环与原有Explorer打开路径通过。
- [x] 5.4 按运行时 inventory 验收全部本地 bundle 的安装/装载/适用入口，输出逐插件结果与依赖原因；不得硬编码33或宣称全部业务功能通过 | evidence: temp/integration-test-runs/pane-interactions-2026-09-07T09-33-28-245Z/artifacts/plugin-smoke.json；动态发现33/33加载和适用入口通过，无外部业务执行声明。
- [ ] 5.5 执行最终类型/构建、bundle/plugin/surface/92项现有视觉及新增Tools视觉门；Mac真机不可得时明确未验证，不用模拟替代 | evidence: 未完成：独立checkout全仓typecheck/build、bundle/plugin/surface门通过，完整测试后缺生成产物的剩余包复验通过；全视觉98项仍66失败，独立复现旧选区dark/system-dark两项颜色基线失败。见docs/qa/dsh-session-tools-workspace-delivery.md；Mac真机未验证，不改旧截图掩盖差异。
- [x] 6.1 更新当前使用指南和交付报告，交叉更新旧Tools首屏规格适用范围，只有实际通过的实现任务才标完成 | evidence: docs/design/dsh-session-tools-workspace.md、docs/runtime/dsh-workbench.md、docs/qa/dsh-session-tools-workspace-delivery.md已同步；旧首屏要求通过MODIFIED delta明确替代，最终门失败保留未完成。
- [x] 6.2 提交自有插件改动、规格和验证记录，再提交根仓submodule指针；保留无关脏改动，不推送或修改真实外部配置 | evidence: 插件自有实现/规格/记录已提交 f03e7b8；根仓指针已提交 61c17a21；未推送，其他脏改动保留。最终视觉门5.5仍未完成，不归档OpenSpec。
