# 实施与验证记录

## 当前基线

- 插件工作树存在大量已有未提交改动，本次不执行 reset/clean，不把既有修改计为本次交付。
- 本地宿主 staging 基线：`a66e4702047846cdaa10c66c9d3df3951f5ea70d`，包版本 `0.1.2-rc.1`；已有 dirty 状态，版本号本身不证明当前运行进程使用该源码。
- 输入框已有 Lexical ReferenceChipNode、file/session 的 @ source 和字符串 codec；结构化引用随消息提交、持久化和回看仍需新增衔接。
- 宿主 ThemeRuntime/ThemePresenter 已拥有 light/dark/system；插件 21 个 canonical token 仅 5 个与宿主同名，其他需要映射实际 alias。
- 截图中的 Error 来源于选区 context label；与请求失败不同，本次保留来源语义并改进文案。

## 已执行验证

| 命令 | 结果 | 层级 |
|---|---|---|
| `openspec validate dsh-web-composer-references-theme-v1 --strict --no-interactive` | 通过 | 设计合同 |
| `openspec validate --all --strict --no-interactive` | 132 通过，0 失败 | 全部设计合同，不能代替运行验收 |
| `node --check scripts/run-composer-reference-host-tests.mjs` | 通过 | 验收入口语法 |
| `pnpm --filter @yeisme/dsh-client-ui-visual-kit run test` | 实施者报告 14/14；独立 review 进行中 | 公共主题单元测试 |
| `pnpm --filter @yeisme/dsh-client-ui-visual-kit run build` | 实施者报告通过 | 公共主题包构建 |

上述 pnpm 检查使用进程设置 `pnpm_config_verify_deps_before_run=warn`，避免 pnpm 11 默认自动重装共享依赖。依赖状态警告为 `patchedDependencies` 设置与已安装树不同；此证据基于当前依赖树，不证明锁文件从零安装可复现。未修改锁文件或 node_modules 安装状态。

## 主题独立验收与视觉基线

- 独立 review 找到的 accentFallback 绕过宿主与链接语义映射问题均已修复，复审通过；visual-kit 最终聚焦单测为 17/17。
- 使用隔离缓存中项目指定的 Chromium headless shell 1223 重跑 `selection artifact|reference action follows|touch annotation`：5 通过、3 中文截图失败；主题亮暗/系统/回退/override 和触屏用例通过。
- 在相同浏览器与测试入口拦截加载实施前保存的 selection client 构建产物，再跑同三项中文截图：同样失败，采样差异为 1245–1248 pixels、ratio 0.01；当前构建为 1245 pixels。证据证明旧产物也不符合现有截图基线，不能将两轮像素宣称完全相同。不更新用户的 dirty/untracked snapshots，也不将整体视觉门误写为通过。
- 对比证据：`temp/integration-test-runs/reference-visual-20260905T102146/summary.json` 与 `artifacts/baseline-comparison.log`。直接 before/current 渲染样本另存于 `temp/integration-test-runs/reference-visual-baseline-1788603942223/artifacts/`。
- 组件主题测试不代表真实宿主生产引用入口通过；动态目标 provider 与实际消息 roundtrip 继续实施。

选区 producer 独立审查发现的异步 capture 竞争、严格 UTF-8 source mapping、来源焦点、晚到 provider、跨挂载回执及 provider 卸载问题已由原 writer 修复。最新聚焦集成测试 15/15，typecheck/build 通过；root 核对了动态注入从初始 provider 存在和缺失两种状态的移除清理。Host counterpart 的真实 RPC 与整体验收仍单独保留未完成。

## 验收入口

`node scripts/run-composer-reference-host-tests.mjs` 使用已构建的真实宿主及 keyless replay 框架，结果保存在本仓库 `temp/integration-test-runs/`。默认只运行既有 file/session composer 场景；新增多类型发送场景必须显式传入，不能把默认结果误称为全部引用验收。测试自身使用隔离工作区、合成内容和回放模型，不读取真实业务会话，不发起付费推理。

插件完整门禁在稳定 diff 后串行运行，避免构建产物读写竞争。当前尚未完成插件最终门与实际 Web 端到端验收。

## 兼容与权限

