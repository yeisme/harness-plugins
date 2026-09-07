# 会话工具工作区正式验收计划

状态：本轮正式验收已完成；Tools 核心链路、全部本地 bundle 入口、独立最终门与98项视觉已验证。实际结果与失败归因以 [交付记录](dsh-session-tools-workspace-delivery.md) 为准，以下矩阵保留为持续验收标准。

## 验收矩阵

| 场景 | 入口 / 环境 | 必须证明 | 对应任务 |
|---|---|---|---|
| 目录首次连接失败 | remote缺失→服务就绪 | 无controller仍能重探测并恢复，无重复挂载 | 1.1–1.2 |
| 空、部分与故障目录 | 空成功/来源失败/404/contract/storage fixture | 只有成功完整才显示完整，保留成功来源，错误可定位 | 1.1–1.4 |
| 会话实际能力 | A/B不同scope | 全局已安装不等于A可调用；不从调用历史伪造目录 | 1.3 |
| 全局CAS启停 | 可丢弃profile/storage，真实owner | 成功、冲突、存储失败；不乐观切换、不取消正在运行的调用 | 1.4、5.2 |
| 双会话Tab | A/B同时打开 | 目录/活动/筛选/选择不串会话 | 2.1–2.2 |
| A Tab与A旁栏 | 固定并切换筛选/选择 | 同会话状态同步，关闭一处不释放另一处数据 | 2.2–2.3 |
| 固定生命周期 | 关闭A标签、切B、重开A | A旁栏仍显示A；删除A时显示不可用而非B | 2.3、3.2 |
| 标题会话管理 | 同名/重命名/已打开/新选择 | 可区分来源、搜索切换、固定保留、不复制conversation | 3.1–3.2 |
| 刷新与旧布局 | 新sessionId绑定/旧无绑定布局 | 恢复固定A；旧布局要求明确选择，不自动绑定 | 2.4、3.2 |
| 失败详情与消息定位 | 可丢弃会话含安全错误引用 | 正确会话Chat和原调用，脱敏摘要，无私有payload | 4.2–4.3 |
| 活动负载与边界 | 0/1/200/超过200、运行中/失败/缺时间 | 可读排序、窗口边界、列表/时间线文字等价、无负耗时 | 4.1 |
| UI和可访问性 | 360/560/960px，键盘/触控/reduced-motion | 单工具栏、有界滚动、窄屏返回焦点、无重复统计 | 4.1–4.3、5.5 |
| 多Pane与快捷键 | 至少4个Pane及浮动组 | 拖拽、固定会话、数字聚焦、循环、无重复Target | 5.3 |
| HMR/卸载/重连 | 新旧请求交错、关闭最后视图 | 注册/订阅/定时器释放，迟到结果不覆盖B | 1.2、2.2 |
| 全部插件冒烟 | 动态发现所有本地bundle | 安装→装载→适用入口逐项结果；无入口须有理由 | 5.4 |
| 宿主补丁复建 | 当前支持release基线的干净checkout | 完整补丁链重建自有文件，幂等重放 | 3.3 |

每个场景实施时在现有测试文件或脚本中标识其对应任务，不建立第二套测试框架。直接纯函数使用 Vitest；多模块/真实服务测试复用包 integration 入口；浏览器扩展 scripts/test-pane-interactions.mjs。缺少基建时扩展现有脚本并通过 CLI 生成证据。

## 插件覆盖口径

启动前动态发现 bundle，核对 web profile 已安装集合及运行时加载状态。当前基线为33个，运行报告记录实际集合；新包自动纳入。每项至少记录包名、已安装/已装载、适用入口、结果、失败/不适用/依赖缺失原因与证据。

非UI bundle 以其注册/组合合同验收，不凭没有可点击按钮判断失败。需要外部系统的入口检查可见性和诚实降级，不自动执行远端写入或模型调用。使用mock验证的结果标为mock合同通过；未配置真实MCP服务不能报告真实连接通过。

## 执行顺序与命令

以下为实施稳定后的真实命令，均在 agent/harness-plugins 执行；每次执行保留各自结果，不用历史报告替代当前验证。

```bash
pnpm --filter @yeisme/dsh-client-ui-mcp-inspector test
pnpm --filter @yeisme/dsh-tool-hub-host test
pnpm --filter @yeisme/dsh-mcp-inspector test
node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs
node packages/client/ui-mcp-inspector/scripts/run-integration-tests.mjs --host
node scripts/test-pane-interactions.mjs
node scripts/test-workbench-patches.mjs
pnpm dsh:workbench -- --check
```

浏览器脚本从临时 DSH_PREVIEW_URL 接收本地认证地址；不得将真实地址/token写进命令记录、报告或仓库。启动和profile安装使用现有 dsh:workbench/dsh:dev 服务命令，不手写用户配置。全局开关测试必须在可丢弃数据中执行，用户真实工具偏好不重置。

功能代码、直接测试和文档稳定后，执行最终门一次；失败时先归因，修复后仅按影响范围重跑。

```bash
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run check:bundles
pnpm run check:plugins
pnpm run check:surfaces
pnpm run test:visual
openspec validate dsh-session-tools-workspace-v2 --strict --no-interactive
```

## 证据、退出与完成条件

所有integration/component/system/e2e逐次生成 temp/integration-test-runs/<run-id>/ 下的 summary.json、command.txt、stdout.log、stderr.log、env.json、artifacts/。生成由测试入口负责；失败也保留六件套并返回原退出码。截图遮盖真实会话名/正文、文件名等无关信息；日志不含token、Authorization、原始工具参数/结果、provider payload或完整推理链。

报告分别列出 passed、failed、blocked、not-applicable 与未验证项，附理由；这是验收记录语义，不是新增业务API枚举。Tools必测场景有失败时不能总体通过；其他插件的外部依赖缺失不可伪装成业务成功。历史“Tools标签能打开”或“33包已安装”的证据不替代本轮验收。

macOS真机不可得时，只报告Linux浏览器Meta/Option事件与键盘合同通过，保留Mac/Safari系统级快捷键验证缺口。不得为取得测试通过而启用收费调用、真实外部写入、改变凭据或删除用户数据。

## 任务依赖

1.1先建立故障证据；1.2–1.4完成目录和owner边界后推进2.x数据绑定。3.x宿主接口与2.x对齐后推进4.x展示。5.1贯穿实现，5.2–5.5在稳定结果上验收；6.x以真实证据收尾，不能先把implementation任务勾完再补测试。
