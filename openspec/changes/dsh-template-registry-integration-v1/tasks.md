# 实施与验收任务

由 scripts/openspec-tasks.py 维护状态。

- [x] 1.1 核对 template-registry 本地 stdio MCP 工具面、promptrepo 只读 catalog adapter 与现有 `dsh-tool-hub`/catalog 包的可复用性；交付真实 seam/缺口列表；不重复已有 pane 能力。 | evidence: seam 清单文档化，含 MCP tools/list 实测摘要（脱敏）（done 2026-09-14：implementation-baseline.md 落地——真实 stdio 握手（real 级）实测 32 工具/信封/browse 记录/inspect 合同/session 视图/doctor facts，compiler `template-registry.prompt-compiler.v0.2`；promptrepo Go SDK + catalog.json 降级面、tool-hub/radar 传输/sessionProjections/scene-store 五项复用核对、七条缺口、五类既有 pane 不重复结论）
- [x] 1.2 冻结集成合同：safe projection zod schema、编译会话状态机、storage domain、UI Contract；复用 host/client/bundle 脚手架；验收 session 隔离与兼容。 | evidence: design.md 合同定稿；脚手架 typecheck 通过（done 2026-09-14：design.md 增「编译会话状态机（1.2 定稿）」与「集成合同冻结（1.2）」两节——readiness 折叠/转移表/CAS/decision_ref、`yeisme_template_registry_v1`+snake_case `compile_sessions`+按 DSH 会话隔离键、9 工具 MCP 消费集、兼容表；`packages/host/template-registry/src/index.ts` 零新依赖演进（已提交导出全部保形，provider_calls 改带默认 0），typecheck+test 18 用例通过、client typecheck 通过）
- [ ] 2.1 host：实现 MCP 连接管理（主通道）与 catalog adapter 降级路径，capability probe 与断开检测；依赖 1.1；focused 单测覆盖连接成功/断开/降级；失败重检 transport 与超时。 | evidence: host 单测通过，三态覆盖
- [ ] 2.2 host：目录查询、inspect 与 preview typed RPC，rights fail-closed；依赖 2.1；验证 preview 禁用时返回原因码；失败重检 rights 判定。 | evidence: RPC 单测通过，fail-closed 用例存在
- [ ] 2.3 host：编译会话 RPC（填字段/确认/编译/导出）与 storage domain 持久化；依赖 2.2；验证 `provider_calls=0`、缺字段拒绝、未确认禁编译；失败重检 contract 校验转发。 | evidence: 编译演练 evidence，`provider_calls=0`
- [ ] 2.4 host：session projection 注册与 stale 检测（digest 变化禁导出）；依赖 2.3；验证投影非第二份状态（投影由工具日志折叠生成）；失败重检 digest 比对。 | evidence: projection 单测通过
- [ ] 3.1 client：模板目录 pane（导航/列表/详情、过滤、状态矩阵全态）；依赖 2.2；验证 UI Contract 与 `check:surfaces`；失败重检状态矩阵空/错/禁用态。 | evidence: 组件测试 + `pnpm run check:surfaces` 通过
- [ ] 3.2 client：引导编译 pane（contract 表单、确认门、结果卡、导出）；依赖 2.4；验证键盘路径与 reduced-motion；可与 3.1 并行。 | evidence: 组件测试通过，无障碍路径覆盖
- [ ] 3.3 bundle：可安装 patch 层与入口注册（probe 未过时禁用+原因）；依赖 3.1、3.2；验证 `check:bundles` 无 `@yeisme/*` require 红灯；失败重检 bundle 自包含。 | evidence: `pnpm run check:bundles` 通过
- [ ] 4.1 无 CLI 场景验收：未安装 template-registry CLI 的 profile 下，pane 经 MCP `tools/list`/`inputSchema` 取得参数与恢复合同，重开后从投影恢复编译会话；依赖 3.3；失败重检恢复字段完整性。 | evidence: temp/integration-test-runs/<run-id>/ 脱敏证据
- [ ] 4.2 文档：插件 README、docs 集成页（目录/编译/降级/恢复与权限边界）；依赖 3.3；验证文档命令真实可运行；失败重检命令与输出契约。 | evidence: 文档合入，命令经实际执行核对
- [ ] 5.1 后续衔接（不阻塞本 change 关闭）：recipe 运行器、画布节点、垂直工作台模板驱动改造各立独立 change；3D 内容侧依赖 prompt-templates `official-3d-model-templates-beta-v1` 实施完成。