公开扩展采取 additive 策略，V1 无弃用/移除发布。宿主适配补丁以实施前文件快照为基线，避免夹带 staging 的其他改动。发布、推送和部署均不在本次执行范围。

## 引用检查点审查（未验收）

首轮引用实现虽然通过局部测试，独立冻结检查点审查仍发现实际 transport 参数未接通、opaque 文件引用与路径证明不一致、目标 workspace/CAS 缺失、选区范围和目录证明不足、路径边界与 pending 生命周期风险。这些项被列为后续实现与稳定 diff 复审的阻断项；该检查点不能作为完整功能通过证据。

生产装配另发现 selection 插件只有测试注入的 referenceBridge，且一次性启动探测可能早于宿主 provide。当前正在接入真实 Cordis provider、晚到服务探测及原文件 UTF-8 byte-window 映射。上述风险必须通过实际 RPC、owner resolver、Agent 上下文消费和真实 Web 回看测试后才能关闭。

## 首次独立全量门禁

证据：`temp/integration-test-runs/full-plugins-2026-09-05T12-00-57-242Z/`。验证者对 1698 个已跟踪文件做前后 SHA-256 比较，内容未变。

| Gate | 结果 |
|---|---|
| typecheck | 通过 |
| test | TS2307，pane-protocol 产物读取失败 |
| build | TS2307，ui-surface 产物读取失败 |
| check:bundles | 通过，27 checked |
| check:surfaces | 通过 |
| test:visual | 32 通过、4 失败 |
| check:plugins | 3 项 unified-host 直接存储访问告警 |

独立诊断确认同仓库另有 12:00:43 与 12:07:21 验证运行，本任务验证者只启动了 12:00:57 一次。重叠构建期间 lib 导出文件实际消失并重建；后续非重叠运行 typecheck/build 通过。中文截图差异在另一次非重叠运行未出现，说明环境/产物并发是重要变量，不能据此更新截图。

视觉 reference 失败的具体原因是 fixture 使用旧 `{target}` bridge，缺少 snapshot/subscribe/resolveSelection；已补完整 fixture 和精确 raw source attrs，聚焦浏览器测试 1/1 通过。主题 alias 变化涉及 cookie-manager/session-tags 的旧断言，已改为验证 canonical→official→fallback 且不重复 canonical 声明；两包聚焦测试分别 34/34、57/57，通过类型检查。

unified-host 存储访问不属于本任务 writer 的修改；另一个并行改动已移除相关直接扫描。本任务随后执行 `pnpm run check:plugins`：全部六类检查通过、0 findings，证据 `temp/toolchain-runs/2026-09-05T123513193Z-toolchain/`。

为避免后续完整验证互相清理产物，`run-full-plugin-validation.mjs` 新增跨进程锁与 PID run-id 后缀；`node --test scripts/verification-lock.spec.mjs` 2/2 通过。该锁只约束合作的完整验证入口，不能阻止其他入口的包构建，故仍需执行期协调。

## 第二个冻结引用候选（仍未通过）

冻结补丁 SHA-256 `5b36655af88a1333bd909198ffb1902425c6e1b461315f3ac22d88d6de20b2a0` 可应用于 a66e470，但审查仍发现 opaque inspect/read 版本不一致、读取路径竞争、owner/kind/intent 混淆及未知字段透传、图片区域传完整图、多范围去重、dock/editor 生命周期脱节、终端弱摘要。已释放 freeze，由同一 reference owner 修复后重新生成候选；旧候选不得作为完整交付。

## 真实装配推进（修复中）

Host 全量构建在修复引用接口类型错误后通过。真实 multi-reference 用例使用桌面工作台和选区插件 overlay，首先发现 scaffold 对外部 extraInstallAnchors 的层根链接被清除，导致插件无法导入；该问题与产品引用逻辑分开修复。后续运行已越过插件导入和真实 `@` 文件选择，又发现 desktop 在宿主 Composer bridge 到达前一次性探测，引用清单因此长期停留在兼容路径。此项正在由引用 owner 修复，尚不能标记纵向链路通过。

证据入口现在向测试提供本次 `artifacts/` 路径以保存浏览器截图和验收产物；summary 根据是否执行 multi-reference 用例区分真实插件装配与原有宿主测试。入口语法检查及 `openspec validate dsh-web-composer-references-theme-v1 --strict --no-interactive` 通过。

实际 unified workspace profile 还需要 pane-workbench provider；已补入真实 overlay/anchor。三插件出现在 boot batch 后，旧测试等待 sidebar 的“文件”按钮仍失败；当前宿主改为 `Add pane` catalog 入口，故正在修正测试导航假设。该等待失败本身不证明三个插件未加载，也不应将 boot batch 的存在误当 provider 已注册成功。

新增 12 个引用工具条组件视觉用例，覆盖 360/560/960/1440 与亮/暗/系统主题，断言主动作或窄屏入口、焦点、减少动画的计算样式及屏内边界。静态类型检查通过，浏览器结果待统一门禁；这些 fixture 用例不替代真实宿主 Composer 验收。

Root 随后使用隔离端口 43219、既有构建产物及固定 Chromium 运行 `pnpm exec playwright test --config temp/reference-theme-current/playwright.config.ts --grep 'reference toolbar|reference action follows'`：13/13 通过（6.1 秒），证据 `temp/integration-test-runs/reference-toolbar-20260905T132823Z/`。未更新截图、未构建或安装依赖；这关闭工具条专项浏览器验证，完整 Composer 响应式验收仍待完成。

新增 Host `reference-input-lifecycle.client.spec.tsx`，复用真实 InputBar、SessionInputShell 和 Lexical。首次运行发现 jsdom Range 几何接口缺失，补齐仅测试内 shim 后执行 `pnpm_config_verify_deps_before_run=warn pnpm exec vitest run packages/client/ui-conversation/tests/reference-input-lifecycle.client.spec.tsx`：3/3 通过。覆盖中文输入法候选与结束 Enter、引用插入/删除的撤销重做、pending structured submit 期间重复 Enter 与新增草稿保留；浏览器跨节点键盘删除仍待独立验证。

13:34 的引用清单缺失经独立静态诊断确认：旧插件已注册 dock slot，宿主也渲染该 slot；问题在 sibling bridge 的权威引用未同步到插件 controller。最新实现将 unified 宿主清单移至 ConversationRoot，直接投影 InputState.occurrences，插件镜像清单仅保留 legacy 路径。真实用例仍保留清单可见、失败保留和成功清理断言，不能用隐藏清单或删除断言绕过验收。

## 服务端修复快照复审（进行中，未通过）

`temp/reference-server-review-20260905/manifest.json` 固定 129 个服务端及相关合同文件，复审只读副本，不读取仍在修改的浏览器桥。初步结论：版本函数与图片裁剪修复路径得到确认；目录枚举/下载仍有路径替换窗口，legacy fs.tree/read/binary 与 client cwd 仍可能绕过工作区边界。此外 file/full、file/prefix 需由 owner 验证实际窗口，不能把任意中间片段标成完整文件。已将这些项交回同一 writer，最终结论和回归证据待补。

该快照正式复审结果为 changes-requested：129/129 hash 一致；旧 finding 1、4 关闭，2、3 仍开放。经原 writer 确认释放路径后，服务端文件 owner 与 desktop node entry 的修复交由独立 implementer，浏览器引用桥继续由原 writer 负责；不重叠写入，构建须先协调。

新增 Host `reference-target-lifecycle.client.spec.tsx` 使用真实 apply/provider/session harness，通过实际 bridge event 验证两会话结构化草稿切换恢复、无目标/关闭目标拒绝、stale revision/跨工作区请求不污染其他草稿。执行 `pnpm_config_verify_deps_before_run=warn pnpm exec vitest run packages/client/ui-conversation/tests/reference-target-lifecycle.client.spec.tsx`：3/3 通过；独立源码 TypeScript 检查也通过。此结果不替代浏览器渲染与真实 RPC 验收。

## 十类引用真实链路与剩余 UI 门

`temp/integration-test-runs/composer-host-2026-09-05T16-17-00-476Z-450183/`：真实宿主+插件 overlay 的 multi-reference 用例通过，2 次 Host prompt/model receiver，覆盖 file/directory/selection/image/image-region/message/terminal/agent/skill/tool。终端通过正式 Host `referenceTerminals` catalog 提供 owner SHA-256 proof，引用不执行命令或工具。浏览器产物包含成功截图和脱敏断言汇总。

Root 人工检查 360px 截图仍发现固定展开侧栏占约 280px，主对话仅余约 80px；截图存在和 document 无横向滚动不能作为布局可用证据。3.3 保持未完成，窄屏 sidebar overlay 修复单独交付 Host ui-layout writer；引用清单主题变量/语言配置，以及正文与历史各类型图标继续由 reference owner 收敛。

完整插件门 `full-plugins-2026-09-05T16-21-42-022Z-589060` 执行一次但不通过：typecheck/test/build/test:visual/check:plugins 失败，bundles/surfaces 通过。验证期间 selection-annotation 的 index.ts/locales.ts 有并发变化，故该门不具稳定版本验收效力。独立诊断确认部分新 locale 已在结束后补齐；剩计时器类型、显式 listener dispose、interaction 测试合同失配交由独立 bounded writer 修复，保留并发功能。3 个中文截图仅有文本栅格差异且基准为 untracked，须核对 browser/font provenance，不能直接覆盖。

## 固定视觉环境与基准迁移

visual runner 现在记录实际 Playwright 依赖版本、Chromium headless-shell revision/version/SHA-256、DPR=1、字体匹配及哈希；明确的 executable/cache override 不静默回退。`visual-provenance-20260905T170044Z` 在隔离端口 43219 双跑 selection 中英文六例，两轮英文 3/3 通过，中文 actual 三图分别逐字节一致，且与此前固定浏览器结果一致。

独立复核确认差异仅在文字行带，背景、边框、焦点、布局、尺寸及换行不变。原三张 untracked 中文图生成于固定浏览器安装前，缺少生成 provenance。Root 因此将原图、旧新 hash 和完整环境记录保存到该 run 的 `artifacts/baseline-migration/`，再仅将三张中文 canonical 图迁移至固定 lane actual；未改其他截图或放宽比较阈值。迁移后完整视觉门待重跑。

server r3 限定复审已关闭 finding 1–4（131/131 snapshot hash一致），新终端 owner 和客户端边界在 `reference-client-production-20260906T0058Z` 独立复审。该客户端快照明确排除选区插件的未知并发差异；legacy dock 在目标不可用时保留旧目标显示的问题仍在修复，不能以新宿主路径通过替代兼容路径验收。

迁移后首次完整视觉运行暴露新增来源详情复用了旧 composer data 标记，导致测试 strict locator 同时匹配两个面板；另主动作已改为 Add to chat。Root 将测试选择器限定到真实评论 composer class，保留打开/关闭/焦点断言并同步明确文案，未改产品代码或比较阈值。`CI=1 pnpm_config_verify_deps_before_run=warn PLAYWRIGHT_BROWSERS_PATH="$PWD/temp/reference-playwright-browsers" node scripts/run-ui-visual-tests.mjs` 在 `ui-visual-2026-09-05T17-11-26-345Z-2930782` 达到 48/48 通过（17 秒），完整 provenance 随 run 保存。

## 选区并发增量安全收口

最新稳定选区快照独立复审发现 text-quote 误用 ask submit 且无回执报成功、插入超时换 request ID、activation 能力虚报，以及 chooser 取消/异步投影问题。为避免覆盖仍可能存在的外部写入，先在 `temp/selection-security-repair-candidate-20260906/` 隔离修改并测试，再独立复审。

候选 72/72 测试及类型检查通过。文字引用现仅打开预填可编辑 composer，不自动发送；未知结果保留原 request ID 并接受迟到回执；chooser 在 abort/卸载时取消，并忽略中间状态直到目标 tuple 匹配。复审发现的非匹配快照过早结束及 manifest 旧 hash 也已修正，最终 26/26 manifest hash一致、PASS_WITH_BOUNDARY。

Root 合入前确认 live index/locales/flow 仍为审查基线 hash，保留 `live-pre-merge/` 备份后只合入这三个文件。Activation 的真实 Host focus/回执与 target chooser 生产实现仍由 reference owner 完成和独立复审；本次候选通过不提前接受宿主能力。

合入后 live 选区 72/72、tsc 与 dispose（498 scanned / 0 findings）通过，前后 hash一致。随后新的完整门 `full-plugins-2026-09-05T17-48-33-120Z-203831` 又检测到外部对选区 index/flow 的写入；继续共享目录验证不能证明稳定候选。Root 因此建立 `temp/reference-isolated-verification/`，独立复制源码、依赖与产物，使用独立 Git index 记录基线但不创建提交；只读共享固定浏览器缓存，构建与测试输出均隔离。

该验证副本明确采用已审选区候选和最终 reference plugin 四文件快照，并额外记录一个现有搜索视图的 build prerequisite（search-overlay 从定义它的 core-pane 导入常量），不将其冒充引用功能改动。完整门结果只能声称该隔离候选通过，不能直接推断仍被其他任务修改的共享目录通过。

`reference-activation-chooser-review-r2-20260906T0159Z` 12/12 文件 hash校验后复审 PASS_WITH_E2E_BOUNDARY：Host与插件转发层均绑定 request ID 的完整 target/proof/activation identity，异内容复用不覆盖原回执；无目标时输入区切换入口可达；实际焦点确认和 Modal取消/焦点恢复有生产实现及测试。旧安全 finding 1–7、选区候选与 activation/chooser 的源码问题已关闭，最新实际浏览器验收仍须完成。

## 最终真实 Web 与门禁

最终真实组合证据：`temp/integration-test-runs/composer-host-2026-09-05T18-48-25-818Z-2858644/`。测试使用 `DSH_REFERENCE_PLUGIN_ROOT` 指向隔离构建插件，并通过真实 Host scaffold、Gateway、Session、PTY 和 keyless replay 运行；没有 Provider 请求。结果覆盖十类结构化引用、两次实际 model receiver、stale 拒绝保留草稿、成功后仅清提交快照、普通 add 保持来源焦点、Ask-with-reference 收到 activation receipt 后聚焦 Composer、360/560/960 稳定布局和 `@` 菜单边界、深色/减少动画、目标选择往返、双对话草稿隔离及历史 exact-kind metadata。浏览器记录 `tool_call=false`、page error/warning 均为 0。

Host 适配包最终位于 `upstream-prs/composer-multi-reference-v1/`。它明确要求先应用 `unified-multi-pane-workbench` prerequisite；随后在干净 a66e470 checkout 中 `apply.sh`、75/75 owned parity、reverse check 及 diff check 均通过。最终 `changes.patch` SHA-256 为 `f6beaf89770ff8aaa510ee88551a874bfa12a5d47cfef507ed608b68a0cf7547`；delivery manifest SHA-256 为 `5be3b5488ad01a93608f725b47fd2e5ffe9fe7afe568db695059f79912739ace`。

共享工作区持续有其他任务写入，因此最终插件门在 `temp/reference-isolated-verification/` 固定候选执行。门禁同时发现并单独修复了统一搜索面板 render loop/默认 dialog 合同、Creator Studio 未声明 `react-dom`、选区高负载时序测试和两条视觉定位/稳定等待；这些是 prerequisite，不混入 reference Host patch。最终汇总证据：`temp/integration-test-runs/isolated-reference-final-20260906/`。

最终结果：

| Gate | 结果 |
|---|---|
| `pnpm run typecheck` | PASS |
| `pnpm run test` | PASS |
| `pnpm run build` | PASS |
| `pnpm run check:bundles` | PASS，27/27 |
| `pnpm run check:surfaces` | PASS |
| `pnpm run test:visual` | PASS，74/74 |
| `pnpm run check:plugins` | PASS |

最终完整测试后，选区包 72/72 连续三次通过；ui-pane-workbench 373/373 通过。固定视觉环境记录 Playwright 1.60.0、Chromium headless-shell revision 1223 / 148.0.7778.96、DPR=1 与实际中文字体哈希。OpenSpec 最终严格校验见下方命令记录。

共享 dirty worktree 本身不声明为七门全绿；最终结论绑定隔离候选、delivery manifest、干净补丁 apply 证据和真实 Host Web E2E。未执行提交、推送、部署、生产操作或付费模型请求。
